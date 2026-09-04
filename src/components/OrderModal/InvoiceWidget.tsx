import { useState, useEffect } from 'react';
import { Field, CopyButton } from '../ui';
import { CurrencyInput } from '../CurrencyInput';
import { fromInputDate, money, toInputDate, toDate } from '../../lib/format';
import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { addDays, computeFinancials, round2 } from '../../lib/finance';
import { db, PATHS } from '../../lib/firebase';
import { sound } from '../../lib/sounds';
import type { Invoice, OrderStatus, PurchaseOrder } from '../../lib/types';
import type { FinanceConfigCore } from '../../lib/finance';
import { useInvoiceActions } from './useInvoiceActions';
import { useToast } from '../../context/ToastContext';
import { promptDialog } from '../../lib/promptDialog';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';
import { openWhatsAppMessage } from '../../lib/whatsappReminder';

interface InvoiceWidgetProps {
  invoice: Invoice;
  order: PurchaseOrder;
  provName: string;
  config: any;
  // FIX: era `any`. En la practica siempre es un FinancialConfig (de
  // useConfig()) o el resultado de configEfectiva() -- ambos son
  // estructuralmente un FinanceConfigCore (mismo minimo comun que ya usa
  // computeFinancials/saveInvoice), asi que ese es el tipo real, no `any`.
  dynamicConfig: FinanceConfigCore;
  readOnly: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  enFoco: boolean;
}

