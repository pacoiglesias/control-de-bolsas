import { useState, useMemo, ReactNode, useRef, useEffect } from 'react';
import { computeFinancials, configEfectiva, getOrderSummary, daysLate, round2 } from '../../lib/finance';
import {
  computeDeliveredTotals,
  migrateLegacyDeliveries
} from '../../lib/deliveries';
import { toDate, fmtDate } from '../../lib/format';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import type { FinancialConfig, PurchaseOrder } from '../../lib/types';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useUndo } from '../../context/UndoContext';
import { useOrders } from '../../hooks/useOrders';
import { useInvoiceParser } from '../../hooks/useInvoiceParser';
import { parseOrdenDeCompra, type ParsedOC } from '../../lib/ocParser';
import { Timestamp } from 'firebase/firestore';

import OrderModalContext from './OrderModalContext';
import { printRemision, printPreFactura, printConsolidatedPackage } from './orderModalPrint';
import type { TabName } from './types';
import { useOrderActions } from './useOrderActions';
import { useInvoiceActions } from './useInvoiceActions';
import { useOrderForm } from './useOrderForm';
import { confirmDialog } from '../../lib/confirmDialog';

export interface OrderModalProviderProps {
  order: PurchaseOrder;
  config: FinancialConfig;
  readOnly?: boolean;
  initialTab?: TabName;
  focusInvoiceId?: string | null;
  onClose: () => void;
  children: ReactNode;
}

