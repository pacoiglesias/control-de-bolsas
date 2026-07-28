import { useState, useMemo } from 'react';
import { deleteDoc, doc, serverTimestamp, Timestamp, setDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { Field, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials, addDays, getOrderSummary } from '../lib/finance';
import { fromInputDate, money, toInputDate, kilos } from '../lib/format';
import type { FinancialConfig, OrderStatus, PurchaseOrder, Invoice, Delivery, PurchaseOrderItem } from '../lib/types';

export default function OrderModal({
  order,
  config,
  onClose,
  readOnly = false,
  initialTab = 'resumen',
}: {
  order: PurchaseOrder;
  config: FinancialConfig;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: 'resumen' | 'entregas' | 'facturas';
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'resumen' | 'entregas' | 'facturas'>(initialTab);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    deliveries: initialSummary.deliveries,
    invoices: initialSummary.invoices,
    items: order.items ?? [],
  });

  const set = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const kilosNum = Number(form.totalKilograms) || 0;

  // Calculate live summary based on form state
  const liveSummary = useMemo(() => {
    // We construct a fake order object to pass to getOrderSummary
    const tempOrder: PurchaseOrder = {
      ...order,
      folio: form.folio,
      totalKilograms: kilosNum,
      deliveries: form.deliveries,
      invoices: form.invoices,
    };
    return getOrderSummary(tempOrder);
  }, [order, form, kilosNum]);

  async function save() {
    if (kilosNum <= 0) {
      toast('Los kilos totales del pedido deben ser mayores a cero.', 'bad');
      return;
    }
    setBusy(true);
    try {
      const ref = doc(db, PATHS.orders, order.id);
      
      // Compute financials for all invoices just in case
      // Recalculate financials using historical snapshot if available to prevent history tampering
      const updatedInvoices = form.invoices.map(inv => {
        const snapshotCfg = inv.financials ? {
          salePricePerKg: inv.financials.salePricePerKg || config.salePricePerKg,
          costPricePerKg: inv.financials.costPricePerKg || config.costPricePerKg,
          commissionRate: inv.financials.commissionRate ?? config.commissionRate,
          ivaRate: config.ivaRate,
          commissionBase: config.commissionBase,
          creditDays: config.creditDays
        } : config;

        return {
          ...inv,
          financials: computeFinancials(inv.kilos, snapshotCfg)
        };
      });

      await setDoc(ref, {
        folio: form.folio.trim(),
        client: form.client.trim(),
        department: form.department.trim(),
        provider: form.provider.trim(),
        totalKilograms: kilosNum,
        estimatedDeliveryDate: form.estimatedDeliveryDate,
        deliveries: form.deliveries,
        invoices: updatedInvoices,
        items: form.items,
        updatedAt: serverTimestamp(),
        processedAt: order.processedAt ?? serverTimestamp(),
      }, { merge: true });
      logAction(user?.email, 'Expediente Guardado', {
        orderId: order.id,
        folio: form.folio,
        kilos: kilosNum,
        facturas: updatedInvoices.length,
        cobrado: liveSummary.paidAmount,
      });
      toast('Expediente actualizado', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo guardar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  function emailClient() {
    const dateStr = form.estimatedDeliveryDate ? form.estimatedDeliveryDate.toDate().toLocaleDateString() : '(por definir)';
    const subject = encodeURIComponent(`Confirmación de Entrega - Pedido #${form.folio || 'S/N'}`);
    const body = encodeURIComponent(`Estimado cliente,\n\nLe informamos que su pedido #${form.folio || 'S/N'} por la cantidad de ${kilosNum} kg tiene una fecha estimada de entrega para el ${dateStr}.\n\nSaludos,\nProvidencia`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  function printRemision() {
    const html = `
      <html>
        <head>
          <title>Remisión de Entrega - ${form.folio}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #111; }
            h1 { border-bottom: 2px solid #000; padding-bottom: 10px; }
            .meta { margin-bottom: 40px; display: grid; grid-template-columns: 1fr 1fr; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ccc; padding: 12px; text-align: left; }
            th { background: #eee; }
            .signature { margin-top: 80px; text-align: center; width: 300px; }
            .signature div { border-top: 1px solid #000; padding-top: 8px; }
          </style>
        </head>
        <body>
          <h1>REMISIÓN DE ENTREGA</h1>
          <div class="meta">
            <div>
              <strong>Folio:</strong> ${form.folio || '(Sin folio)'}<br>
              <strong>Cliente:</strong> ${form.client}<br>
              <strong>Departamento:</strong> ${form.department || '—'}<br>
            </div>
            <div style="text-align: right;">
              <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}<br>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th style="text-align: right;">Cantidad (kg)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Bolsa Plástica - Pedido Completo</td>
                <td style="text-align: right;">${kilosNum}</td>
              </tr>
            </tbody>
          </table>
          <div class="signature">
            <br><br><br>
            <div>Nombre y Firma de Recibido</div>
          </div>
          <script>
            window.onload = () => { window.print(); window.setTimeout(() => window.close(), 500); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  async function remove() {
    if (!window.confirm(`¿Eliminar el expediente ${order.folio ?? ''}? Esto no se puede deshacer.`))
      return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, PATHS.orders, order.id));
      logAction(user?.email, 'Expediente Eliminado', {
        orderId: order.id,
        folio: order.folio ?? '',
        saleTotal: initialSummary.saleTotal,
        paidAmount: initialSummary.paidAmount,
      });
      toast('Expediente eliminado', 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo eliminar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  // --- Handlers for Items ---
  const addItem = () => {
    set('items', [
      ...form.items,
      { id: Date.now().toString(), quantity: 0, unit: 'Kilos', description: '', unitPrice: config.salePricePerKg, amount: 0 }
    ]);
  };
  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    const next = [...form.items];
    next[index] = { ...next[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      next[index].amount = Number((next[index].quantity * next[index].unitPrice).toFixed(2));
    }
    set('items', next);
  };
  const removeItem = (index: number) => {
    if (window.confirm('¿Eliminar este artículo?')) {
      const next = [...form.items];
      next.splice(index, 1);
      set('items', next);
    }
  };

  // --- Handlers for Deliveries ---
  const addDelivery = () => {
    set('deliveries', [
      ...form.deliveries,
      { id: Date.now().toString(), date: Timestamp.now(), kilos: 0, notes: '' }
    ]);
  };
  const updateDelivery = (index: number, field: keyof Delivery, value: any) => {
    const next = [...form.deliveries];
    next[index] = { ...next[index], [field]: value };
    set('deliveries', next);
  };
  const removeDelivery = (index: number) => {
    if (window.confirm('¿Eliminar esta entrega?')) {
      const next = [...form.deliveries];
      next.splice(index, 1);
      set('deliveries', next);
    }
  };

  // --- Handlers for Invoices ---
  const addInvoice = () => {
    const issue = new Date();
    const due = addDays(issue, config.creditDays);
    set('invoices', [
      ...form.invoices,
      { 
        id: Date.now().toString(), 
        folio: '', 
        kilos: 0, 
        creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
        collection: { paidAmount: 0, contrareciboNumber: '', notes: '' }
      }
    ]);
  };
  const updateInvoice = (index: number, updateFn: (inv: Invoice) => Invoice) => {
    const next = [...form.invoices];
    next[index] = updateFn(next[index]);
    set('invoices', next);
  };
  const removeInvoice = (index: number) => {
    if (window.confirm('¿Eliminar esta factura?')) {
      const next = [...form.invoices];
      next.splice(index, 1);
      set('invoices', next);
    }
  };

  return (
    <Modal wide title={`Expediente ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        <button className={`btn ${tab === 'resumen' ? 'btn-primary' : ''}`} onClick={() => setTab('resumen')}>Resumen</button>
        <button className={`btn ${tab === 'entregas' ? 'btn-primary' : ''}`} onClick={() => setTab('entregas')}>
          Entregas <span className="badge">{form.deliveries.length}</span>
        </button>
        <button className={`btn ${tab === 'facturas' ? 'btn-primary' : ''}`} onClick={() => setTab('facturas')}>
          Facturas <span className="badge">{form.invoices.length}</span>
        </button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ minHeight: '50vh', maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        
        {/* RESUMEN */}
        {tab === 'resumen' && (
          <>
            <div className="form-grid">
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" value={form.folio} onChange={(e) => set('folio', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Cliente">
                <input className="input boxed" value={form.client} onChange={(e) => set('client', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Proveedor">
                <input className="input boxed" value={form.provider} onChange={(e) => set('provider', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Kilos Pedidos (Total)">
                <input className="input boxed mono" type="number" step="0.01" value={form.totalKilograms}
                  onChange={(e) => set('totalKilograms', e.target.value)} disabled={readOnly} />
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
            </div>

            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h4>Detalle de Artículos (Partidas)</h4>
              {!readOnly && <button className="btn btn-primary" onClick={addItem}>+ Agregar Artículo</button>}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">No hay artículos detallados. Agrega uno o espera a la IA.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th className="num">Cantidad</th>
                      <th>Unidad</th>
                      <th>Descripción</th>
                      <th className="num">P. Unitario</th>
                      <th className="num">Importe</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, i) => (
                      <tr key={it.id}>
                        <td className="num">
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 80 }}
                            value={it.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed" type="text" style={{ width: 80 }}
                            value={it.unit} onChange={e => updateItem(i, 'unit', e.target.value)} disabled={readOnly} />
                        </td>
                        <td>
                          <input className="input boxed" type="text" style={{ minWidth: 200 }}
                            value={it.description} onChange={e => updateItem(i, 'description', e.target.value)} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 90 }}
                            value={it.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num mono" style={{ verticalAlign: 'middle', fontWeight: 600 }}>
                          {money(it.amount)}
                        </td>
                        <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                          {!readOnly && <button className="btn btn-danger" onClick={() => removeItem(i)}>X</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>Suma Importes:</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>
                        {money(form.items.reduce((acc, it) => acc + it.amount, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

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
                <span>Venta Total Acumulada</span>
                <span className="mono">{money(liveSummary.saleTotal)}</span>
              </div>
              <div className="calc-line">
                <span>Cobrado</span>
                <span className="mono">{money(liveSummary.paidAmount)}</span>
              </div>
              <div className="calc-line total">
                <span>Deuda Restante</span>
                <span className="mono" style={{ color: liveSummary.saleTotal - liveSummary.paidAmount > 0 ? 'var(--bad)' : 'inherit' }}>
                  {money(liveSummary.saleTotal - liveSummary.paidAmount)}
                </span>
              </div>
            </div>
            
            <div style={{ marginTop: 16 }}>
              <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
            </div>
          </>
        )}

        {/* ENTREGAS */}
        {tab === 'entregas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>Registro de Entregas Parciales</h4>
              {!readOnly && <button className="btn btn-primary" onClick={addDelivery}>+ Agregar Entrega</button>}
            </div>
            {form.deliveries.length === 0 ? (
              <p className="hint">No hay entregas registradas.</p>
            ) : (
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th className="num">Kilos</th>
                    <th>Notas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {form.deliveries.map((d, i) => (
                    <tr key={d.id}>
                      <td>
                        <input className="input boxed mono" type="date" 
                          value={toInputDate(d.date) || ''} 
                          onChange={e => {
                            const date = fromInputDate(e.target.value);
                            updateDelivery(i, 'date', date ? Timestamp.fromDate(date) : null);
                          }}
                          disabled={readOnly}
                        />
                      </td>
                      <td className="num">
                        <input className="input boxed mono" type="number" step="0.01" 
                          value={d.kilos} 
                          onChange={e => updateDelivery(i, 'kilos', Number(e.target.value))}
                          disabled={readOnly}
                        />
                      </td>
                      <td>
                        <input className="input boxed" type="text" 
                          value={d.notes || ''} 
                          onChange={e => updateDelivery(i, 'notes', e.target.value)}
                          disabled={readOnly}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {!readOnly && <button className="btn btn-danger" onClick={() => removeDelivery(i)}>X</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* FACTURAS */}
        {tab === 'facturas' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>Facturas y Cobranza Parcial</h4>
              {!readOnly && <button className="btn btn-primary" onClick={addInvoice}>+ Agregar Factura</button>}
            </div>
            {form.invoices.length === 0 ? (
              <p className="hint">No hay facturas registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {form.invoices.map((inv, i) => {
                  const fin = computeFinancials(inv.kilos, config);
                  return (
                    <div key={inv.id} className="card" style={{ padding: 16, border: '1px solid var(--line)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <strong>Factura {inv.folio ? `#${inv.folio}` : '(sin folio)'}</strong>
                        {!readOnly && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn" style={{ background: 'var(--ok)', color: '#fff', borderColor: 'var(--ok)', padding: '4px 8px', fontSize: 13 }}
                              onClick={() => {
                                updateInvoice(i, x => ({
                                  ...x, 
                                  creditCycle: { ...x.creditCycle, status: 'paid' },
                                  collection: { ...x.collection, paidAmount: fin.saleTotal, paidAt: Timestamp.now() }
                                }));
                                toast('Factura marcada como cobrada al 100%', 'ok');
                              }}>
                              💰 Marcar Cobrada
                            </button>
                            <button className="btn btn-danger" onClick={() => removeInvoice(i)}>Eliminar</button>
                          </div>
                        )}
                      </div>
                      <div className="form-grid">
                        <Field label="Folio">
                          <input className="input boxed mono" value={inv.folio || ''} 
                            onChange={e => updateInvoice(i, x => ({...x, folio: e.target.value}))} disabled={readOnly} />
                        </Field>
                        <Field label="Kilos Facturados">
                          <input className="input boxed mono" type="number" step="0.01" value={inv.kilos} 
                            onChange={e => updateInvoice(i, x => ({...x, kilos: Number(e.target.value)}))} disabled={readOnly} />
                        </Field>
                        <Field label="Estado">
                          <select className="input boxed" value={inv.creditCycle.status}
                            disabled={readOnly}
                            onChange={(e) => updateInvoice(i, x => ({
                              ...x, 
                              creditCycle: { ...x.creditCycle, status: e.target.value as OrderStatus }
                            }))}>
                            <option value="pending">Por cobrar</option>
                            <option value="paid">Cobrada</option>
                            <option value="overdue">Vencida</option>
                            <option value="manual_review">Revisión manual</option>
                          </select>
                        </Field>
                        <Field label="Emisión">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.creditCycle.issueDate) || ''}
                            disabled={readOnly}
                            onChange={(e) => {
                              const issue = fromInputDate(e.target.value);
                              if (issue) {
                                const due = addDays(issue, config.creditDays);
                                updateInvoice(i, x => ({
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
                                updateInvoice(i, x => ({
                                  ...x, 
                                  creditCycle: { ...x.creditCycle, dueDate: Timestamp.fromDate(due) }
                                }));
                              }
                            }} />
                        </Field>
                        <Field label="Contrarecibo">
                          <input className="input boxed mono" value={inv.collection?.contrareciboNumber || ''}
                            disabled={readOnly}
                            onChange={e => updateInvoice(i, x => ({
                              ...x, collection: { ...x.collection, contrareciboNumber: e.target.value }
                            }))} />
                        </Field>
                        <Field label="Fecha Contrarecibo">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.contrareciboDate) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const cd = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x, collection: { ...x.collection, contrareciboDate: cd ? Timestamp.fromDate(cd) : undefined }
                              }))
                            }} />
                        </Field>
                        <Field label="Monto Cobrado">
                          <input className="input boxed mono" type="number" step="0.01" value={inv.collection?.paidAmount || 0}
                            disabled={readOnly}
                            onChange={e => updateInvoice(i, x => ({
                              ...x, collection: { ...x.collection, paidAmount: Number(e.target.value) }
                            }))} />
                        </Field>
                        <Field label="Fecha de Cobro">
                          <input className="input boxed mono" type="date" value={toInputDate(inv.collection?.paidAt) || ''}
                            disabled={readOnly}
                            onChange={e => {
                              const pa = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x, collection: { ...x.collection, paidAt: pa ? Timestamp.fromDate(pa) : undefined }
                              }))
                            }} />
                        </Field>
                      </div>
                      <div className="calc-box" style={{ marginTop: 12 }}>
                        <div className="calc-line">
                          <span>Venta ({inv.kilos} kg)</span>
                          <span className="mono">{money(fin.saleTotal)}</span>
                        </div>
                        <div className="calc-line total">
                          <span>Deuda</span>
                          <span className="mono" style={{ color: fin.saleTotal - (inv.collection?.paidAmount || 0) > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                            {money(fin.saleTotal - (inv.collection?.paidAmount || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <p className="hint" style={{ marginTop: 12 }}>
        Archivo original: <code>{order.fileName ?? '—'}</code>
      </p>

      <div className="modal-actions" style={{ marginTop: 16 }}>
        {!readOnly && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
            Eliminar Expediente
          </button>
        )}
        <button className="btn" onClick={printRemision} style={{ marginLeft: 12 }}>📄 Generar Remisión (PDF)</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>
    </Modal>
  );
}
