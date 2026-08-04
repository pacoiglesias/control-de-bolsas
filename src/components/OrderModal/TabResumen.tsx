import { useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { Field, StatusBadge } from '../ui';
import { PasteTextModal } from '../PasteTextModal';
import { fromInputDate, money, toInputDate, kilos } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';

export default function TabResumen() {
  const ctx = useOrderModal();
  const [pegandoOC, setPegandoOC] = useState(false);
  if (!ctx) return null;
  const { form, set, readOnly, liveSummary, provName, fallbackSale, fallbackCost, fallbackComm, kilosNum, parseOCAndFill, emailClient, toast } = ctx;

  return (
    <>
            {pegandoOC && (
              <PasteTextModal
                title="Pegar texto de la OC"
                placeholder="Pega aquí el texto completo copiado de la Orden de Compra (OC)…"
                onConfirm={(text) => parseOCAndFill(text)}
                onClose={() => setPegandoOC(false)}
              />
            )}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn" onClick={() => setPegandoOC(true)} style={{ background: 'var(--accent)', color: '#fff', fontWeight: 600 }}>
                📋 Pegar Texto de OC (Autollenado)
              </button>
            </div>
            <div className="form-grid">
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" defaultValue={form.folio} onBlur={(e) => set('folio', e.target.value)} disabled={readOnly} />
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
                </Field>
                <Field label={`Comisión Contabilidad %`}>
                  <input className="input boxed mono" type="number" step="0.01" 
                    onBlur={(e) => set('customCommissionRate', e.target.value)} defaultValue={form.customCommissionRate} disabled={readOnly} placeholder={`Ej. ${fallbackComm * 100}`} />
                </Field>
              </div>
            </div>

            <h4 style={{ marginTop: 24, marginBottom: 12 }}>Estado Global</h4>
            <div className="calc-box">
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
            
            <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
              </div>
              {form.isClosedShort && <span className="badge badge-warn">🔒 Cierre Forzado</span>}
              {!form.isClosedShort && liveSummary.status === 'pending' && kilosNum - liveSummary.kilosDelivered > 0 && (
                <button className="btn btn-primary" style={{ background: 'var(--ink)', borderColor: 'var(--ink)', fontSize: 12 }} onClick={() => {
                  if (window.confirm('¿Seguro que deseas forzar el cierre de esta Orden? Ya no aparecerá como pendiente en almacén aunque falten kilos.')) {
                    set('isClosedShort', true);
                    toast('Orden marcada para cierre. Haz clic en Guardar Cambios.', 'ok');
                  }
                }}>
                  🔒 Forzar Cierre (Faltan Kilos)
                </button>
              )}
            </div>
          </>
  );
}
