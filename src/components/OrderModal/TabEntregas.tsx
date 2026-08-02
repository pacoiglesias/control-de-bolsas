// @ts-nocheck
import React from 'react';
import { useOrderModal } from './OrderModalContext';
import { Field, StatusBadge } from '../ui';
import { escapeHtml, fromInputDate, money, toInputDate, kilos, percent, fmtDate, fmtDateTime } from '../../lib/format';
import { Timestamp } from 'firebase/firestore';
import { OrderStatus, Invoice, Delivery, PurchaseOrderItem } from '../../lib/types';
import { camposInvoices } from '../../lib/invoiceOps';

export default function TabEntregas() {
  const ctx = useOrderModal();
  if (!ctx) return null;
  const { form, setForm, set, readOnly, dynamicConfig, liveSummary, computedInvoices, order, allOrders, knownClients, knownProviders, knownClientEmails, provName, config, fallbackSale, fallbackCost, fallbackComm, kilosNum, kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem, processFacturaText, processPagoText, parseOCAndFill, emailClient, toast, addItem, updateItem, removeItem, addDelivery, updateDelivery, updateDeliveryItemQty, removeDelivery, addInvoice, updateInvoice, removeInvoice, facturarEntrega, printRemision, printPreFactura, printConsolidatedPackage } = ctx;

  return (
    <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h4 style={{ margin: 0 }}>Registro de Entregas</h4>
                <p className="hint" style={{ margin: '4px 0 0' }}>
                  Cada vez que {provName} entrega, se captura como un evento con fecha y cantidades por producto.
                  Entregado en total: <strong>{kilosEntregados.toLocaleString('es-MX')} kg</strong> de {kilosPedidos.toLocaleString('es-MX')} kg pedidos
                  {kilosFaltantes > 0.01 && <span style={{ color: 'var(--warn)' }}> · faltan {kilosFaltantes.toLocaleString('es-MX')} kg</span>}
                </p>
              </div>
              {!readOnly && form.items.length > 0 && <button className="btn btn-primary" onClick={addDelivery}>+ Nueva Entrega</button>}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">Captura primero los productos de la OC en la pestaña Productos.</p>
            ) : form.deliveries.length === 0 ? (
              <p className="hint">No hay entregas registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.deliveries.map((d, i) => {
                  const kilosDeEsta = round2((d.items ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0) || d.kilos || 0);
                  return (
                    <div key={d.id} style={{ border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <input className="input boxed mono" type="date"
                            defaultValue={toInputDate(d.date) || ''}
                            onBlur={e => {
                              const date = fromInputDate(e.target.value);
                              updateDelivery(i, 'date', date ? Timestamp.fromDate(date) : null);
                            }}
                            disabled={readOnly || d.invoiced}
                          />
                          {d.invoiced ? (
                            <span className="badge badge-ok">✅ Facturada</span>
                          ) : (
                            <span className="badge badge-warn">📝 Pendiente de facturar</span>
                          )}
                          <strong className="mono">{kilosDeEsta.toLocaleString('es-MX')} kg</strong>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {!readOnly && !d.invoiced && kilosDeEsta > 0 && (
                            <button className="btn btn-primary" onClick={() => facturarEntrega(i)}>🧾 Facturar esta entrega</button>
                          )}
                          {!readOnly && !d.invoiced && (
                            <button className="btn btn-danger" onClick={() => removeDelivery(i)}>Eliminar</button>
                          )}
                        </div>
                      </div>
                      <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr><th>Producto</th><th className="num">Pedido</th><th className="num">Entregado (esta vez)</th></tr>
                        </thead>
                        <tbody>
                          {form.items.map((it) => {
                            const qtyEnEsta = (d.items ?? []).find((x) => x.itemId === it.id)?.quantity ?? 0;
                            return (
                              <tr key={it.id}>
                                <td>{it.description || it.code || '(sin descripción)'}</td>
                                <td className="num mono">{it.quantity.toLocaleString('es-MX')}</td>
                                <td className="num">
                                  <input className="input boxed mono" type="number" step="0.01" style={{ width: 90 }}
                                    defaultValue={qtyEnEsta}
                                    onBlur={e => updateDeliveryItemQty(i, it.id, Number(e.target.value))}
                                    disabled={readOnly || d.invoiced}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      <input className="input boxed" type="text" style={{ width: '100%', marginTop: 8 }}
                        placeholder="Notas de esta entrega (opcional)"
                        defaultValue={d.notes || ''}
                        onBlur={e => updateDelivery(i, 'notes', e.target.value)}
                        disabled={readOnly || d.invoiced}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  );
}