export function InvoiceWidget({ invoice, order, provName, config, dynamicConfig, readOnly, expanded, onToggleExpand, enFoco }: InvoiceWidgetProps) {
  const { saveInvoice, deleteInvoice } = useInvoiceActions();
  const toast = useToast();
  const [localInvoice, setLocalInvoice] = useState<Invoice>(invoice);

  useEffect(() => {
    setLocalInvoice(invoice);
  }, [invoice]);
  
  // Track if there are local unsaved changes
  const hasChanges = JSON.stringify(invoice) !== JSON.stringify(localInvoice);

  const baseFin = computeFinancials(localInvoice.kilos, dynamicConfig);
  const fin = { ...baseFin, ...localInvoice.financials };
  
  const d = (() => {
    if (!localInvoice.creditCycle.dueDate) return null;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = toDate(localInvoice.creditCycle.dueDate);
    if (!due) return null;
    due.setHours(0,0,0,0);
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 3600 * 24));
  })();
  const isLate = (localInvoice.creditCycle.status === 'overdue' || localInvoice.creditCycle.status === 'pending') && d !== null && d > 0;

  const updateField = (fieldPath: string[], value: any) => {
    setLocalInvoice(prev => {
      const next = { ...prev };
      let current: any = next;
      for (let i = 0; i < fieldPath.length - 1; i++) {
        current[fieldPath[i]] = { ...current[fieldPath[i]] };
        current = current[fieldPath[i]];
      }
      current[fieldPath[fieldPath.length - 1]] = value;
      return next;
    });
  };

  const handleSave = async (invToSave: Invoice = localInvoice) => {
    try {
      await saveInvoice(order, invToSave, dynamicConfig);
    } catch {
      // toast already handled in useInvoiceActions
    }
  };

  return (
    <div
      id={`factura-card-${localInvoice.id}`}
      className="card"
      style={{
        padding: 16,
        border: enFoco ? '2px solid var(--accent)' : '1px solid var(--glass-border, var(--line))',
        background: enFoco ? 'var(--accent-tint)' : 'var(--glass-bg, #ffffff)',
        backdropFilter: 'var(--glass-blur, none)',
        WebkitBackdropFilter: 'var(--glass-blur, none)',
        boxShadow: 'var(--glass-shadow, 0 1px 3px rgba(0,0,0,0.1))',
        transition: 'all 0.3s ease',
      }}
    >
      <div
        onClick={onToggleExpand}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: expanded ? 16 : 0, borderBottom: expanded ? '1px solid var(--glass-border)' : 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 16 }}>Factura {localInvoice.folio ? `#${localInvoice.folio}` : '(sin folio)'}</strong>
          {localInvoice.collection?.contrareciboNumber && (
            <span className="badge b-info" style={{ letterSpacing: '0.04em' }}>
              CR: {localInvoice.collection.contrareciboNumber}
            </span>
          )}
          <span className="badge" style={{ background: 'var(--paper-sunk)', color: 'var(--ink)', fontSize: 13, fontFamily: 'monospace' }}>{money(fin.invoiceTotal)}</span>
          <span className="badge b-ok" style={{ fontSize: 13 }}>
            Utilidad: {money(fin.invoiceTotal - (fin.costTotal || 0) - (fin.commission || 0))}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '4px 8px', borderRadius: 12, background: localInvoice.creditCycle.status === 'collected' ? 'var(--cash-bg)' : isLate ? 'var(--bad-bg)' : 'var(--warn-bg)', color: localInvoice.creditCycle.status === 'collected' ? 'var(--cash)' : isLate ? 'var(--bad)' : 'var(--warn)' }}>
            {localInvoice.creditCycle.status === 'collected' ? '✅ En Caja' : localInvoice.creditCycle.status === 'paid' ? '🟡 Con el Contador' : isLate ? '🔴 Vencido' : '⏳ Por Cobrar'}
          </span>
        </div>
        <span style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, background: 'var(--paper)', padding: '6px 12px', borderRadius: 20 }}>
          {expanded ? '▲ Ocultar' : '▼ Editar'}
        </span>
      </div>
      
      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, alignItems: 'center' }}>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
               {hasChanges && <span style={{ color: 'var(--warn)', fontWeight: 'bold' }}>⚠️ Tienes cambios sin guardar</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btn"
                style={{ fontSize: 13, padding: '4px 12px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 600 }}
                onClick={async () => {
                  toast('📄 Generando Prefactura PDF de esta factura...', 'info');
                  await generatePrefacturaPdf(order, localInvoice);
                  toast('✅ Prefactura descargada', 'ok');
                }}
              >
                📄 Prefactura PDF
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  const fol = localInvoice.folio || order.folio || 'S/N';
                  const kgs = localInvoice.kilos || 0;
                  const tot = fin.invoiceTotal;
                  const text = `Hola Andrés, te comparto los datos de la Factura autorizada para la entrega en Providencia:\n\n📄 *Factura:* #${fol}\n📦 *Kilos amparados:* ${kgs.toLocaleString('es-MX')} kg\n🏢 *Cliente:* Grupo Textil Providencia\n💰 *Total c/IVA:* ${money(tot)}\n\nPor favor que el chofer lleve este documento / folio al descargar en báscula. Saludos.`;
                  openWhatsAppMessage(text);
                }}
                style={{ padding: '4px 10px', fontSize: 12, background: 'rgba(16,185,129,0.1)', color: '#047857', borderColor: '#10b981', fontWeight: 700 }}
                title="Mandar folio de factura a Andrés por WhatsApp para que su chofer la lleve a Providencia"
              >
                📲 Enviar a Andrés (WhatsApp)
              </button>

              {!readOnly && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleSave()}
                    style={{
                      padding: '5px 14px',
                      fontSize: 13,
                      fontWeight: 800,
                      background: hasChanges ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' : 'rgba(16,185,129,0.12)',
                      color: hasChanges ? '#fff' : '#047857',
                      border: hasChanges ? '1.5px solid #2563eb' : '1px solid #10b981',
                      boxShadow: hasChanges ? '0 2px 10px rgba(37,99,235,0.35)' : 'none',
                      cursor: 'pointer',
                    }}
                    title="Guardar de inmediato esta factura en Firebase"
                  >
                    {hasChanges ? '⚡ Guardar en Firebase' : '✓ Sincronizado en Firebase'}
                  </button>

                  {localInvoice.creditCycle.status === 'paid' && (
                    <button className="btn" style={{ background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)', padding: '4px 12px', fontSize: 13 }}
                      onClick={async () => {
                        const invTotal = fin.invoiceTotal;
                        const commission = fin.commission || 0;
                        const netEsperado = invTotal - commission;
                        const respuesta = await promptDialog({
                          message: `Esperado (con comisión de ${(commission / invTotal * 100).toFixed(3)}%): $${netEsperado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n¿Cuánto recibiste realmente en Caja?`,
                          defaultValue: netEsperado.toFixed(2),
                        });
                        if (respuesta === null) return;
                        const netReal = Number(respuesta.replace(/[^0-9.-]/g, ''));
                        if (isNaN(netReal) || netReal <= 0) {
                          toast('Monto inválido, no se registró nada.', 'bad');
                          return;
                        }
                        const diferencia = round2(netReal - netEsperado);
                        sound.playCash();
                        try {
                          await addDoc(collection(db, PATHS.expenses), {
                            date: Timestamp.now(),
                            concept: `Cobro factura #${localInvoice.folio ?? '?'} (CR: ${localInvoice.collection?.contrareciboNumber ?? '—'})`,
                            amount: netReal,
                            type: 'ingreso',
                            notes: `Documento: $${invTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} — Comisión: $${commission.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`,
                            montoEsperado: round2(netEsperado),
                            montoReal: round2(netReal),
                            diferencia,
                            createdAt: serverTimestamp(),
                          });
                          await saveInvoice(order, { ...localInvoice, creditCycle: { ...localInvoice.creditCycle, status: 'collected' }, collection: { ...localInvoice.collection, collectedAt: Timestamp.now() } }, dynamicConfig);
                          if (Math.abs(diferencia) > 0.01) {
                            toast(`💵 $${netReal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} agregado a CAJA. ⚠️ Diferencia vs esperado: ${diferencia > 0 ? '+' : ''}$${diferencia.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`, 'ok');
                          } else {
                            toast(`💵 Recibido del contador. $${netReal.toLocaleString('es-MX', { minimumFractionDigits: 2 })} agregado a CAJA.`, 'ok');
                          }
                        } catch {
                          toast('No se pudo registrar en CAJA.', 'bad');
                        }
                      }}>
                      💵 Recibida del Contador → CAJA
                    </button>
                  )}
                  <button className="btn btn-danger" onClick={() => deleteInvoice(order, localInvoice.id)} style={{ padding: '4px 12px', fontSize: 13 }}>
                     Eliminar
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="form-grid">
            <Field label="Folio">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input boxed mono" value={localInvoice.folio || ''} 
                  onChange={e => updateField(['folio'], e.target.value.toUpperCase())}
                  onBlur={() => { if (hasChanges) handleSave(); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                  disabled={readOnly} />
                {localInvoice.folio && <CopyButton text={localInvoice.folio} />}
              </div>
            </Field>
            <Field label="Kilos Facturados">
              <input className="input boxed mono" type="number" step="0.01" value={localInvoice.kilos} 
                onChange={e => updateField(['kilos'], Number(e.target.value))}
                onBlur={() => { if (hasChanges) handleSave(); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                disabled={readOnly} />
            </Field>
            <Field label="Contrarecibo (CR)">
              <div style={{ display: 'flex', gap: 4 }}>
                <input className="input boxed mono" value={localInvoice.collection?.contrareciboNumber || ''} 
                  disabled={readOnly}
                  onChange={e => updateField(['collection', 'contrareciboNumber'], e.target.value.toUpperCase())}
                  onBlur={() => { if (hasChanges) handleSave(); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
                {localInvoice.collection?.contrareciboNumber && <CopyButton text={localInvoice.collection.contrareciboNumber} />}
              </div>
            </Field>
            <Field label="Estado del Contrarecibo">
              <select className="input boxed" value={localInvoice.creditCycle.status}
                disabled={readOnly}
                onChange={(e) => {
                  const nextStatus = e.target.value as OrderStatus;
                  updateField(['creditCycle', 'status'], nextStatus);
                  handleSave({ ...localInvoice, creditCycle: { ...localInvoice.creditCycle, status: nextStatus } });
                }}>
                <option value="pending">Por cobrar</option>
                  <option value="paid">🟡 Con el contador</option>
                  <option value="collected">✅ Recibida</option>
                  <option value="overdue">Contrarecibo vencido</option>
                  <option value="manual_review">Revisión manual</option>
              </select>
              <div style={{ color: 'var(--bad)', fontWeight: 'bold', fontSize: '12px', marginTop: 4, minHeight: 18, visibility: isLate ? 'visible' : 'hidden' }}>
                {isLate ? `⚠️ ${d} días de atraso` : ' '}
              </div>
            </Field>
            <Field label="Emisión">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.creditCycle.issueDate) || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const issue = fromInputDate(e.target.value);
                  if (issue) {
                    const due = addDays(issue, config.creditDays);
                    updateField(['creditCycle', 'issueDate'], Timestamp.fromDate(issue));
                    updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(due));
                  }
                }} />
            </Field>
            <Field label="Vence">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.creditCycle.dueDate) || ''}
                disabled={readOnly}
                onChange={(e) => {
                  const due = fromInputDate(e.target.value);
                  if (due) updateField(['creditCycle', 'dueDate'], Timestamp.fromDate(due));
                }} />
            </Field>
            <Field label="Fecha de Cobro">
              <input className="input boxed mono" type="date" value={toInputDate(localInvoice.collection?.paidAt) || ''}
                disabled={readOnly}
                onChange={e => {
                  const pa = fromInputDate(e.target.value);
                  updateField(['collection', 'paidAt'], pa ? Timestamp.fromDate(pa) : null);
                }} />
            </Field>
            <Field label="Monto Cobrado">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <CurrencyInput 
                  className="input boxed mono"
                  value={localInvoice.collection?.paidAmount || 0}
                  disabled={readOnly}
                  onChange={val => updateField(['collection', 'paidAmount'], val)} 
                  style={{ flex: 1 }}
                />
              </div>
            </Field>
          </div>

          {localInvoice.items && localInvoice.items.length > 0 ? (
            <div style={{ marginTop: 16, background: 'var(--paper-sunk)', padding: 12, borderRadius: 10, border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: 12.5, color: 'var(--ink)', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>📦</span> Partidas / Conceptos de esta Factura ({localInvoice.items.length})
                </div>
                {!readOnly && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    {order.items && order.items.length > 0 && (
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper)', border: '1px solid var(--line)' }}
                        onClick={() => {
                          const totalOcKilos = order.items!.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                          const ratio = totalOcKilos > 0 ? (localInvoice.kilos / totalOcKilos) : 1;
                          const newItems = order.items!.map(it => {
                            const q = round2((Number(it.quantity) || 0) * ratio);
                            const p = it.unitPrice || dynamicConfig.salePricePerKg || 43;
                            return {
                              ...it,
                              quantity: q,
                              unitPrice: p,
                              amount: round2(q * p),
                            };
                          });
                          updateField(['items'], newItems);
                          toast('📦 Conceptos re-sincronizados desde la OC', 'ok');
                        }}
                      >
                        🔄 Recargar de OC
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => {
                        const newIt = {
                          id: `custom_${Date.now()}`,
                          code: '24141500',
                          description: 'Bolsa de Polietileno',
                          unit: 'KGM',
                          quantity: 0,
                          unitPrice: dynamicConfig.salePricePerKg || 43,
                          amount: 0,
                        };
                        updateField(['items'], [...localInvoice.items!, newIt]);
                      }}
                    >
                      ➕ Agregar Partida
                    </button>
                  </div>
                )}
              </div>
              <div className="table-scroll">
                <table className="data-table" style={{ fontSize: 11.5, width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 110 }}>Clave SAT</th>
                      <th>Descripción del Concepto</th>
                      <th className="num" style={{ width: 120 }}>Kilos</th>
                      <th className="num" style={{ width: 100 }}>P. Unitario</th>
                      <th className="num" style={{ width: 115 }}>Importe</th>
                      {!readOnly && <th style={{ width: 36 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {localInvoice.items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td>
                          {readOnly ? (
                            <span className="mono" style={{ color: 'var(--ink-soft)' }}>{it.code || '24141500'}</span>
                          ) : (
                            <input
                              type="text"
                              className="input boxed mono"
                              value={it.code || '24141500'}
                              onChange={e => {
                                const next = [...localInvoice.items!];
                                next[idx] = { ...next[idx], code: e.target.value };
                                updateField(['items'], next);
                              }}
                              style={{ fontSize: 11, padding: '3px 6px' }}
                            />
                          )}
                        </td>
                        <td>
                          {readOnly ? (
                            <span style={{ fontWeight: 600 }}>{it.description}</span>
                          ) : (
                            <input
                              type="text"
                              className="input boxed"
                              value={it.description}
                              onChange={e => {
                                const next = [...localInvoice.items!];
                                next[idx] = { ...next[idx], description: e.target.value };
                                updateField(['items'], next);
                              }}
                              style={{ fontSize: 11, padding: '3px 6px', fontWeight: 600 }}
                            />
                          )}
                        </td>
                        <td className="num">
                          {readOnly ? (
                            <span className="mono" style={{ fontWeight: 700 }}>{it.quantity.toLocaleString('es-MX')} {it.unit || 'kg'}</span>
                          ) : (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="input boxed mono"
                              value={it.quantity}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...localInvoice.items!];
                                const p = next[idx].unitPrice || dynamicConfig.salePricePerKg || 43;
                                next[idx] = { ...next[idx], quantity: val, amount: round2(val * p) };
                                const sumKilos = round2(next.reduce((s, x) => s + Number(x.quantity || 0), 0));
                                updateField(['items'], next);
                                updateField(['kilos'], sumKilos);
                              }}
                              style={{ fontSize: 11.5, padding: '3px 6px', width: 90, textAlign: 'right', fontWeight: 700 }}
                            />
                          )}
                        </td>
                        <td className="num">
                          {readOnly ? (
                            <span className="mono">{money(it.unitPrice)}</span>
                          ) : (
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              className="input boxed mono"
                              value={it.unitPrice}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const next = [...localInvoice.items!];
                                const q = Number(next[idx].quantity || 0);
                                next[idx] = { ...next[idx], unitPrice: val, amount: round2(q * val) };
                                updateField(['items'], next);
                              }}
                              style={{ fontSize: 11, padding: '3px 6px', width: 75, textAlign: 'right' }}
                            />
                          )}
                        </td>
                        <td className="num mono" style={{ fontWeight: 800, color: '#047857' }}>
                          {money(it.amount || round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 43)))}
                        </td>
                        {!readOnly && (
                          <td style={{ textAlign: 'center' }}>
                            {((localInvoice.items?.length || 0) > 1) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (localInvoice.items || []).filter((_, i) => i !== idx);
                                  const sumKilos = round2(next.reduce((s, x) => s + Number(x.quantity || 0), 0));
                                  updateField(['items'], next);
                                  updateField(['kilos'], sumKilos);
                                }}
                                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 13, cursor: 'pointer', padding: 2 }}
                                title="Eliminar partida"
                              >
                                ✕
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 14, background: 'rgba(37,99,235,0.05)', border: '1px dashed rgba(37,99,235,0.25)', padding: '10px 14px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--ink)' }}>
                ℹ️ Esta factura aún no tiene partidas desglosadas (solo kilos totales).
              </div>
              {order.items && order.items.length > 0 && !readOnly && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ fontSize: 11.5, padding: '4px 12px' }}
                  onClick={() => {
                    const totalOcKilos = order.items!.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
                    const ratio = totalOcKilos > 0 ? (localInvoice.kilos / totalOcKilos) : 1;
                    const newItems = order.items!.map(it => {
                      const q = round2((Number(it.quantity) || 0) * ratio);
                      const p = it.unitPrice || dynamicConfig.salePricePerKg || 43;
                      return {
                        ...it,
                        quantity: q,
                        unitPrice: p,
                        amount: round2(q * p),
                      };
                    });
                    updateField(['items'], newItems);
                    toast(`📦 ${newItems.length} conceptos importados de la OC`, 'ok');
                  }}
                >
                  📦 Cargar {order.items.length} Conceptos de la OC
                </button>
              )}
            </div>
          )}
          
          <div className="calc-box" style={{ marginTop: 16 }}>
            <div className="calc-line">
              <span>Venta (Total Factura)</span>
              <span className="mono">{money(fin.invoiceTotal)}</span>
            </div>
            <div className="calc-line">
              <span>Costo de Compra (Kilos a ${provName})</span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.costTotal)}</span>
            </div>
            <div className="calc-line" style={{ borderTop: '1px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <strong>Utilidad Bruta</strong>
              <strong className="mono">{money(fin.invoiceTotal - (fin.costTotal || 0))}</strong>
            </div>
            <div className="calc-line">
              <span>Comisión del Contador</span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
            </div>
            <div className="calc-line total" style={{ borderTop: '2px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span>💰 UTILIDAD NETA (Ganancia Real)</span>
              <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - (fin.costTotal || 0) - (fin.commission || 0))}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
