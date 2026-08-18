import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrderModal } from './OrderModalContext';
import { Field, StatusBadge } from '../ui';
import { PasteTextModal } from '../PasteTextModal';
import { OCPreviewModal } from '../OCPreviewModal';
import { fromInputDate, money, toInputDate, kilos } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { confirmDialog } from '../../lib/confirmDialog';
import { parseOrdenDeCompra, type ParsedOC } from '../../lib/ocParser';
import { usePurchases } from '../../hooks/usePurchases';

export default function TabResumen() {
  const ctx = useOrderModal();
  const nav = useNavigate();
  const { purchases } = usePurchases();
  const [pegandoOC, setPegandoOC] = useState(false);
  const [preview, setPreview] = useState<ParsedOC | null>(null);
  if (!ctx) return null;
  const { form, set, readOnly, liveSummary, provName, fallbackSale, fallbackCost, fallbackComm, kilosNum, applyParsedOC, emailClient, toast, setTab, order } = ctx;
  // Vinculo cruzado Andres <-> Providencia (2026-08-11): Purchase.id y
  // PurchaseOrder.id son SIEMPRE el mismo documento (se sincronizan solos
  // via upsertAndresPurchase() al guardar la orden) -- no hace falta
  // ninguna consulta extra, solo confirmar que ya existe la compra ligada
  // antes de ofrecer el atajo (un expediente recien creado, sin guardar
  // todavia, no tiene compra que mostrar).
  const compraLigada = purchases.find((p) => p.id === order.id);

  return (
    <>
            {pegandoOC && (
              <PasteTextModal
                title="Pegar texto de la OC"
                placeholder="Pega aquí el texto completo copiado de la Orden de Compra (OC)…"
                onConfirm={(text) => { setPegandoOC(false); setPreview(parseOrdenDeCompra(text)); }}
                onClose={() => setPegandoOC(false)}
              />
            )}
            {preview && (
              <OCPreviewModal
                parsed={preview}
                onConfirm={() => { applyParsedOC(preview); setPreview(null); }}
                onCancel={() => setPreview(null)}
              />
            )}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn" onClick={() => setPegandoOC(true)} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
                📋 Pegar Texto de OC (Autollenado)
              </button>
            </div>
            <div className="form-grid glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" defaultValue={form.folio} onBlur={(e) => set('folio', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Número de OC (Orden de Compra)">
                <input className="input boxed mono" placeholder="Ej. 120267114014" defaultValue={(form as any).oc} onBlur={(e) => set('oc' as any, e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Cliente">
                <input className="input boxed" list="known-clients" defaultValue={form.client} onBlur={(e) => set('client', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Correo del cliente (opcional)">
                <input className="input boxed" type="email" list="known-client-emails" placeholder="correo@cliente.com"
                  defaultValue={form.clientEmail} onBlur={(e) => set('clientEmail', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Proveedor">
                <input className="input boxed" list="known-providers" defaultValue={form.provider} onBlur={(e) => set('provider', e.target.value)} disabled={readOnly} />
              </Field>
              {/* AGREGADO 2026-08-10 (Iteracion 98): el campo "department" ya
                  existia en el modelo de datos y alimenta el filtro TH/GT del
                  Dashboard Maestro, pero nunca tuvo un campo en este formulario
                  para llenarlo -- por eso ese filtro siempre mostraba "sin
                  ordenes registradas" aunque sí hubiera expedientes TH-xxx/
                  GT-xxx: el nombre del folio es solo una convencion, el campo
                  real quedaba vacio en todos los expedientes. */}
              <Field label="Departamento (opcional)">
                <input className="input boxed" list="known-departments" placeholder="Ej. TH o GT" defaultValue={form.department} onBlur={(e) => set('department', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Kilos Pedidos (Total)">
                <input className="input boxed mono" type="number" step="0.01" defaultValue={form.totalKilograms}
                  onBlur={(e) => set('totalKilograms', e.target.value)} disabled={readOnly} />
              </Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Field label="Fecha Promesa de Entrega">
                  <input className="input boxed mono" type="date" 
                    value={toInputDate(form.estimatedDeliveryDate) || ''}
                    onChange={(e) => {
                      const d = fromInputDate(e.target.value);
                      set('estimatedDeliveryDate', d ? Timestamp.fromDate(d) : null);
                    }} 
                    disabled={readOnly} 
                  />
                </Field>
                <button className="btn" onClick={emailClient} style={{ background: 'var(--info)', color: '#fff', borderColor: 'var(--info)' }}>✉️ Notificar al cliente</button>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <Field label={`Precio Venta Acordado $/kg`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customSellPrice', e.target.value)} defaultValue={form.customSellPrice} disabled={readOnly} placeholder={`Ej. ${fallbackSale}`} />
                </Field>
                <Field label={`Costo Compra (${provName}) $/kg`}>
                  <input className="input boxed mono" type="number" step="0.01"
                    onBlur={(e) => set('customCostPrice', e.target.value)} defaultValue={form.customCostPrice} disabled={readOnly} placeholder={`Ej. ${fallbackCost}`} />
                  {compraLigada && (
                    <button
                      type="button"
                      className="btn"
                      style={{ marginTop: 6, fontSize: 11, padding: '4px 8px', width: '100%' }}
                      onClick={() => nav(`/compras?abrir=${order.id}`)}
                    >
                      🏭 Ver compra en {provName} →
                    </button>
                  )}
                </Field>
                <Field label={`Comisión Contabilidad %`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customCommissionRate', e.target.value)} defaultValue={form.customCommissionRate} disabled={readOnly} placeholder={`Ej. ${fallbackComm * 100}`} />
                </Field>
              </div>
            </div>

            {form.invoices.length > 0 && (() => {
              // Antes, para saber cuantas facturas estaban vencidas, con
              // el contador, o por cobrar, habia que cambiar a la pestaña
              // Facturas y escanear visualmente los grupos -- informacion
              // que se necesita de un vistazo para decidir que atender
              // primero, no despues de un par de clics.
              const conteo = { overdue: 0, pending: 0, paid: 0, collected: 0 };
              for (const inv of form.invoices) {
                const st = inv.creditCycle?.status;
                if (st && st in conteo) conteo[st as keyof typeof conteo]++;
              }
              const chips = [
                { key: 'overdue', label: 'Vencidas', color: 'var(--bad)', bg: '#fef2f2' },
                { key: 'pending', label: 'Por Cobrar', color: 'var(--ink-soft)', bg: 'var(--paper-sunk)' },
                { key: 'paid', label: 'Con el Contador', color: 'var(--warn)', bg: '#fffbeb' },
                { key: 'collected', label: 'Cobradas', color: 'var(--ok)', bg: '#f0fdf4' },
              ] as const;
              return (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
                  {chips.filter(c => conteo[c.key] > 0).map(c => (
                    <button
                      key={c.key}
                      onClick={() => setTab('facturas')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 999,
                        border: `1px solid ${c.color}`, background: c.bg, color: c.color, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {conteo[c.key]} {c.label}
                    </button>
                  ))}
                </div>
              );
            })()}

            <h4 style={{ marginTop: 24, marginBottom: 12 }}>Estado Global</h4>
            <div className="calc-box glass-panel" style={{ padding: '24px', borderRadius: '16px', background: 'var(--glass-bg)', backdropFilter: 'blur(12px)' }}>
              <div className="calc-line">
                <span>Kilos Pedidos</span>
                <span className="mono">{kilos(kilosNum)}</span>
              </div>
              <div className="calc-line">
                <span>Kilos Entregados</span>
                <span className="mono" style={{ color: liveSummary.kilosDelivered < kilosNum ? 'var(--warn)' : 'var(--ok)' }}>
                  {kilos(liveSummary.kilosDelivered)}
                </span>
              </div>
              <div className="calc-line">
                <span>Kilos Pendientes</span>
                <span className="mono" style={{ color: kilosNum - liveSummary.kilosDelivered > 0 ? 'var(--bad)' : 'inherit' }}>
                  {kilosNum - liveSummary.kilosDelivered > 0 ? kilos(kilosNum - liveSummary.kilosDelivered) : '0'}
                </span>
              </div>
              <div className="calc-line">
                <span>Kilos Facturados</span>
                <span className="mono">{kilos(liveSummary.kilosInvoiced)}</span>
              </div>
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
              <div className="calc-line">
                <span>Venta Total (Sin IVA)</span>
                <span className="mono">{money(liveSummary.saleTotal)}</span>
              </div>
              <div className="calc-line">
                <span>Total Facturado (Con IVA)</span>
                <span className="mono">{money(liveSummary.invoiceTotal)}</span>
              </div>
              <div className="calc-line">
                <span>Cobrado</span>
                <span className="mono">{money(liveSummary.paidAmount)}</span>
              </div>
              <div className="calc-line total">
                <span>Deuda Restante</span>
                <span className="mono" style={{ color: liveSummary.invoiceTotal - liveSummary.paidAmount > 0 ? 'var(--bad)' : 'inherit' }}>
                  {money(liveSummary.invoiceTotal - liveSummary.paidAmount)}
                </span>
              </div>
              
              <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid var(--line)' }} />
              
              <div className="calc-line">
                <span>Ganancia Comercial (Devengada)</span>
                {form.customCostPrice && form.customSellPrice ? (
                  <span className="mono" style={{ color: 'var(--ok)' }}>{money(liveSummary.netCashFlow)}</span>
                ) : (
                  <span className="mono" style={{ color: 'var(--warn)', fontSize: '0.85em' }}>Falta costo/venta</span>
                )}
              </div>
              <div className="calc-line">
                <span>Ganancia por Cobros (Realizada)</span>
                <span className="mono" style={{ color: liveSummary.realizedProfit > 0 ? 'var(--ok)' : 'inherit' }}>
                  {money(liveSummary.realizedProfit)}
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
              </div>
              {form.isClosedShort ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge" style={{ background: '#2563eb', color: '#fff', fontWeight: 700 }}>
                    🔒 Concluido con {liveSummary.kilosDelivered.toLocaleString('es-MX')} kg
                  </span>
                  {!readOnly && (
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ fontSize: 11.5, padding: '3px 8px' }}
                      onClick={() => {
                        set('isClosedShort', false);
                        toast('🔓 Pedido reabierto para nuevas entregas.', 'ok');
                      }}
                    >
                      🔓 Reabrir
                    </button>
                  )}
                </div>
              ) : (
                !readOnly && kilosNum - liveSummary.kilosDelivered > 0.01 && liveSummary.kilosDelivered > 0 && (
                  <button 
                    type="button"
                    className="btn btn-primary" 
                    style={{ background: '#0f172a', borderColor: '#0f172a', fontSize: 12, fontWeight: 700 }} 
                    onClick={async () => {
                      if (await confirmDialog(`¿Confirmas concluir y cerrar este pedido con los ${liveSummary.kilosDelivered.toLocaleString('es-MX')} kg entregados?\n\nYa no se esperarán más entregas de ${provName} para esta OC y podrás facturarla al 100%.`)) {
                        set('isClosedShort', true);
                        toast('🔒 Pedido concluido con los kilos entregados. Haz clic en "Guardar cambios".', 'ok');
                      }
                    }}
                  >
                    🔒 Concluir Pedido ({liveSummary.kilosDelivered.toLocaleString('es-MX')} kg)
                  </button>
                )
              )}
            </div>
          </>
  );
}
