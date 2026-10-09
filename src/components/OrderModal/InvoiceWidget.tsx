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
import { FinancialHelpTooltip } from '../ui/FinancialHelpTooltip';

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
            <Field label={<span style={{ display: 'inline-flex', alignItems: 'center' }}>Kilos Facturados <FinancialHelpTooltip concept="kilos_facturados" /></span>}>
              <input className="input boxed mono" type="number" step="0.01" value={localInvoice.kilos} 
                onChange={e => updateField(['kilos'], Number(e.target.value))}
                onBlur={() => { if (hasChanges) handleSave(); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                disabled={readOnly} />
            </Field>
            <Field label={<span style={{ display: 'inline-flex', alignItems: 'center' }}>Contrarecibo (CR) <FinancialHelpTooltip concept="contrarecibo" /></span>}>
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
                  <option value="manual_review">⚠️ En Revisión / Rechazada</option>
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

          {/* ── PANEL: FACTURA RECHAZADA / REASIGNACIÓN DE FOLIO (Fase 3.3) ── */}
          {localInvoice.creditCycle.status === 'manual_review' && !readOnly && (
            <div style={{
              marginTop: 12,
              background: 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(185,28,28,0.1) 100%)',
              border: '1.5px solid rgba(239,68,68,0.5)',
              borderRadius: 12,
              padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ fontWeight: 800, color: '#dc2626', fontSize: 13 }}>
                  🚫 Factura en Revisión / Rechazada
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 600 }}>
                  Reasigna el folio sin perder el historial de entregas
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                {/* Folio anterior (solo lectura, para referencia) */}
                {localInvoice.folio && (
                  <div style={{ background: 'rgba(239,68,68,0.07)', padding: '8px 10px', borderRadius: 8, border: '1px dashed rgba(239,68,68,0.3)' }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', marginBottom: 2 }}>Folio Rechazado</div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, color: '#dc2626', fontSize: 13, textDecoration: 'line-through' }}>
                      {localInvoice.folio}
                    </div>
                  </div>
                )}

                {/* Campo de nuevo folio */}
                <div style={{ background: 'rgba(255,255,255,0.6)', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #10b981' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: '#065f46', textTransform: 'uppercase', marginBottom: 4 }}>Nuevo Folio SAT</div>
                  <input
                    className="input boxed mono"
                    style={{ width: '100%', color: '#059669', fontWeight: 900, fontSize: 14 }}
                    placeholder="Ej. E12345"
                    defaultValue=""
                    onBlur={(e) => {
                      const nuevoFolio = e.target.value.trim().toUpperCase();
                      if (!nuevoFolio) return;
                      const folioAnterior = localInvoice.folio || '';
                      const notaHistorial = `[${new Date().toLocaleDateString('es-MX')}] Folio cambiado de "${folioAnterior}" → "${nuevoFolio}" (Revisión/Rechazo)`;
                      const notasActuales = (localInvoice.collection as any)?.rejectionNotes || '';
                      updateField(['folio'], nuevoFolio);
                      updateField(['creditCycle', 'status'], 'pending');
                      updateField(['collection', 'rejectionNotes'],
                        notasActuales ? `${notasActuales}\n${notaHistorial}` : notaHistorial
                      );
                      toast(`✅ Folio reasignado: ${nuevoFolio}. Estado vuelve a "Por cobrar". Guarda para confirmar.`, 'ok');
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                  />
                </div>
              </div>

              {/* Notas de Rechazo / Historial */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#7f1d1d', textTransform: 'uppercase', marginBottom: 4 }}>Motivo de Rechazo / Historial</div>
                <textarea
                  rows={2}
                  className="input boxed"
                  style={{ width: '100%', fontSize: 12, resize: 'vertical', fontFamily: 'monospace' }}
                  placeholder="Ej: Nombre emisor incorrecto, RFC equivocado, fecha fuera de periodo..."
                  defaultValue={(localInvoice.collection as any)?.rejectionNotes || ''}
                  onBlur={(e) => {
                    updateField(['collection', 'rejectionNotes'], e.target.value);
                    if (hasChanges) handleSave();
                  }}
                />
              </div>

              <div style={{ marginTop: 8, fontSize: 11, color: '#7f1d1d', fontStyle: 'italic' }}>
                ℹ️ Al ingresar el nuevo folio se restablecerá el estado a "Por cobrar" automáticamente. Las entregas no se modifican.
              </div>
            </div>
          )}

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
                            const p = it.unitPrice ?? order.customSellPrice ?? dynamicConfig.salePricePerKg ?? 0;
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
                          unitPrice: order.customSellPrice ?? dynamicConfig.salePricePerKg ?? 0,
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
                                const p = next[idx].unitPrice ?? order.customSellPrice ?? dynamicConfig.salePricePerKg ?? 0;
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
                          {money(it.amount || round2((Number(it.quantity) || 0) * (Number(it.unitPrice) || 0)))}
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
                      const p = it.unitPrice ?? order.customSellPrice ?? dynamicConfig.salePricePerKg ?? 0;
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
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                Subtotal (Base Imponible) <FinancialHelpTooltip concept="subtotal" />
              </span>
              <span className="mono">{money(fin.saleTotal || (fin.invoiceTotal ? fin.invoiceTotal / 1.16 : 0))}</span>
            </div>
            <div className="calc-line">
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                IVA Trasladado (16%) <FinancialHelpTooltip concept="iva" />
              </span>
              <span className="mono">{money(fin.invoiceTotal - (fin.saleTotal || (fin.invoiceTotal ? fin.invoiceTotal / 1.16 : 0)))}</span>
            </div>
            <div className="calc-line" style={{ fontWeight: 700 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                Total Factura c/IVA <FinancialHelpTooltip concept="total_con_iva" />
              </span>
              <span className="mono">{money(fin.invoiceTotal)}</span>
            </div>
            <div className="calc-line">
              <span>Costo Maquila (${provName})</span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.costTotal)}</span>
            </div>
            <div className="calc-line">
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                Comisión Contador (8% s/Subtotal) <FinancialHelpTooltip concept="comision_contador" />
              </span>
              <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
            </div>
            <div className="calc-line total" style={{ borderTop: '2px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', fontWeight: 800 }}>
                💰 Margen Neto Real (Sin IVA: $1.56/kg) <FinancialHelpTooltip concept="margen_bruto" />
              </span>
              <span className="mono" style={{ color: 'var(--ok)', fontWeight: 800 }}>
                {money((fin.saleTotal || (fin.invoiceTotal / 1.16)) - (fin.costTotal || 0) - (fin.commission || 0))}
              </span>
            </div>
            <div className="calc-line" style={{ paddingTop: 4, opacity: 0.85, fontSize: 12 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                🏦 Flujo Bruto en Banco (Antes de pagar IVA: $8.44/kg) <FinancialHelpTooltip concept="flujo_caja" />
              </span>
              <span className="mono">
                {money(fin.invoiceTotal - (fin.costTotal || 0) - (fin.commission || 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
