import { useState, useMemo } from 'react';
import { collection, deleteDoc, doc, serverTimestamp, Timestamp, setDoc, addDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, PATHS, app } from '../lib/firebase';
import { logAction } from '../lib/logger';
import { useAuth } from '../context/AuthContext';
import { Field, Modal, StatusBadge } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { computeFinancials, addDays, getOrderSummary, daysLate } from '../lib/finance';
import { fromInputDate, money, toInputDate, kilos, toDate, percent } from '../lib/format';
import type { FinancialConfig, OrderStatus, PurchaseOrder, Invoice, Delivery, PurchaseOrderItem } from '../lib/types';
import { sound } from '../lib/sounds';

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
  const [tab, setTab] = useState<'resumen' | 'productos' | 'entregas' | 'facturas'>(initialTab as any);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    oc: order.oc ?? '',
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
  }, [order, form.folio, kilosNum, form.deliveries, form.invoices]);

  async function save() {
    if (kilosNum <= 0) {
      sound.playError();
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
          financials: computeFinancials(inv.kilos, snapshotCfg),
          collection: inv.collection ? {
            ...inv.collection,
            contrareciboNumber: inv.collection.contrareciboNumber?.trim() || ''
          } : undefined
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
        invoiceStatuses: updatedInvoices.map(i => i.creditCycle.status),
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
      sound.playSuccess();
      toast('Expediente actualizado', 'ok');
      onClose();
    } catch (e) {
      sound.playError();
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
    function escapeHtml(str: string) {
      return (str || '').replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
          }[tag] || tag)
      );
    }

    const html = `
      <html>
        <head>
          <title>Remisión de Entrega - ${escapeHtml(form.folio)}</title>
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
              <strong>Folio:</strong> ${escapeHtml(form.folio) || '(Sin folio)'}<br>
              <strong>Cliente:</strong> ${escapeHtml(form.client)}<br>
              <strong>Departamento:</strong> ${escapeHtml(form.department) || '—'}<br>
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

  function printConsolidatedPackage() {
    function escapeHtml(str: string) {
      return (str || '').replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
      );
    }

    const totalKilos = Number(form.totalKilograms) || 0;
    const invList = form.invoices ?? [];
    const delList = form.deliveries ?? [];

    let totalVenta = 0;
    let totalCostoAndres = 0;
    let totalComision = 0;

    const invoicesHtml = invList.map(inv => {
      const baseFin = computeFinancials(inv.kilos, config);
      const customComm = inv.financials?.commission;
      const invTotal = baseFin.invoiceTotal;
      const costAndres = baseFin.costTotal;
      const comm = customComm ?? baseFin.commission;
      const net = invTotal - comm - costAndres;

      totalVenta += invTotal;
      totalCostoAndres += costAndres;
      totalComision += comm;

      return `
        <tr>
          <td style="font-family:monospace;font-weight:600;">#${escapeHtml(inv.folio || '—')}</td>
          <td style="font-family:monospace;">${escapeHtml(inv.collection?.contrareciboNumber || '—')}</td>
          <td style="text-align:right;">${inv.kilos.toLocaleString('es-MX')} kg</td>
          <td style="text-align:right;">$${invTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#8A5A1E;">-$${costAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;color:#B23A2E;">-$${comm.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
          <td style="text-align:right;font-weight:700;color:#2F7A52;">$${net.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
        </tr>
      `;
    }).join('');

    const deliveriesHtml = delList.map(d => `
      <tr>
        <td>${d.date ? toDate(d.date)?.toLocaleDateString('es-MX') || '—' : '—'}</td>
        <td style="text-align:right;">${d.kilos.toLocaleString('es-MX')} kg</td>
        <td>${escapeHtml(d.notes || '—')}</td>
      </tr>
    `).join('');

    const netUtilidad = totalVenta - totalCostoAndres - totalComision;
    const margenPct = totalVenta > 0 ? ((netUtilidad / totalVenta) * 100).toFixed(2) : '0.00';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Paquete Consolidado - ${escapeHtml(form.client)} (OC ${escapeHtml(form.oc || '—')})</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 30px; color: #111; font-size: 13px; line-height: 1.4; }
            .header { border-bottom: 3px solid #222; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
            .header h1 { margin: 0; font-size: 22px; text-transform: uppercase; }
            .header .sub { font-size: 12px; color: #555; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; background: #f8f8f8; padding: 15px; border-radius: 6px; border: 1px solid #e0e0e0; margin-bottom: 20px; }
            .section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid #ccc; padding-bottom: 4px; margin-top: 25px; margin-bottom: 10px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #eee; font-weight: 700; }
            .summary-box { background: #eef7f2; border: 1px solid #2F7A52; padding: 15px; border-radius: 6px; margin-top: 20px; }
            .summary-line { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
            .summary-line.total { border-top: 2px solid #2F7A52; font-weight: 800; font-size: 16px; color: #2F7A52; padding-top: 8px; margin-top: 6px; }
            .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
            .sig-box { text-align: center; border-top: 1px solid #000; padding-top: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>PAQUETE DE COBRO CONSOLIDADO</h1>
              <div class="sub">Control Bolsas ERP · Remisión + Contrarecibo + Factura</div>
            </div>
            <div style="text-align:right;">
              <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}<br>
              <strong>Folio Expediente:</strong> #${escapeHtml(form.folio || '—')}
            </div>
          </div>

          <div class="meta-grid">
            <div>
              <strong>Cliente:</strong> ${escapeHtml(form.client || '—')}<br>
              <strong>Departamento:</strong> ${escapeHtml(form.department || '—')}<br>
              <strong>Orden de Compra (OC):</strong> ${escapeHtml(form.oc || '—')}
            </div>
            <div style="text-align:right;">
              <strong>Proveedor Fabricante:</strong> Andrés (Sin Mermas)<br>
              <strong>Kilos Totales:</strong> ${totalKilos.toLocaleString('es-MX')} kg<br>
              <strong>Facturas Asociadas:</strong> ${invList.length}
            </div>
          </div>

          ${delList.length > 0 ? `
            <div class="section-title">📦 1. REMISIONES Y ENTREGAS DE PLÁSTICO</div>
            <table>
              <thead>
                <tr>
                  <th>Fecha Entrega</th>
                  <th style="text-align:right;">Kilos Entregados</th>
                  <th>Notas / Remisión</th>
                </tr>
              </thead>
              <tbody>${deliveriesHtml}</tbody>
            </table>
          ` : ''}

          <div class="section-title">📄 2. DETALLE DE FACTURAS Y CONTRARECIBOS (GT/TH)</div>
          <table>
            <thead>
              <tr>
                <th>Folio Factura</th>
                <th>Contrarecibo (CR)</th>
                <th style="text-align:right;">Kilos</th>
                <th style="text-align:right;">Facturado (con IVA)</th>
                <th style="text-align:right;">Costo Andrés</th>
                <th style="text-align:right;">Comisión Contador</th>
                <th style="text-align:right;">Utilidad Líquida Real</th>
              </tr>
            </thead>
            <tbody>${invoicesHtml}</tbody>
          </table>

          <div class="summary-box">
            <div class="summary-line"><span>Venta Total Facturada (Cliente GT/TH):</span><strong>$${totalVenta.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
            <div class="summary-line"><span>Costo Directo Proveedor Andrés:</span><span style="color:#8A5A1E;">-$${totalCostoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line"><span>Comisión Contabilidad / Contador:</span><span style="color:#B23A2E;">-$${totalComision.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="summary-line total">
              <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${margenPct}%):</span>
              <span>$${netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
            </div>
          </div>

          <div class="signatures">
            <div class="sig-box">Firma y Sello de Recepción Cliente</div>
            <div class="sig-box">Autorización de Cobro y Caja Chica</div>
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

  async function retryAI() {
    setBusy(true);
    try {
      const functions = getFunctions(app);
      const reprocess = httpsCallable(functions, 'reprocessOrder');
      await reprocess({ orderId: order.id });
      toast('Archivo reenviado a la IA exitosamente.', 'ok');
      onClose();
    } catch (e) {
      toast(`Error al reintentar: ${(e as Error).message}`, 'bad');
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        <button className={`btn ${tab === 'resumen' ? 'btn-primary' : ''}`} onClick={() => setTab('resumen')}>Resumen</button>
        <button className={`btn ${tab === 'productos' ? 'btn-primary' : ''}`} onClick={() => setTab('productos')}>
          Productos <span className="badge">{form.items.length}</span>
        </button>
        <button className={`btn ${tab === 'entregas' ? 'btn-primary' : ''}`} onClick={() => setTab('entregas')}>
          Entregas <span className="badge">{form.deliveries.length}</span>
        </button>
        <button className={`btn ${tab === 'facturas' ? 'btn-primary' : ''}`} onClick={() => setTab('facturas')}>
          Facturas <span className="badge">{form.invoices.length}</span>
        </button>
        <button className="btn" style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printConsolidatedPackage}>
          🖨️ Paquete Consolidado (PDF)
        </button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ minHeight: '50vh', maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        
        {/* RESUMEN */}
        {tab === 'resumen' && (
          <>
            <div className="form-grid">
              <Field label="Folio Interno del Pedido">
                <input className="input boxed mono" defaultValue={form.folio} onBlur={(e) => set('folio', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Cliente">
                <input className="input boxed" defaultValue={form.client} onBlur={(e) => set('client', e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Proveedor">
                <input className="input boxed" defaultValue={form.provider} onBlur={(e) => set('provider', e.target.value)} disabled={readOnly} />
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
            </div>
            
            <div style={{ marginTop: 16 }}>
              <strong>Estado del Expediente: </strong> <StatusBadge status={liveSummary.status} />
            </div>
          </>
        )}

        {/* PRODUCTOS */}
        {tab === 'productos' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h4>Detalle de Artículos (Partidas de la OC)</h4>
              {!readOnly && <button className="btn btn-primary" onClick={addItem}>+ Agregar Artículo</button>}
            </div>
            {form.items.length === 0 ? (
              <p className="hint">No hay artículos detallados. La IA extrae estos datos automáticamente del PDF de la Orden de Compra.</p>
            ) : (
              <div className="table-scroll">
                <table className="data-table" style={{ width: '100%', marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th className="num">Cant. Pedida</th>
                      <th className="num">Cant. Entregada</th>
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
                          <input className="input boxed mono" type="number" step="0.01" style={{ width: 70 }}
                            value={it.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} disabled={readOnly} />
                        </td>
                        <td className="num">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <input className="input boxed mono" type="number" step="0.01" style={{ width: 70, borderColor: (it.deliveredQuantity ?? 0) >= it.quantity && it.quantity > 0 ? 'var(--ok)' : 'var(--line)' }}
                              value={it.deliveredQuantity || ''} placeholder="0" onChange={e => updateItem(i, 'deliveredQuantity', Number(e.target.value))} disabled={readOnly} />
                            {(it.deliveredQuantity ?? 0) >= it.quantity && it.quantity > 0 && <span style={{ fontSize: 16 }} title="Completado">✅</span>}
                          </div>
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
                          {!readOnly && <button className="btn btn-icon" onClick={() => removeItem(i)}>🗑️</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 600 }}>Suma Importes:</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>
                        {money(form.items.reduce((acc, it) => acc + it.amount, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
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
                  const baseFin = computeFinancials(inv.kilos, config);
                  const customComm = inv.financials?.commission;
                  const fin = {
                    ...baseFin,
                    commission: customComm ?? baseFin.commission,
                  };
                  const d = daysLate(toDate(inv.creditCycle.dueDate));
                  const isLate = (inv.creditCycle.status === 'overdue' || inv.creditCycle.status === 'pending') && d !== null && d > 0;
                  
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
                                  updateInvoice(i, x => ({
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
                                  updateInvoice(i, x => ({
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
                                      notes: `Factura: $${(invTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${(commission ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}`,
                                      createdAt: serverTimestamp(),
                                    });
                                    toast(`💵 Recibido del contador. $${netAmount.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a Caja Chica.`, 'ok');
                                  } catch {
                                    toast('Factura marcada, pero error al registrar en Caja Chica.', 'bad');
                                  }
                                }}>
                                💵 Recibida del Contador → Caja Chica
                              </button>
                            )}
                            {inv.creditCycle.status === 'collected' && (
                              <span style={{ background: 'var(--ok)', color: '#fff', padding: '4px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
                                ✅ Recibida y en Caja Chica
                              </span>
                            )}
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
                        <Field label="Contrarecibo (CR)">
                          <input className="input boxed mono" value={inv.collection?.contrareciboNumber || ''} 
                            onChange={e => updateInvoice(i, x => ({
                              ...x, 
                              collection: { ...x.collection, contrareciboNumber: e.target.value }
                            }))} disabled={readOnly} />
                        </Field>
                        <Field label="Vencimiento (Promesa)">
                          <input className="input boxed mono" type="date" 
                            value={toInputDate(inv.creditCycle.dueDate) || ''} 
                            onChange={e => {
                              const d = fromInputDate(e.target.value);
                              updateInvoice(i, x => ({
                                ...x,
                                creditCycle: { ...x.creditCycle, dueDate: d ? Timestamp.fromDate(d) : null }
                              }));
                            }} disabled={readOnly} />
                        </Field>
                        <Field label="Estado">
                          <select className="input boxed" value={inv.creditCycle.status}
                            disabled={readOnly}
                            onChange={(e) => updateInvoice(i, x => ({
                              ...x, 
                              creditCycle: { ...x.creditCycle, status: e.target.value as OrderStatus }
                            }))}>
                            <option value="pending">Por cobrar</option>
                              <option value="paid">🟡 Con el contador</option>
                              <option value="collected">✅ Recibida</option>
                              <option value="overdue">Vencida</option>
                              <option value="manual_review">Revisión manual</option>
                          </select>
                          {isLate && (
                            <div style={{ color: 'var(--bad)', fontWeight: 'bold', fontSize: '12px', marginTop: 4 }}>
                              ⚠️ {d} días de atraso
                            </div>
                          )}
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
                        <Field label="Comisión Contador ($)">
                          <input className="input boxed mono" type="number" step="0.01" value={inv.financials?.commission ?? fin.commission}
                            disabled={readOnly}
                            onChange={e => {
                              const val = Number(e.target.value);
                              updateInvoice(i, x => ({
                                ...x,
                                financials: {
                                  ...(x.financials ?? baseFin),
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
                              onChange={e => updateInvoice(i, x => ({
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
                          <span>Factura #{inv.folio || '?'}</span>
                          <span className="mono">{money(fin.invoiceTotal)}</span>
                        </div>
                        <div className="calc-line">
                          <span>Comisión del Contador</span>
                          <span className="mono" style={{ color: 'var(--bad)' }}>- {money(fin.commission)}</span>
                        </div>
                        <div className="calc-line total">
                          <span>Neto a recibir del contador</span>
                          <span className="mono" style={{ color: 'var(--ok)' }}>{money(fin.invoiceTotal - fin.commission)}</span>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          Archivo original: <code>{order.fileName ?? '—'}</code>
        </p>
        {order.aiError && !readOnly && (
          <button className="btn btn-primary" style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => void retryAI()} disabled={busy}>
            🤖 Reintentar IA
          </button>
        )}
      </div>

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