export function OrderModalProvider({
  order,
  config,
  readOnly = false,
  initialTab = 'resumen',
  focusInvoiceId: focusInvoiceIdProp = null,
  onClose,
  children
}: OrderModalProviderProps) {
  const toast = useToast();
  const { executeWithUndo } = useUndo();
  const { user } = useAuth();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  
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
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const confirmarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (confirmarTimeoutRef.current) clearTimeout(confirmarTimeoutRef.current);
    };
  }, []);

  const clickEliminar = () => {
    if (confirmandoEliminar) {
      remove();
      setConfirmandoEliminar(false);
    } else {
      setConfirmandoEliminar(true);
      if (confirmarTimeoutRef.current) clearTimeout(confirmarTimeoutRef.current);
      confirmarTimeoutRef.current = setTimeout(() => {
        setConfirmandoEliminar(false);
      }, 3000);
    }
  };

  const focusInvoiceId = focusInvoiceIdProp;
  const [tab, setTab] = useState<TabName>(initialTab);

  const initialSummary = useMemo(() => getOrderSummary(order), [order]);

  const migratedDeliveries = useMemo(
    () => migrateLegacyDeliveries(order, initialSummary.deliveries),
    [order, initialSummary.deliveries],
  );

  const { form, setForm, set } = useOrderForm(order, migratedDeliveries, initialSummary.invoices);

  const [baselineUpdatedAt] = useState(() => order.updatedAt ?? null);
  const totalKilograms = form.totalKilograms || (form.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0).toString();
  const kilosNum = Number(totalKilograms) || 0;

  const fallbackCost = form.invoices[0]?.financials?.costPricePerKg ?? config.costPricePerKg;
  const fallbackSale = form.invoices[0]?.financials?.salePricePerKg ?? config.salePricePerKg;
  const fallbackComm = form.invoices[0]?.financials?.commissionRate ?? config.commissionRate;
  const csp = form.customSellPrice !== '' ? Number(form.customSellPrice) : fallbackSale;
  const ccp = form.customCostPrice !== '' ? Number(form.customCostPrice) : fallbackCost;
  const ccr = form.customCommissionRate !== '' ? Number(form.customCommissionRate) / 100 : fallbackComm;
  
  const dynamicConfig = useMemo(
    () => configEfectiva(config, { customCostPrice: ccp, customSellPrice: csp, customCommissionRate: ccr }),
    [config, ccp, csp, ccr],
  );

  const { saveInvoice } = useInvoiceActions();

  const { processFacturaText, processPagoText, processParsedXml } = useInvoiceParser({
    invoices: order.invoices || [],
    // Antes esto era un no-op ("handle it properly later") y por eso pegar
    // el texto de una factura mostraba "Factura agregada" sin guardar nada
    // en Firestore. Ahora se compara el arreglo resultante contra las
    // facturas actuales del expediente y se persiste (vía saveInvoice, el
    // mismo camino que usa "+ Manual" y la edición normal de una factura)
    // cada factura nueva o modificada -- cubre tanto agregar una factura
    // (processFacturaText/processParsedXml) como actualizar el cobro de
    // varias a la vez (processPagoText).
    setInvoices: async (updated) => {
      const currentById = new Map((order.invoices || []).map((i) => [i.id, i]));
      for (const inv of updated) {
        const prev = currentById.get(inv.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(inv)) {
          await saveInvoice(order, inv, dynamicConfig);
        }
      }
    },
    config,
    allOrders,
    orderId: order.id || ''
  });

  const { saveOrder, removeOrder, restoreOrder } = useOrderActions();

  const liveSummary = useMemo(() => {
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

  // Invoices are now computed directly from the order context instead of the local form state
  const computedInvoices = useMemo(() => {
    return (order.invoices || []).map((inv) => {
      const baseFin = computeFinancials(inv.kilos, dynamicConfig);
      const d = daysLate(toDate(inv.creditCycle.dueDate));
      const isLate = (inv.creditCycle.status === 'overdue' || inv.creditCycle.status === 'pending') && d !== null && d > 0;
      return { inv, fin: baseFin, d, isLate };
    });
  }, [order.invoices, dynamicConfig]);

  const { deliveredByItem, kilosEntregados } = useMemo(
    () => computeDeliveredTotals(form.deliveries),
    [form.deliveries]
  );
  
  const kilosPedidos = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const kilosFaltantes = round2(kilosPedidos - kilosEntregados);
  const kilosPendientesDeFacturar = round2(Math.max(
    kilosEntregados - (order.invoices || []).reduce((acc: number, i: any) => acc + (i.kilos || 0), 0),
    0
  ));

  async function save() {
    let finalIsClosedShort = form.isClosedShort;
    const kilosPedidosActuales = form.items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
    const { kilosEntregados: kilosEntregadosActuales } = computeDeliveredTotals(form.deliveries);
    const tol = (dynamicConfig as any).weightTolerancePercentage ?? 2;
    
    const isUnderLimit = kilosEntregadosActuales >= (kilosPedidosActuales * (1 - tol / 100));
    const isOverLimit = kilosEntregadosActuales <= (kilosPedidosActuales * (1 + tol / 100));

    if (kilosEntregadosActuales > 0 && isUnderLimit && isOverLimit && !finalIsClosedShort && (liveSummary.status === 'pedido' || liveSummary.status === 'pending')) {
      if (await confirmDialog('Has completado los kilos pedidos. ¿Deseas marcar esta orden como finalizada para que deje de aparecer como pendiente en almacén?')) {
        finalIsClosedShort = true;
        set('isClosedShort', true);
      }
    }

    await saveOrder({
      form: { ...form, isClosedShort: finalIsClosedShort }, 
      order, kilosNum, allOrders, dynamicConfig, config, materialProviderName: provName,
      baselineUpdatedAt, userEmail: user?.email, toast, setBusy, onClose, liveSummary
    });
  }

  function emailClient() {
    const correo = form.clientEmail.trim();
    if (!correo) {
      toast('Este cliente no tiene correo capturado. Agrégalo en la pestaña Resumen para poder notificarlo.', 'bad');
      return;
    }
    // FIX: toLocaleDateString() sin locale usaba el idioma/formato de fecha
    // del navegador de quien tuviera la sesion abierta (podia salir
    // "8/19/2026" mes-primero en vez de "19/Ago/2026") -- inconsistente con
    // el formato es-MX que usa el resto del sistema. Se usa fmtDate(), el
    // mismo helper que ya formatea fechas en todas las demas pantallas.
    const dateStr = form.estimatedDeliveryDate ? fmtDate(form.estimatedDeliveryDate) : '(por definir)';
    const subject = encodeURIComponent(`Confirmación de Entrega - Pedido #${form.folio || 'S/N'}`);
    const body = encodeURIComponent(`Estimado cliente,\n\nLe informamos que su pedido #${form.folio || 'S/N'} por la cantidad de ${kilosNum} kg tiene una fecha estimada de entrega para el ${dateStr}.\n\nSaludos,\nProvidencia`);
    window.location.href = `mailto:${encodeURIComponent(correo)}?subject=${subject}&body=${body}`;
  }

  function handlePrintRemision() {
    printRemision({
      folio: form.folio,
      oc: form.oc,
      client: form.client,
      department: form.department,
      items: form.items,
      deliveredByItem,
      kilosNum,
      config,
      provName
    });
  }

  function handlePrintPreFactura() {
    printPreFactura({ folio: form.folio, items: form.items, deliveredByItem, kilosNum, dynamicConfig, provName });
  }

  function handlePrintConsolidatedPackage() {
    printConsolidatedPackage({ folio: form.folio, client: form.client, department: form.department, oc: form.oc, totalKilograms: form.totalKilograms, invoices: order.invoices || [], deliveries: form.deliveries, config, provName });
  }

  async function remove() {
    await executeWithUndo(
      async () => {
        await removeOrder({
          order, userEmail: user?.email, initialSummary, setBusy, toast: () => {}, onClose
        });
      },
      async () => {
        await restoreOrder({
          order, userEmail: user?.email, setBusy, toast: () => {}, onClose: () => {}
        });
      },
      `Expediente ${order.folio} eliminado`,
      10000
    );
    onClose();
  }

  async function restore() {
    await restoreOrder({
      order, userEmail: user?.email, setBusy, toast, onClose
    });
  }

  // Aplica al formulario lo que ya se le mostro al usuario en el modal de
  // vista previa (OCPreviewModal) -- separado de parseOCAndFill para que
  // pegar el texto ya no escriba el formulario a ciegas. Antes, si el
  // parser interpretaba mal algo, el usuario se enteraba hasta despues de
  // guardado (asi paso con el bug real de kilos: 120 en vez de 3,700).
  function applyParsedOC(parsed: ParsedOC) {
    setForm((f: any) => ({
      ...f,
      folio: parsed.folio || f.folio,
      oc: parsed.oc || f.oc,
      client: parsed.client || f.client,
      provider: parsed.provider || f.provider || provName,
      totalKilograms: parsed.totalKilograms > 0 ? parsed.totalKilograms.toString() : f.totalKilograms,
      estimatedDeliveryDate: parsed.estimatedDeliveryDate ? Timestamp.fromDate(parsed.estimatedDeliveryDate) : f.estimatedDeliveryDate,
      items: parsed.items.length > 0 ? [...f.items, ...parsed.items] : f.items,
    }));

    const detalle = parsed.items.length > 0
      ? `${parsed.items.length} artículo(s), ${parsed.totalKilograms.toLocaleString('es-MX')} kg`
      : `Kilos: ${parsed.totalKilograms > 0 ? parsed.totalKilograms : '?'}`;
    toast(`OC aplicada. Folio: ${parsed.folio || '?'} · OC: ${parsed.oc || '?'} · ${detalle}`, 'ok');
  }

  // Se mantiene por compatibilidad (nadie mas la llama ya dentro de este
  // codebase, TabResumen ahora usa el flujo de vista previa), pero sigue
  // disponible en el contexto por si algun otro punto de entrada la usa.
  function parseOCAndFill(text: string) {
    if (!text) return;
    applyParsedOC(parseOrdenDeCompra(text));
  }

  async function retryAI() {
    setBusy(true);
    try {
      const reprocess = httpsCallable(functions, 'reprocessOrder');
      await reprocess({ orderId: order.id });
      toast('Archivo reenviado a la IA exitosamente.', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al reintentar: ${e.message}`, 'bad');
      setBusy(false);
    }
  }



  // Logic for Items and Deliveries has been moved to useOrderProducts and useOrderDeliveries

  const ctx = {
    form, setForm, set, readOnly, dynamicConfig, liveSummary, computedInvoices, order,
    allOrders, knownClients, knownProviders, knownClientEmails, provName, config, focusInvoiceId,
    fallbackSale, fallbackCost, fallbackComm, kilosNum, tab, setTab,
    kilosEntregados, kilosPedidos, kilosFaltantes, kilosPendientesDeFacturar, deliveredByItem,
    processFacturaText, processPagoText, processParsedXml, parseOCAndFill, applyParsedOC, emailClient, toast,
    printRemision: handlePrintRemision, printPreFactura: handlePrintPreFactura, printConsolidatedPackage: handlePrintConsolidatedPackage,
    save, remove, restore, clickEliminar, confirmandoEliminar, busy, setBusy, retryAI
  };

  return (
    <OrderModalContext.Provider value={ctx}>
      {children}
    </OrderModalContext.Provider>
  );
}
