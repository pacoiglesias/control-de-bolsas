import { useState, useMemo } from 'react';
import { Modal } from '../ui';
import { round2 } from '../../lib/finance';
import { money } from '../../lib/format';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { runTransaction, doc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { camposInvoices, aplicarPorId } from '../../lib/invoiceOps';
import { sound } from '../../lib/sounds';
import confetti from 'canvas-confetti';

interface MatchedDeposit {
  rawLine: string;
  depositAmount: number;
  reference: string;
  matchedCr?: string;
  matchedOrder?: PurchaseOrder;
  matchedInvoice?: Invoice;
  matchedInvoices?: { order: PurchaseOrder; invoice: Invoice }[];
  matchType: 'exact_cr' | 'exact_amount' | 'exact_folio' | 'none';
  matchScore: number;
  selected: boolean;
}

interface AutoConciliadorModalProps {
  orders: PurchaseOrder[];
  onClose: () => void;
  onSuccess: (count: number, total: number) => void;
}

export default function AutoConciliadorModal({ orders, onClose, onSuccess }: AutoConciliadorModalProps) {
  const [pasteText, setPasteText] = useState('');
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<MatchedDeposit[]>([]);

  // Extraer todas las facturas abiertas/pendientes de cobro
  const openInvoices = useMemo(() => {
    const list: { order: PurchaseOrder; invoice: Invoice; total: number; cr: string; folio: string }[] = [];
    orders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        const st = inv.creditCycle?.status;
        if (st === 'pending' || st === 'overdue' || st === 'pedido') {
          const total = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim().toUpperCase();
          const folio = (inv.folio || o.folio || '').trim().toUpperCase();
          list.push({ order: o, invoice: inv, total: round2(total), cr, folio });
        }
      });
    });
    return list;
  }, [orders]);

  // Agrupar facturas por contrarecibo
  const crGroups = useMemo(() => {
    const map = new Map<string, { order: PurchaseOrder; invoice: Invoice; total: number }[]>();
    openInvoices.forEach(item => {
      if (item.cr) {
        const arr = map.get(item.cr) || [];
        arr.push({ order: item.order, invoice: item.invoice, total: item.total });
        map.set(item.cr, arr);
      }
    });
    return map;
  }, [openInvoices]);

  const parseAndMatch = () => {
    if (!pasteText.trim()) return;

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const results: MatchedDeposit[] = [];

    lines.forEach(line => {
      // 1. Extraer montos en la línea (acepta $123,456.78 o 123456.78)
      const cleanLine = line.replace(/,/g, '');
      const numberMatches = cleanLine.match(/(\d+\.?\d{0,2})/g);
      
      let depositAmount = 0;
      if (numberMatches) {
        const nums = numberMatches.map(Number).filter(n => n >= 100);
        if (nums.length > 0) {
          depositAmount = Math.max(...nums);
        }
      }

      // 2. Extraer posibles referencias (ej. CR, folios TH-739, GT-651, TR_3583)
      const words = line.split(/[\s\t,;|]+/);
      let foundReference = '';
      words.forEach(w => {
        const clean = w.replace(/[$]/g, '').trim().toUpperCase();
        if (clean.startsWith('TH-') || clean.startsWith('GT-') || clean.startsWith('TR_') || clean.startsWith('CR')) {
          foundReference = clean;
        }
      });

      let matchedCr: string | undefined;
      let matchedInvoices: { order: PurchaseOrder; invoice: Invoice }[] = [];
      let matchType: 'exact_cr' | 'exact_amount' | 'exact_folio' | 'none' = 'none';
      let matchScore = 0;

      // A. Intento 1: Coincidencia por número de Contrarecibo
      if (foundReference) {
        const crEntry = Array.from(crGroups.entries()).find(([crKey]) => 
          crKey === foundReference || foundReference.includes(crKey) || crKey.includes(foundReference)
        );
        if (crEntry) {
          matchedCr = crEntry[0];
          matchedInvoices = crEntry[1].map(x => ({ order: x.order, invoice: x.invoice }));
          matchType = 'exact_cr';
          matchScore = 100;
        }
      }

      // B. Intento 2: Coincidencia por Monto exacto contra grupo de Contrarecibo
      if (matchType === 'none' && depositAmount > 0) {
        for (const [crKey, items] of crGroups.entries()) {
          const sumCr = round2(items.reduce((acc, x) => acc + x.total, 0));
          if (Math.abs(sumCr - depositAmount) < 0.99) {
            matchedCr = crKey;
            matchedInvoices = items.map(x => ({ order: x.order, invoice: x.invoice }));
            matchType = 'exact_amount';
            matchScore = 95;
            break;
          }
        }
      }

      // C. Intento 3: Coincidencia por Monto exacto de Factura Individual
      if (matchType === 'none' && depositAmount > 0) {
        const singleMatch = openInvoices.find(x => Math.abs(x.total - depositAmount) < 0.99);
        if (singleMatch) {
          matchedInvoices = [{ order: singleMatch.order, invoice: singleMatch.invoice }];
          matchedCr = singleMatch.cr || singleMatch.folio;
          matchType = 'exact_amount';
          matchScore = 90;
        }
      }

      results.push({
        rawLine: line,
        depositAmount,
        reference: foundReference || (matchedCr ?? ''),
        matchedCr,
        matchedInvoices,
        matchType,
        matchScore,
        selected: matchScore >= 90,
      });
    });

    setMatches(results);
    setStep('preview');
  };

  const handleToggleSelect = (index: number) => {
    setMatches(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const executeConciliation = async () => {
    const selectedMatches = matches.filter(m => m.selected && m.matchedInvoices && m.matchedInvoices.length > 0);
    if (selectedMatches.length === 0) return;

    setSaving(true);
    try {
      const targetMap = new Map<string, { invoiceId: string; paidAmount: number; refDoc: string }[]>();

      selectedMatches.forEach(m => {
        const refDoc = m.reference || m.matchedCr || 'CONCILIACION_AUTO';
        m.matchedInvoices?.forEach(({ order, invoice }) => {
          const arr = targetMap.get(order.id) || [];
          const amount = invoice.financials?.invoiceTotal ?? invoice.financials?.saleTotal ?? 0;
          arr.push({ invoiceId: invoice.id, paidAmount: amount, refDoc });
          targetMap.set(order.id, arr);
        });
      });

      await runTransaction(db, async tx => {
        const orderIds = Array.from(targetMap.keys());
        const docRefs = orderIds.map(id => doc(db, PATHS.orders, id));
        const snapshots = await Promise.all(docRefs.map(ref => tx.get(ref)));

        snapshots.forEach((snap, idx) => {
          if (!snap.exists()) return;
          const orderId = orderIds[idx];
          const targets = targetMap.get(orderId) || [];
          let currentInvoices: Invoice[] = snap.data().invoices || [];

          targets.forEach(t => {
            const updated = aplicarPorId(currentInvoices, t.invoiceId, inv => ({
              ...inv,
              creditCycle: { ...inv.creditCycle, status: 'paid' },
              collection: {
                ...inv.collection,
                paidAmount: t.paidAmount,
                paidAt: Timestamp.now(),
                paymentDocument: t.refDoc,
              },
            }));
            if (updated) {
              currentInvoices = updated;
              const modifiedInv = updated.find(x => x.id === t.invoiceId);
              if (modifiedInv) {
                tx.set(doc(db, PATHS.invoices, t.invoiceId), {
                  ...modifiedInv,
                  orderId,
                  client: snap.data().client ?? '',
                  department: snap.data().department ?? '',
                }, { merge: true });
              }
            }
          });

          tx.update(docRefs[idx], camposInvoices(currentInvoices));
        });
      });

      sound.playChaChing();
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 } });

      const totalKilos = selectedMatches.reduce((acc, m) => acc + m.depositAmount, 0);
      onSuccess(selectedMatches.length, totalKilos);
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Error al aplicar conciliación: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalSeleccionado = matches.filter(m => m.selected).reduce((acc, m) => acc + m.depositAmount, 0);

  return (
    <Modal title="🤖 Auto-Conciliador Inteligente de Pagos y Depósitos" onClose={onClose}>
      <div style={{ maxWidth: 840, width: '100%' }}>
        {step === 'input' ? (
          <div>
            <div style={{ background: 'var(--paper-sunk)', padding: 12, borderRadius: 8, marginBottom: 14, fontSize: 13 }}>
              💡 <strong>Instrucciones:</strong> Copia y pega aquí el reporte de depósitos del banco o de Providencia (montos, números de transferencia o contrarecibos). El sistema emparejará cada depósito con su contrarecibo y factura automáticamente.
            </div>

            <textarea
              className="input boxed mono"
              rows={9}
              style={{ width: '100%', fontSize: 13, resize: 'vertical' }}
              placeholder={`Ejemplo de texto pegado de Excel o Banco:\nTR_4589  GT-651  $81,780.00  DEPÓSITO EN FIRME\nTR_4590  TH-739  $153,381.00  PAGO FACTURAS PROVIDENCIA\nGT-624  $74,820.00`}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span className="hint" style={{ fontSize: 12 }}>
                {openInvoices.length} facturas abiertas en el sistema listas para conciliar
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose}>Cancelar</button>
                <button
                  className="btn btn-primary"
                  onClick={parseAndMatch}
                  disabled={!pasteText.trim()}
                >
                  ⚡ Analizar y Emparejar Depósitos
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <strong style={{ fontSize: 14 }}>Coincidencias Detectadas:</strong>
                <span className="hint" style={{ marginLeft: 8 }}>
                  ({matches.filter(m => m.selected).length} de {matches.length} depósitos listos para cobrar)
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span className="hint">Total a conciliar:</span>{' '}
                <strong style={{ color: 'var(--ok)', fontSize: 16 }}>{money(totalSeleccionado)}</strong>
              </div>
            </div>

            <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid var(--line)', borderRadius: 8, marginBottom: 16 }}>
              <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>Sel.</th>
                    <th>Texto Original / Referencia</th>
                    <th className="num">Monto Depósito</th>
                    <th>Contrarecibo / Factura Emparejada</th>
                    <th>Confianza</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m, idx) => (
                    <tr
                      key={idx}
                      style={{
                        background: m.selected ? 'var(--accent-tint, rgba(16,185,129,0.08))' : 'transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => handleToggleSelect(idx)}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={m.selected}
                          onChange={() => handleToggleSelect(idx)}
                          onClick={e => e.stopPropagation()}
                          disabled={m.matchType === 'none'}
                        />
                      </td>
                      <td>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink)' }}>{m.rawLine}</div>
                        {m.reference && <span className="hint" style={{ fontSize: 10 }}>Ref: {m.reference}</span>}
                      </td>
                      <td className="num mono" style={{ fontWeight: 700, color: m.depositAmount > 0 ? 'var(--ink)' : 'var(--warn)' }}>
                        {m.depositAmount > 0 ? money(m.depositAmount) : 'Sin monto'}
                      </td>
                      <td>
                        {m.matchedCr ? (
                          <div>
                            <strong style={{ color: 'var(--brand)' }}>{m.matchedCr}</strong>
                            <div className="hint" style={{ fontSize: 10 }}>
                              {m.matchedInvoices?.length} factura(s) vinculada(s)
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ink-soft)' }}>❌ Sin coincidencia</span>
                        )}
                      </td>
                      <td>
                        {m.matchType === 'exact_cr' && (
                          <span className="badge" style={{ background: 'var(--ok)', color: 'white' }}>🟢 100% CR</span>
                        )}
                        {m.matchType === 'exact_amount' && (
                          <span className="badge" style={{ background: '#0284c7', color: 'white' }}>🔵 Monto Exacto</span>
                        )}
                        {m.matchType === 'none' && (
                          <span className="badge" style={{ background: 'var(--line-soft)', color: 'var(--ink-soft)' }}>⚪ No coincide</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn" onClick={() => setStep('input')} disabled={saving}>
                ← Modificar Texto
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" onClick={onClose} disabled={saving}>Cerrar</button>
                <button
                  className="btn btn-primary"
                  onClick={executeConciliation}
                  disabled={saving || matches.filter(m => m.selected).length === 0}
                  style={{ background: 'var(--ok)' }}
                >
                  {saving ? 'Aplicando cobros...' : `✅ Aplicar Cobro a ${matches.filter(m => m.selected).length} Depósitos (${money(totalSeleccionado)})`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
