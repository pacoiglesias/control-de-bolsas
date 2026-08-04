
import { useState, useMemo, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui';
import { useToast } from '../../context/ToastContext';
import { computeFinancials, configEfectiva, addDays, getOrderSummary, daysLate, round2 } from '../../lib/finance';
import {
  newDeliveryEvent,
  updateDeliveryField as updateDeliveryFieldLib,
  updateDeliveryItemQuantity,
  removeDeliveryAt,
  computeDeliveredTotals,
  buildInvoiceFromDelivery,
  unmarkDeliveriesByInvoiceId,
  migrateLegacyDeliveries,
} from '../../lib/deliveries';
import { money, toDate } from '../../lib/format';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import type { FinancialConfig, PurchaseOrder, Invoice, Delivery, PurchaseOrderItem } from '../../lib/types';
import { sound } from '../../lib/sounds';
import { useProducts } from '../../hooks/useProducts';
import { useOrders } from '../../hooks/useOrders';
import { useInvoiceParser } from '../../hooks/useInvoiceParser';

import OrderModalContext from './OrderModalContext';
import TabResumen from './TabResumen';
import TabProductos from './TabProductos';
import TabEntregas from './TabEntregas';
import TabFacturas from './TabFacturas';
import { printRemision, printPreFactura, printConsolidatedPackage } from './orderModalPrint';
import { useOrderActions } from './useOrderActions';


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
  initialTab?: 'resumen' | 'productos' | 'entregas' | 'facturas';
}) {
  const toast = useToast();
  const { user } = useAuth();
  const { products } = useProducts();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  // useOrders() lee del mismo <OrdersProvider> ya montado en App.tsx: no abre
  // una segunda suscripcion, solo reutiliza la que ya esta viva. No existia
  // ningun catalogo de clientes ni proveedores -- a diferencia de Productos,
  // que ya tiene el suyo -- asi que se deriva de los expedientes existentes.
  const { orders: allOrders } = useOrders();
  const knownClients = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.client?.trim()) set.add(o.client.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const knownProviders = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.provider?.trim()) set.add(o.provider.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const knownClientEmails = useMemo(() => {
    const set = new Set<string>();
    allOrders.forEach((o) => { if (o.clientEmail?.trim()) set.add(o.clientEmail.trim()); });
    return Array.from(set).sort();
  }, [allOrders]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'resumen' | 'productos' | 'entregas' | 'facturas'>(initialTab);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  // La migracion de entregas viejas ahora vive en lib/deliveries.ts,
  // compartida con Compras.tsx — ver migrateLegacyDeliveries.
  const migratedDeliveries = useMemo(
    () => migrateLegacyDeliveries(order, initialSummary.deliveries),
    [order, initialSummary.deliveries],
  );

  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    clientEmail: order.clientEmail ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    oc: order.oc ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    deliveries: migratedDeliveries,
    invoices: initialSummary.invoices,
    items: order.items ?? [],
    customCostPrice: order.customCostPrice !== undefined ? String(order.customCostPrice) : '',
    customSellPrice: order.customSellPrice !== undefined ? String(order.customSellPrice) : '',
    customCommissionRate: order.customCommissionRate !== undefined ? String(order.customCommissionRate * 100) : '',
    isClosedShort: order.isClosedShort ?? false,
  });

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v })), []);

  // Sello de tiempo del expediente al ABRIR el modal, no en cada render:
  // compararlo contra el del servidor al guardar es lo que permite detectar si
  // alguien mas toco el expediente mientras seguia abierto aqui.
  const [baselineUpdatedAt] = useState(() => order.updatedAt ?? null);

  const kilosNum = Number(form.totalKilograms) || 0;

  const fallbackCost = form.invoices[0]?.financials?.costPricePerKg ?? config.costPricePerKg;
  const fallbackSale = form.invoices[0]?.financials?.salePricePerKg ?? config.salePricePerKg;
  const fallbackComm = form.invoices[0]?.financials?.commissionRate ?? config.commissionRate;
  const csp = form.customSellPrice !== '' ? Number(form.customSellPrice) : fallbackSale;
  const ccp = form.customCostPrice !== '' ? Number(form.customCostPrice) : fallbackCost;
  const ccr = form.customCommissionRate !== '' ? Number(form.customCommissionRate) / 100 : fallbackComm;
  // Misma funcion que usa el trigger de saneamiento en el backend. Cuando
  // esto era un objeto literal aparte, la resolucion de costos variables
  // existia dos veces con dos nombres distintos y podia divergir.
  const dynamicConfig = useMemo(
    () => configEfectiva(config, { customCostPrice: ccp, customSellPrice: csp, customCommissionRate: ccr }),
    [config, ccp, csp, ccr],
  );

  // Este hook estaba dentro del bloque `{tab === 'facturas' && (() => {...})()}`,
  // es decir, solo se ejecutaba en una de las pestanas. Un hook condicional
  // rompe las Reglas de Hooks: al cambiar de pestana React ve un numero
  // distinto de hooks entre renders y revienta con "Rendered more hooks than
  // during the previous render". Va aqui arriba, incondicional, como el resto.
  const { processFacturaText, processPagoText } = useInvoiceParser({
    invoices: form.invoices,
    setInvoices: (newInvoices: Invoice[]) => set('invoices', newInvoices),
    config,
    allOrders,
  });

  const { saveOrder, removeOrder } = useOrderActions();

  const liveSummary = useMemo(() => {
    // We construct a fake order object to pass to getOrderSummary
    const tempOrder: PurchaseOrder = {
      ...order,
      folio: form.folio,
      totalKilograms: kilosNum,
      deliveries: form.deliveries,
      invoices: form.invoices,
      customCostPrice: form.customCostPrice !== '' ? Number(form.customCostPrice) : undefined,
      customSellPrice: form.customSellPrice !== '' ? Number(form.customSellPrice) : undefined,
    };
    return getOrderSummary(tempOrder);
  }, [order, form.folio, kilosNum, form.deliveries, form.invoices, form.customCostPrice, form.customSellPrice]);

  const computedInvoices = useMemo(() => {
    return form.invoices.map((inv) => {
      const baseFin = computeFinancials(inv.kilos, dynamicConfig);
      const fin = baseFin;
      const d = daysLate(toDate(inv.creditCycle.dueDate));
      const isLate = (inv.creditCycle.status === 'overdue' || inv.creditCycle.status === 'pending') && d !== null && d > 0;
      return { inv, fin, d, isLate };
    });
  }, [form.invoices, dynamicConfig]);

  // NOTA (2026-07-31): existia una segunda implementacion de "facturar lo
  // entregado" aqui (totalDeliveredKilos / addDeliveredInvoice /
  // renderDeliveryAlertBanner), construida en otra sesion sin ver la que ya
  // habia en la pestana Productos (kilosEntregados / facturarLoEntregado,
  // mas abajo en este archivo). Se retiro por dos motivos:
  //   1) BUG REAL: `it.deliveredQuantity || it.quantity || 0` trataba un
  //      renglon sin entrega capturada (0/undefined) como si se hubiera
  //      entregado COMPLETO, dejando facturar mercancia que Andres no habia
  //      entregado.
  //   2) Las dos versiones no se enteraban una de la otra: nada impedia
  //      facturar la misma entrega dos veces si el usuario usaba primero un
  //      boton y despues el otro.
  // Se conserva solo la version de la pestana Productos, que cuenta 0 cuando
  // no hay entrega capturada, sin caer al total pedido.

  async function save() {
    let finalIsClosedShort = form.isClosedShort;
    const kilosPedidosActuales = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const { kilosEntregados: kilosEntregadosActuales } = computeDeliveredTotals(form.deliveries);
    const tol = (dynamicConfig as any).weightTolerancePercentage ?? 2;
    
    const isUnderLimit = kilosEntregadosActuales >= (kilosPedidosActuales * (1 - tol / 100));
    const isOverLimit = kilosEntregadosActuales <= (kilosPedidosActuales * (1 + tol / 100));

    // Auto-cierre si se completó y aún no está facturada ni cerrada
    if (kilosEntregadosActuales > 0 && isUnderLimit && isOverLimit && !finalIsClosedShort && (liveSummary.status === 'pedido' || liveSummary.status === 'pending')) {
      if (window.confirm('Has completado los kilos pedidos. ¿Deseas marcar esta orden como finalizada para que deje de aparecer como pendiente en almacén?')) {
        finalIsClosedShort = true;
        set('isClosedShort', true);
      }
    }

    await saveOrder({
      form: { ...form, isClosedShort: finalIsClosedShort }, 
      order, kilosNum, allOrders, dynamicConfig, config,
      baselineUpdatedAt, userEmail: user?.email, toast, setBusy, onClose, liveSummary
    });
  }

  function emailClient() {
    const correo = form.clientEmail.trim();
    if (!correo) {
      toast('Este cliente no tiene correo capturado. Agrégalo en la pestaña Resumen para poder notificarlo.', 'bad');
      return;
    }
    const dateStr = form.estimatedDeliveryDate ? form.estimatedDeliveryDate.toDate().toLocaleDateString() : '(por definir)';
    const subject = encodeURIComponent(`Confirmación de Entrega - Pedido #${form.folio || 'S/N'}`);
    const body = encodeURIComponent(`Estimado cliente,\n\nLe informamos que su pedido #${form.folio || 'S/N'} por la cantidad de ${kilosNum} kg tiene una fecha estimada de entrega para el ${dateStr}.\n\nSaludos,\nProvidencia`);
    // Antes decia "mailto:?subject=..." — sin ningun correo antes del "?".
    // Si no habia un programa de correo configurado por defecto, el boton no
    // hacia nada visible; si lo habia, se abria con el destinatario en blanco.
    window.location.href = `mailto:${encodeURIComponent(correo)}?subject=${subject}&body=${body}`;
  }

  function handlePrintRemision() {
    printRemision({ folio: form.folio, client: form.client, department: form.department, kilosNum, config, settings });
  }

  function handlePrintPreFactura() {
    printPreFactura({ folio: form.folio, items: form.items, deliveredByItem, kilosNum, dynamicConfig, provName });
  }

  function handlePrintConsolidatedPackage() {
    printConsolidatedPackage({ folio: form.folio, client: form.client, department: form.department, oc: form.oc, totalKilograms: form.totalKilograms, invoices: form.invoices, deliveries: form.deliveries, config, provName });
  }

  async function remove() {
    await removeOrder({
      order, userEmail: user?.email, initialSummary, setBusy, toast, onClose
    });
  }


  function parseOCAndFill(text: string) {
    if (!text) return;

    const folioMatch = text.match(/CDB OC:\s*([\w]+)/i) || text.match(/No\.\s*Ord\.\s*de\s*Compra:\s*([^\s\n\r]+)/i);
    const folio = folioMatch ? folioMatch[1].trim() : '';

    const isProvidencia = text.match(/PROVIDENCIA/i);
    const client = isProvidencia ? 'GRUPO TEXTIL PROVIDENCIA SA DE CV' : '';

    // Buscar líneas de artículos que típicamente terminan en "1,000.0000 47.0000 0.0000 47,000.0000"
    // Extracting the first number in that sequence (Quantity)
    const itemsMatch = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s+[\d,]+(?:\.\d+)?\s+[\d,]+(?:\.\d+)?\s+[\d,]+(?:\.\d+)?/g)];
    let kilos = 0;
    if (itemsMatch.length > 0) {
      itemsMatch.forEach(m => kilos += Number(m[1].replace(/,/g, '')));
    } else {
      // Fallback: look for lines starting with number and having "BOLSA" or "BULTO"
      const altMatch = text.match(/(?:BOLSA|BULTO)[^\n\r]*?([\d,]+(?:\.\d+)?)/i);
      if (altMatch) kilos = Number(altMatch[1].replace(/,/g, ''));
    }

    setForm(f => ({
      ...f,
      folio: folio || f.folio,
      client: client || f.client,
      totalKilograms: kilos > 0 ? kilos.toString() : f.totalKilograms,
      provider: provName
    }));

    toast(`OC procesada. Folio: ${folio || '?'}, Kilos: ${kilos > 0 ? kilos : '?'}`, 'ok');
  }

  async function retryAI() {
    setBusy(true);
    try {
      // Las funciones viven en us-east1 (ver lib/firebase.ts). Crear aqui una
      // instancia sin region la mandaba a us-central1: fallaba siempre.
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
  const updateItem = <F extends keyof PurchaseOrderItem>(index: number, field: F, value: PurchaseOrderItem[F]) => {
    const next = [...form.items];
    next[index] = { ...next[index], [field]: value };
    
    // Auto-fill from catalog if description matches exactly
    if (field === 'description') {
      const matchedProd = products.find(p => p.description === value);
      if (matchedProd) {
        next[index].code = matchedProd.code || '';
        next[index].unit = matchedProd.unit;
        next[index].unitPrice = matchedProd.defaultPrice;
      }
    }
    
    // Auto-fill from catalog if code matches exactly
    if (field === 'code' && value) {
      const matchedProd = products.find(p => p.code?.toUpperCase() === String(value).toUpperCase() || p.id === String(value).toUpperCase());
      if (matchedProd) {
        next[index].description = matchedProd.description;
        next[index].unit = matchedProd.unit;
        next[index].unitPrice = matchedProd.defaultPrice;
      }
    }
    
    if (field === 'quantity' || field === 'unitPrice' || field === 'description') {
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

  // --- Handlers for Deliveries (delegan a lib/deliveries.ts) ---
  const addDelivery = () => {
    set('deliveries', [...form.deliveries, newDeliveryEvent(form.items)]);
  };
  const updateDelivery = <F extends keyof Delivery>(index: number, field: F, value: Delivery[F]) => {
    set('deliveries', updateDeliveryFieldLib(form.deliveries, index, field, value));
  };
  const updateDeliveryItemQty = (deliveryIndex: number, itemId: string, quantity: number) => {
    const nextDeliveries = updateDeliveryItemQuantity(form.deliveries, deliveryIndex, itemId, quantity);
    const { kilosEntregados: nextKilos } = computeDeliveredTotals(nextDeliveries);
    const kilosPedidos = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    
    if (nextKilos > kilosPedidos) {
      toast(`Error: No puedes registrar ${nextKilos.toLocaleString('es-MX')} kg en total si la OC solo ampara ${kilosPedidos.toLocaleString('es-MX')} kg.`, 'bad');
      return;
    }
    set('deliveries', nextDeliveries);
  };
  const removeDelivery = (index: number) => {
    const result = removeDeliveryAt(form.deliveries, index);
    if ('error' in result) {
      toast(result.error, 'bad');
      return;
    }
    if (window.confirm('¿Eliminar esta entrega?')) {
      set('deliveries', result.deliveries);
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
      const invoiceId = form.invoices[index]?.id;
      const nextInvoices = [...form.invoices];
      nextInvoices.splice(index, 1);
      // Si esta factura vino de una entrega, esa entrega vuelve a quedar
      // "pendiente de facturar" en vez de quedar bloqueada para siempre.
      const nextDeliveries = unmarkDeliveriesByInvoiceId(form.deliveries, invoiceId);
      setForm((f) => ({ ...f, invoices: nextInvoices, deliveries: nextDeliveries }));
    }
  };

  // Lo entregado se deriva de los EVENTOS de entrega (form.deliveries), via
  // lib/deliveries.ts — la misma fuente que usa Compras.tsx.
  const { deliveredByItem, kilosEntregados } = useMemo(
    () => computeDeliveredTotals(form.deliveries),
    [form.deliveries],
  );
  const kilosPedidos = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const kilosFaltantes = round2(kilosPedidos - kilosEntregados);

  /**
   * Factura UNA entrega especifica, no el acumulado — ver Ciclo 26 en
   * AUDIT_NOTEBOOK.md. La logica vive en lib/deliveries.ts; aqui solo se
   * conecta al estado del formulario y al toast.
   */
  function facturarEntrega(deliveryIndex: number) {
    const delivery = form.deliveries[deliveryIndex];
    if (!delivery) return;
    const result = buildInvoiceFromDelivery(delivery, dynamicConfig);
    if ('error' in result) {
      toast(result.error, 'bad');
      return;
    }
    const nextDeliveries = [...form.deliveries];
    nextDeliveries[deliveryIndex] = result.updatedDelivery;
    setForm((f) => ({ ...f, invoices: [...f.invoices, result.invoice], deliveries: nextDeliveries }));
    setTab('facturas');
    toast(`Factura armada con ${result.kilos.toLocaleString('es-MX')} kg de esta entrega. Falta poner el folio y guardar.`, 'ok');
  }



  

  

  

  

  // Viability logic
  const estimatedTotalCost = form.items.length > 0 
    ? form.items.reduce((acc, it) => acc + ((Number(it.quantity) || 0) * ccp), 0) 
    : kilosNum * ccp;
  const cajaBalance = settings?.cajaChicaBalance || 0;
  const viabilityWarning = estimatedTotalCost > cajaBalance;

  const ctx = {
    form, setForm, set, readOnly, dynamicConfig, liveSummary, computedInvoices, order,
    allOrders, knownClients, knownProviders, knownClientEmails, provName, config,
    fallbackSale, fallbackCost, fallbackComm, kilosNum,
    kilosEntregados, kilosPedidos, kilosFaltantes, deliveredByItem,
    processFacturaText, processPagoText, parseOCAndFill, emailClient, toast,
    addItem, updateItem, removeItem,
    addDelivery, updateDelivery, updateDeliveryItemQty, removeDelivery,
    addInvoice, updateInvoice, removeInvoice, facturarEntrega,
    printRemision: handlePrintRemision, printPreFactura: handlePrintPreFactura, printConsolidatedPackage: handlePrintConsolidatedPackage
  };

  return (
    <OrderModalContext.Provider value={ctx}>
    <Modal wide title={`Expediente ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      <datalist id="catalog-products">
        {products.map(p => (
          <option key={p.id} value={p.description} />
        ))}
      </datalist>
      <datalist id="known-clients">
        {knownClients.map(c => <option key={c} value={c} />)}
      </datalist>
      <datalist id="known-providers">
        {knownProviders.map(p => <option key={p} value={p} />)}
      </datalist>
      <datalist id="known-client-emails">
        {knownClientEmails.map(e => <option key={e} value={e} />)}
      </datalist>

      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: viabilityWarning ? 'var(--warn-bg)' : 'var(--ok-bg)', border: `1px solid ${viabilityWarning ? 'var(--warn)' : 'var(--ok)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>{viabilityWarning ? '⚠️' : '✅'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Auditoría de Viabilidad (Caja Chica vs Costo Producción)</div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            Saldo actual en Caja Chica: <strong>{money(cajaBalance)}</strong> &middot; Costo de Producción estimado: <strong>{money(estimatedTotalCost)}</strong>.
            {viabilityWarning ? ' El saldo no es suficiente para cubrir esta orden por completo.' : ' Hay saldo suficiente para esta orden.'}
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
        <button className={`btn ${tab === 'resumen' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('resumen'); }}>Resumen</button>
        <button className={`btn ${tab === 'productos' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('productos'); }}>
          Productos <span className="badge">{form.items.length}</span>
        </button>
        <button className={`btn ${tab === 'entregas' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('entregas'); }}>
          Entregas <span className="badge">{form.deliveries.length}</span>
        </button>
        <button className={`btn ${tab === 'facturas' ? 'btn-primary' : ''}`} onClick={() => { sound.playPop(); setTab('facturas'); }}>
          Facturas <span className="badge">{form.invoices.length}</span>
        </button>
        <button className="btn" style={{ marginLeft: 'auto', background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={handlePrintConsolidatedPackage}>
          🖨️ Paquete Consolidado (PDF)
        </button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ minHeight: '50vh', maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
        
        {/* RESUMEN */}
        {tab === 'resumen' && <TabResumen />}

        {/* PRODUCTOS */}
        {tab === 'productos' && <TabProductos />}

        {/* ENTREGAS */}
        {tab === 'entregas' && <TabEntregas />}

        {/* FACTURAS */}
        {tab === 'facturas' && <TabFacturas />}
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

      <div className="modal-actions" style={{ marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--bg-modal)', padding: '16px 0', borderTop: '1px solid var(--line)', zIndex: 10 }}>
        {!readOnly && (
          <button className="btn btn-danger" onClick={() => void remove()} disabled={busy}>
            {busy ? <span className="spinner" style={{ marginRight: 8 }}></span> : '🗑️ '} Eliminar Expediente
          </button>
        )}
        <button className="btn" onClick={handlePrintRemision} style={{ marginLeft: 12 }}>📄 Generar Remisión (PDF)</button>
        <button className="btn" onClick={handlePrintPreFactura} style={{ marginLeft: 12, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }}>📋 Pre-Factura CFDI 4.0 (PDF)</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>
    </Modal>
    </OrderModalContext.Provider>
  );
}
