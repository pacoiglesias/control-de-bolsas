// @ts-nocheck
import React from 'react';
import { useOrderModal } from './OrderModalContext';
import { Field, StatusBadge } from '../ui';
import { escapeHtml, fromInputDate, money, toInputDate, kilos, percent, fmtDate, fmtDateTime } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { OrderStatus, Invoice, Delivery, PurchaseOrderItem } from '../../lib/types';
import { camposInvoices } from '../../lib/invoiceOps';

export default function TabResumen() {
  const ctx = useOrderModal();
  if (!ctx) return null;
  const { form, setForm, set, readOnly, dynamicConfig, liveSummary, computedInvoices, order, allOrders, knownClients, knownProviders, knownClientEmails, provName, config, fallbackSale, fallbackCost, fallbackComm, kilosNum, kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem, processFacturaText, processPagoText, parseOCAndFill, emailClient, toast, addItem, updateItem, removeItem, addDelivery, updateDelivery, updateDeliveryItemQty, removeDelivery, addInvoice, updateInvoice, removeInvoice, facturarEntrega, printRemision, printPreFactura, printConsolidatedPackage } = ctx;

  return (
    <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <button className="btn" onClick={parseOCAndFill} style={{ background: 'var(--brand-light)', color: 'var(--brand-dark)', fontWeight: 600 }}>
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
                  <span className="mono" style={{ color: 'var(--ok)' }}>{money(liveSummary.tradeMargin)}</span>
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
            
            <div style={{ marginTop: 16 }}>
              <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
            </div>
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  );
}
