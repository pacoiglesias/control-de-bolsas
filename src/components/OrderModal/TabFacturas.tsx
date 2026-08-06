import React, { useEffect, useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { Field, CopyButton } from '../ui';
import { PasteTextModal } from '../PasteTextModal';
import { fromInputDate, money, toInputDate, percent } from '../../lib/format';
import { Timestamp, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { addDays, round2 } from '../../lib/finance';
import type { OrderStatus } from '../../lib/types';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { sound } from '../../lib/sounds';
import { GenAIReader } from '../GenAIReader';

export default function TabFacturas() {
  const ctx = useOrderModal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pegando, setPegando] = useState<'factura' | 'complemento' | null>(null);

  // Antes CADA factura se mostraba siempre completamente desplegada --
  // con todos sus campos y botones a la vez. Con 12 facturas en un mismo
  // expediente (caso real), eso eran cientos de campos en pantalla de
  // golpe, sin importar que solo quisieras ver una. Ahora cada tarjeta
  // empieza colapsada, mostrando solo un resumen de una linea (folio,
  // CR, monto, estado) -- se expande individualmente con un clic. La
  // que se abrio con foco especifico (ver efecto de abajo) empieza ya
  // expandida, para no perder ese comportamiento.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpandida = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Al abrir el modal desde una tarjeta especifica del tablero de
  // Cobranza, el expediente puede traer varias facturas juntas -- sin
  // esto, el usuario tenia que buscar a mano cual era la que le
  // interesaba entre todas las demas. Este efecto la encuentra, la
  // expande, y le hace scroll automatico apenas se abre la pestaña. Va
  // antes del "if (!ctx) return null" de abajo porque los Hooks de React
  // siempre deben llamarse en el mismo orden, sin condicionales por
  // delante.
  const focusInvoiceId = ctx?.focusInvoiceId ?? null;
  useEffect(() => {
    if (!focusInvoiceId) return;
    setExpandedIds(prev => new Set(prev).add(focusInvoiceId));
    // El setTimeout espera un tick a que React termine de pintar la
    // tarjeta ya expandida en el DOM -- sin esto, el input de folio
    // todavia no existiria en el momento de intentar enfocarlo.
    const t = setTimeout(() => {
      const el = document.getElementById(`factura-card-${focusInvoiceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // El campo de Folio es el primer input de texto de la tarjeta --
      // se enfoca solo, listo para escribir, sin que el usuario tenga
      // que hacer clic primero. Ahorra un paso en el caso mas comun:
      // crear una factura nueva y capturar su folio de inmediato.
      const inputFolio = el?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null;
      inputFolio?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [focusInvoiceId]);

  if (!ctx) return null;
  const { form, readOnly, computedInvoices, order, provName, config, processFacturaText, processParsedXml, processPagoText, toast, addInvoice, updateInvoice, removeInvoice, allOrders, kilosPendientesDeFacturar } = ctx;

  /**
   * Ningun numero de Contrarecibo, Folio de factura, u OC debe repetirse
   * entre expedientes distintos -- antes no habia ninguna validacion para
   * esto (asi fue como un CR de prueba como "333333" se pudo colar sin
   * ningun aviso). Avisa, no bloquea -- puede haber casos legitimos donde
   * el usuario sabe lo que hace y quiere continuar de todos modos.
   */
  function avisarSiCrDuplicado(cr: string, invoiceIdActual: string) {
    if (!cr) return true;
    for (const o of allOrders) {
      for (const inv of o.invoices ?? []) {
        if (inv.id === invoiceIdActual) continue;
        if ((inv.collection?.contrareciboNumber || '').toUpperCase() === cr.toUpperCase()) {
          return window.confirm(
            `El contrarecibo "${cr}" ya existe en otro expediente (folio: ${o.folio || o.oc || '(sin folio)'}, cliente: ${o.client || '—'}). ` +
            `¿Seguro que quieres usar el mismo número aquí también?`,
          );
        }
      }
    }
    return true;
  }

  function avisarSiFolioFacturaDuplicado(folio: string, invoiceIdActual: string) {
    if (!folio) return true;
    for (const o of allOrders) {
      for (const inv of o.invoices ?? []) {
        if (inv.id === invoiceIdActual) continue;
        if ((inv.folio || '').toUpperCase() === folio.toUpperCase()) {
          return window.confirm(
            `El número de factura "${folio}" ya existe en otro expediente (folio: ${o.folio || o.oc || '(sin folio)'}, cliente: ${o.client || '—'}). ` +
            `¿Seguro que quieres usar el mismo número aquí también?`,
          );
        }
      }
    }
    return true;
  }

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

  function renderFacturaCard({ inv, fin, d, isLate, i }: any) {
    const enFoco = inv.id === focusInvoiceId;
    const expandida = expandedIds.has(inv.id);
    return (
                    <div
                      key={inv.id}
                      id={`factura-card-${inv.id}`}
                      className="card"
                      style={{
                        padding: 16,
                        border: enFoco ? '2px solid var(--accent)' : '1px solid var(--line)',
                        background: enFoco ? 'var(--accent-tint)' : undefined,
                        transition: 'background 1.2s ease, border-color 1.2s ease',
                      }}
                    >
                      <div
                        onClick={() => toggleExpandida(inv.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <strong>Factura {inv.folio ? `#${inv.folio}` : '(sin folio)'}</strong>
                          {inv.collection?.contrareciboNumber && (
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: 4 }}>
                              CR: {inv.collection.contrareciboNumber}
                            </span>
                          )}
                          <span className="mono">{money(fin.invoiceTotal)}</span>
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                            {inv.creditCycle.status === 'collected' ? '✅ En Caja' : inv.creditCycle.status === 'paid' ? '🟡 Con el Contador' : isLate ? '🔴 Vencida' : '⏳ Por Cobrar'}
                          </span>
                        </div>
                        <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{expandida ? '▲ Ocultar' : '▼ Ver detalles'}</span>
                      </div>
                      {expandida && (<>
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
                                  const invTotal = fin.invoiceTotal;
                                  const commission = fin.commission;
                                  const netEsperado = invTotal - commission;
                                  // Antes se calculaba el monto esperado y se
                                  // guardaba en Caja como si fuera lo que
                                  // realmente entro, sin preguntar nunca. Si
                                  // el contador aplica una comision distinta
                                  // (confirmado: pasa, 6.897% real vs 6.9%
                                  // configurado), el sistema nunca se
                                  // enteraba de la diferencia. Ahora se
                                  // pregunta, con lo esperado ya puesto --
                                  // un clic si coincide, se corrige si no.
                                  const respuesta = window.prompt(
                                    `Esperado (con comisión de ${(commission / invTotal * 100).toFixed(3)}%): $${netEsperado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n¿Cuánto recibiste realmente en Caja?`,
                                    netEsperado.toFixed(2)
                                  );
                                  if (respuesta === null) return; // cancelado
                                  const netReal = Number(respuesta.replace(/[^0-9.-]/g, ''));
                                  if (isNaN(netReal) || netReal <= 0) {
                                    toast('Monto inválido, no se registró nada.', 'bad');
                                    return;
                                  }
                                  const diferencia = round2(netReal - netEsperado);
                                  sound.playCash();
                                  // 1. Actualizar estado de la factura
                                  updateInvoice(i, (x: any) => ({
                                    ...x,
                                    creditCycle: { ...x.creditCycle, status: 'collected' },
                                    collection: { ...x.collection, collectedAt: Timestamp.now() }
                                  }));
                                  // 2. Crear ingreso automático en Caja Chica -- con el
                                  // monto REAL confirmado, no el calculado a ciegas.
                                  try {
                                    await addDoc(collection(db, PATHS.expenses), {
                                      date: Timestamp.now(),
                                      concept: `Cobro factura #${inv.folio ?? '?'} (CR: ${inv.collection?.contrareciboNumber ?? '—'})`,
                                      amount: netReal,
                                      type: 'ingreso',
                                      notes: `Documento: $${(invTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${(commission ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
                                      montoEsperado: round2(netEsperado),
                                      montoReal: round2(netReal),
                                      diferencia,
                                      createdAt: serverTimestamp(),
                                    });
                                    if (Math.abs(diferencia) > 0.01) {
                                      toast(`💵 $${netReal.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA. ⚠️ Diferencia vs esperado: ${diferencia > 0 ? '+' : ''}$${diferencia.toLocaleString('es-MX', {minimumFractionDigits:2})}`, 'ok');
                                    } else {
                                      toast(`💵 Recibido del contador. $${netReal.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA.`, 'ok');
                                    }
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
                                if (val && !avisarSiFolioFacturaDuplicado(val, inv.id)) {
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
                                  // ANTES: aqui SIEMPRE se reescribia el
                                  // prefijo usando order.department, sin
                                  // importar que el usuario ya hubiera
                                  // escrito uno valido (TH- o GT-). Para
                                  // expedientes sin departamento fijo (como
                                  // uno que agrupa contrarecibos de ambos,
                                  // el caso real de este sistema), CUALQUIER
                                  // correccion a un CR se revertia sola al
                                  // salir del campo -- si escribias
                                  // "GT-597", el sistema lo convertia en
                                  // "TH-597" porque el expediente no tiene
                                  // un department unico. Ahora se respeta
                                  // el prefijo que el usuario ya escribio.
                                  const yaTienePrefijo = /^(TH|GT)-/.test(val);
                                  if (!yaTienePrefijo) {
                                    val = `${order.department || 'TH'}-${val}`;
                                  }
                                }
                                if (val && !avisarSiCrDuplicado(val, inv.id)) {
                                  return; // El usuario cancelo -- no se guarda el valor duplicado
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
                      </>)}
                    </div>
    );
  }

  return (
    <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>Facturas Emitidas</h3>
                <p className="hint" style={{ margin: 0 }}>Facturas vinculadas a este pedido.</p>
              </div>
              {!readOnly && (
                <>
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-primary" onClick={addInvoice}>+ Manual</button>
                    {kilosPendientesDeFacturar > 0.01 && (
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                        Sugerido: {kilosPendientesDeFacturar.toLocaleString('es-MX')} kg
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 24, padding: '24px 0', borderTop: '1px solid var(--line)' }}>
                  <GenAIReader 
                    onDataExtracted={(data) => {
                      if (data.folio) {
                        toast(`Lector Inteligente detectó la factura ${data.folio}. Añadiendo a la lista...`, 'ok');
                        addInvoice();
                        setTimeout(() => {
                           toast(`Usa el folio ${data.folio} por $${data.total || data.subtotal} en la nueva factura vacía`, 'info');
                        }, 500);
                      }
                    }} 
                  />
                </div>
                </>
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
                {(() => {
                  // Antes las facturas se mostraban en una sola lista
                  // plana, sin ningun orden -- con varias facturas en
                  // estados distintos (por cobrar, con el contador,
                  // cobradas) mezcladas, se sentia desordenado. Se
                  // reordenan por estado y se inserta un encabezado de
                  // seccion cuando cambia el grupo -- mismo dato, mismas
                  // tarjetas, sin tocar su contenido interno, solo mas
                  // facil de leer de un vistazo.
                  const ORDEN_ESTADO: Record<string, number> = { overdue: 0, pending: 0, paid: 1, collected: 2 };
                  const TITULO_SECCION: Record<string, string> = {
                    pending: '🔴 Por Cobrar', overdue: '🔴 Por Cobrar',
                    paid: '🟡 Con el Contador', collected: '✅ Cobradas',
                  };
                  const ordenadas = [...computedInvoices].sort(
                    (a: any, b: any) => (ORDEN_ESTADO[a.inv.creditCycle.status] ?? 9) - (ORDEN_ESTADO[b.inv.creditCycle.status] ?? 9)
                  );
                  return ordenadas.map((item: any, i: number) => {
                    const { inv, fin, d, isLate } = item;
                    const statusActual = inv.creditCycle.status;
                    const statusAnterior = i > 0 ? ordenadas[i - 1].inv.creditCycle.status : null;
                    const grupoActual = TITULO_SECCION[statusActual] || 'Otras';
                    const grupoAnterior = statusAnterior ? (TITULO_SECCION[statusAnterior] || 'Otras') : null;
                    const nuevaSeccion = grupoActual !== grupoAnterior;
                    return (
                      <React.Fragment key={inv.id}>
                        {nuevaSeccion && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginTop: i > 0 ? 8 : 0, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
                            {grupoActual}
                          </div>
                        )}
                        {renderFacturaCard({ inv, fin, d, isLate, i })}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>
            )}
          </>
  );
}
