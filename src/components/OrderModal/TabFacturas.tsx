import React, { useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { Field, CopyButton } from '../ui';
import { PasteTextModal } from '../PasteTextModal';
import { fromInputDate, money, toInputDate, percent } from '../../lib/format';
import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { addDays } from '../../lib/finance';
import type { OrderStatus } from '../../lib/types';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { sound } from '../../lib/sounds';

export default function TabFacturas() {
  const ctx = useOrderModal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pegando, setPegando] = useState<'factura' | 'complemento' | null>(null);
  
  if (!ctx) return null;
  const { form, readOnly, computedInvoices, order, provName, config, processFacturaText, processParsedXml, processPagoText, toast, addInvoice, updateInvoice, removeInvoice } = ctx;

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseXmlInvoice(text);
        processParsedXml(parsed);
      } catch (err: any) {
        toast(`Error al leer XML: ${err.message}`, 'bad');
      }
    };
    reader.readAsText(file);
  };

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = ''; // Reset input
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Facturas Emitidas</h3>
                <p className="hint" style={{ margin: 0 }}>Facturas vinculadas a este pedido.</p>
              </div>
              {!readOnly && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={handleXmlUpload} />
                  
                  <div 
                    onDrop={handleDrop} 
                    onDragOver={handleDragOver}
                    onClick={() => fileInputRef.current?.click()}
                    style={{ 
                      border: '1px dashed var(--accent)', 
                      borderRadius: 8, 
                      padding: '6px 14px', 
                      background: 'rgba(37,99,235,0.05)', 
                      color: 'var(--accent)', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8, 
                      fontSize: 13,
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(37,99,235,0.05)'}
                  >
                    <span>📄</span>
                    <span>Arrastra o Carga XML</span>
                  </div>

                  <button className="btn" onClick={() => setPegando('factura')} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }}>📋 PEGAR TEXTO (PDF)</button>

                  <button className="btn" onClick={() => setPegando('complemento')} style={{ background: 'var(--bg-card)', border: '1px dashed var(--ok)', color: 'var(--ok)' }}>💰 PEGAR COMPLEMENTO</button>

                  {pegando === 'factura' && (
                    <PasteTextModal
                      title="Pegar texto de la Factura"
                      placeholder="Pega aquí el texto completo copiado del PDF de la Factura…"
                      onConfirm={(text) => processFacturaText(text)}
                      onClose={() => setPegando(null)}
                    />
                  )}
                  {pegando === 'complemento' && (
                    <PasteTextModal
                      title="Pegar texto del Complemento de Pago"
                      placeholder="Pega aquí el texto completo copiado del PDF del Complemento de Pago…"
                      onConfirm={(text) => processPagoText(text)}
                      onClose={() => setPegando(null)}
                    />
                  )}

                  <button className="btn btn-primary" onClick={addInvoice}>+ Manual</button>
                </div>
              )}
            </div>
            {form.invoices.length === 0 ? (
              <div className="empty">
                <span className="empty-icon">🧾</span>
                <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Sin Facturas</strong>
                No hay facturas registradas. Si la IA detecta que este PDF es una factura, la agregará aquí automáticamente.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {computedInvoices.map(({ inv, fin, d, isLate }: any, i: number) => {
                  
                  return (
                    <div key={inv.id} className="card" style={{ padding: 16, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <strong>Factura {inv.folio ? `#${inv.folio}` : '(sin folio)'}</strong>
                        {!readOnly && (
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {inv.creditCycle.status !== 'paid' && inv.creditCycle.status !== 'collected' && (
                              <button className="btn" style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', padding: '4px 10px', fontSize: 13 }}
                                onClick={() => {
                                  sound.playCash();
                                  const invTotal = fin.invoiceTotal;
                                  updateInvoice(i, (x: any) => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'paid' },
                                    collection: { ...x.collection, paidAmount: invTotal, paidAt: Timestamp.now() }
                                  }));
                                  toast('✅ Marcada como cobrada por el cliente. Pendiente de recibir del contador.', 'ok');
                                }}>
                                💰 Cobrada por Cliente
                              </button>
                            )}
                            {inv.creditCycle.status === 'paid' && (
                              <button className="btn" style={{ background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)', padding: '4px 10px', fontSize: 13 }}
                                onClick={async () => {
                                  sound.playCash();
                                  const invTotal = fin.invoiceTotal;
                                  const commission = fin.commission;
                                  const netAmount = invTotal - commission;
                                  // 1. Actualizar estado de la factura
                                  updateInvoice(i, (x: any) => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'collected' },
                                    collection: { ...x.collection, collectedAt: Timestamp.now() }
                                  }));
                                  // 2. Crear ingreso automático en Caja Chica
                                  try {
                                    await addDoc(collection(db, PATHS.expenses), {
                                      date: Timestamp.now(),
                                      concept: `Cobro factura #${inv.folio ?? '?'} (CR: ${inv.collection?.contrareciboNumber ?? '—'})`,
                                      amount: netAmount,
                                      type: 'ingreso',
                                      notes: `Documento: $${(invTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${(commission ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
                                      createdAt: serverTimestamp(),
                                    });
                                    toast(`💵 Recibido del contador. $${netAmount.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA.`, 'ok');
                                  } catch {
                                    toast('Factura marcada, pero error al registrar en CAJA.', 'bad');
                                  }
                                }}>
                                💵 Recibida del Contador → CAJA
                              </button>
                            )}
                            {inv.creditCycle.status === 'collected' && (
                              <span style={{ background: 'var(--ok)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                                ✅ Recibida y en CAJA
                              </span>
                            )}
                            {(inv.creditCycle.status === 'paid' || inv.creditCycle.status === 'collected') && (
                              <button className="btn" style={{ background: 'var(--line)', color: '#333', borderColor: 'var(--line)', padding: '4px 10px', fontSize: 13 }}
                                onClick={() => {
                                  if (inv.creditCycle.status === 'collected') {
                                    if (!window.confirm('Esta factura ya generó un ingreso en CAJA. Si deshaces el cobro, tendrás que ir a borrar el ingreso de CAJA manualmente. ¿Deseas continuar?')) return;
                                  } else {
                                    if (!window.confirm('¿Deshacer el cobro de esta factura? Volverá a estar pendiente de cobro.')) return;
                                  }
                                  updateInvoice(i, (x: any) => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'pending' },
                                    collection: { ...x.collection, paidAmount: 0, paidAt: null, collectedAt: null }
                                  }));
                                  toast('Cobro deshecho. No olvides Guardar el expediente.', 'ok');
                                }}>
                                ↩️ Deshacer Cobro
                              </button>
                            )}
                            <button className="btn btn-danger" onClick={() => removeInvoice(i)}>Eliminar</button>
                          </div>
                        )}
                      </div>
                      <div className="form-grid">
                        <Field label="Folio">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input className="input boxed mono" defaultValue={inv.folio || ''} 
                              onBlur={e => {
                                const val = e.target.value.trim().toUpperCase();
                                if (val.startsWith('GT') || val.startsWith('TH')) {
                                  toast('Error: TH y GT son exclusivas de Contrarecibo. Ingresa un número de factura válido.', 'bad');
                                  e.target.value = inv.folio || '';
                                  return;
                                }
                                updateInvoice(i, (x: any) => ({...x, folio: e.target.value}));
                              }} disabled={readOnly} />
                            {inv.folio && <CopyButton text={inv.folio} />}
                          </div>
                        </Field>
                        <Field label="Kilos Facturados">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.kilos} 
                            onBlur={e => updateInvoice(i, (x: any) => ({...x, kilos: Number(e.target.value)}))} disabled={readOnly} />
                        </Field>
                        <Field label="Contrarecibo (CR)">
                          <div style={{ display: 'flex', gap: 4 }}>
                            <input className="input boxed mono" defaultValue={inv.collection?.contrareciboNumber || ''} 
                              disabled={readOnly}
                              onBlur={e => {
                                let val = e.target.value.trim().toUpperCase();
                                if (val) {
                                  if (val.startsWith('TH-') || val.startsWith('GT-')) val = val.substring(3);
                                  val = `${order.department || 'TH'}-${val}`;
                                }
                                e.target.value = val;
                                updateInvoice(i, (x: any) => ({
                                  ...x, 
                                  collection: { ...x.collection, contrareciboNumber: val }
                                }));
                              }} />
                            {inv.collection?.contrareciboNumber && <CopyButton text={inv.collection?.contrareciboNumber} />}
                          </div>
                        </Field>
                        <Field label="Vencimiento (Promesa)">
                          <input className="input boxed mono" type="date" 
                            value={toInputDate(inv.creditCycle.dueDate) || ''} 
                            onChange={e => {
                              const d = fromInputDate(e.target.value);
                              updateInvoice(i, (x: any) => ({
                                ...x,
                                creditCycle: { ...x.creditCycle, dueDate: d ? Timestamp.fromDate(d) : null }
                              }));
                            }} disabled={readOnly} />
                        </Field>
                        <Field label="Estado">
                          <select className="input boxed" value={inv.creditCycle.status}
                            disabled={readOnly}
                            onChange={(e) => updateInvoice(i, (x: any) => ({
                              ...x, 
                              creditCycle: { ...x.creditCycle, status: e.target.value as OrderStatus }
                            }))}>
                            <option value="pending">Por cobrar</option>
                              <option value="paid">🟡 Con el contador</option>
                              <option value="collected">✅ Recibida</option>
                              <option value="overdue">Vencida</option>
                              <option value="manual_review">Revisión manual</option>
                          </select>
                          <div style={{ color: 'var(--bad)', fontWeight: 'bold', fontSize: '12px', marginTop: 4, minHeight: 18, visibility: isLate ? 'visible' : 'hidden' }}>
                            {isLate ? `⚠️ ${d} días de atraso` : ' '}
                          </div>
                        </Field>
                        <Field label="Emisión">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.creditCycle.issueDate) || ''}
                            disabled={readOnly}
                            onChange={(e) => {
                              const issue = fromInputDate(e.target.value);
                              if (issue) {
                                const due = addDays(issue, config.creditDays);
                                updateInvoice(i, (x: any) => ({
                                  ...x, 
                                  creditCycle: { 
                                    ...x.creditCycle, 
                                    issueDate: Timestamp.fromDate(issue),
                                    dueDate: Timestamp.fromDate(due)
                                  }
                                }));
                              }
                            }} />
                        </Field>
                        <Field label="Vence">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.creditCycle.dueDate) || ''}
                            disabled={readOnly}
                            onChange={(e) => {
                              const due = fromInputDate(e.target.value);
                              if (due) {
                                updateInvoice(i, (x: any) => ({
                                  ...x, 
                                  creditCycle: { ...x.creditCycle, dueDate: Timestamp.fromDate(due) }
                                }));
                              }
                            }} />
                        </Field>
                        <Field label="Fecha Contrarecibo">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.contrareciboDate) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const cd = fromInputDate(e.target.value);
                              updateInvoice(i, (x: any) => ({
                                ...x, collection: { ...x.collection, contrareciboDate: cd ? Timestamp.fromDate(cd) : null }
                              }))
                            }} />
                        </Field>
                        <Field label="Monto Cobrado">
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input className="input boxed mono" type="number" step="0.01" 
                              value={inv.collection?.paidAmount !== undefined ? inv.collection.paidAmount : ''}
                              disabled={readOnly}
                              onChange={e => updateInvoice(i, (x: any) => ({
                                ...x, collection: { ...x.collection, paidAmount: Number(e.target.value) }
                              }))} 
                              style={{ flex: 1 }}
                            />
                            {(!readOnly && (fin.invoiceTotal - (inv.collection?.paidAmount || 0)) > 0) && (
                              <button
                                type="button"
                                className="btn"
                                style={{ 
                                  background: 'var(--accent-tint)', 
                                  color: 'var(--accent)', 
                                  borderColor: 'var(--accent)', 
                                  padding: '0 12px', 
                                  height: '38px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  animation: 'pulse 2s infinite'
                                }}
                                onClick={() => {
                                  updateInvoice(i, (x: any) => ({
                                    ...x, collection: { ...x.collection, paidAmount: fin.invoiceTotal }
                                  }));
                                }}
                              >
                                ✨ Liquidar {money(fin.invoiceTotal - (inv.collection?.paidAmount || 0))}
                              </button>
                            )}
                          </div>
                        </Field>
                        <Field label="Fecha de Cobro">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.paidAt) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const pa = fromInputDate(e.target.value);
                              updateInvoice(i, (x: any) => ({
                                ...x, collection: { ...x.collection, paidAt: pa ? Timestamp.fromDate(pa) : null }
                              }))
                            }} />
                        </Field>
                        <Field label="Comisión Contador ($)">
                          <input className="input boxed mono" type="number" step="0.01" defaultValue={inv.financials?.commission ?? fin.commission}
                            disabled={readOnly}
                            onBlur={e => {
                              const val = Number(e.target.value);
                              updateInvoice(i, (x: any) => ({
                                ...x,
                                financials: {
                                  ...(x.financials ?? fin),
                                  commission: val,
                                }
                              }));
                            }} />
                          <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4 }}>
                            {inv.financials?.commission !== undefined ? '⚠️ Comisión personalizada para esta factura' : `Auto: ${percent(config.commissionRate)} s/subtotal`}
                          </div>
                        </Field>
                        {(inv.creditCycle.status === 'paid' || inv.creditCycle.status === 'collected') && (
                          <Field label="Complemento de Pago (SAT)">
                            <select
                              className="input boxed"
                              disabled={readOnly}
                              value={inv.collection?.complementStatus ?? 'pending'}
                              onChange={e => updateInvoice(i, (x: any) => ({
                                ...x, collection: { ...x.collection, complementStatus: e.target.value as 'pending' | 'issued' | 'na' }
                              }))}
                            >
                              <option value="pending">⏳ Pendiente de emitir</option>
                              <option value="issued">✅ Emitido y enviado</option>
                              <option value="na">— No aplica</option>
                            </select>
                            {inv.collection?.complementStatus === 'pending' && (
                              <div style={{ fontSize: 11, color: 'var(--bad)', marginTop: 4, fontWeight: 600 }}>
                                ⚠️ Recuerda emitir el complemento de pago al SAT y enviarlo al cliente.
                              </div>
                            )}
                            {inv.collection?.complementStatus === 'issued' && (
                              <div style={{ fontSize: 11, color: 'var(--ok)', marginTop: 4, fontWeight: 600 }}>
                                ✅ Complemento emitido y enviado al cliente.
                              </div>
                            )}
                          </Field>
                        )}
                      </div>
                      <div className="calc-box" style={{ marginTop: 12 }}>
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
                          <strong className="mono">{money(fin.invoiceTotal - fin.costTotal)}</strong>
                        </div>
                        <div className="calc-line">
                          <span>Comisión del Contador</span>
                          <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
                        </div>
                        <div className="calc-line total" style={{ borderTop: '2px solid var(--line)', paddingTop: 6, marginTop: 6 }}>
                          <span>💰 UTILIDAD NETA (Ganancia Real)</span>
                          <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - fin.costTotal - fin.commission)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
  );
}
