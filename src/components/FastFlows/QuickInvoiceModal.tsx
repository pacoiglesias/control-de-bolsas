import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Timestamp } from 'firebase/firestore';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice, PurchaseOrderItem, Delivery } from '../../lib/types';
import { addDays, round2, getOrderSummary, computeFinancials, validateInvoiceWeightGuardrail } from '../../lib/finance';
import { nombreClienteVisible, toInputDate, fromInputDate } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';
import { useDuplicateRadar } from '../../hooks/useDuplicateRadar';
import { parseXmlInvoice } from '../../lib/xmlParser';
import { resolveInvoiceDates } from '../../lib/invoiceDates';
import { computeItemInvoiceBreakdown,getDeliveryBilling } from '../../lib/deliveries';
import { useInvoiceActions } from '../OrderModal/useInvoiceActions';
import { triggerHaptic } from '../../lib/hapticEngine';
import { downloadPrefacturaExcel } from '../../lib/excelTemplateGenerator';
import { downloadCfdi40DraftXmlFile } from '../../lib/cfdiXmlGenerator';
import { generatePrefacturaContadorMessage } from '../../lib/whatsappReminder';

// Subcomponentes modulares de Facturación Rápida
import { InvoiceProgressBar } from './InvoiceProgressBar';
import { InvoiceDeliveryHistory } from './InvoiceDeliveryHistory';
import { InvoiceConceptTable, type ConceptRow } from './InvoiceConceptTable';
import { InvoiceFinancialCard } from './InvoiceFinancialCard';

export function QuickInvoiceModal({
  orders,
  initialOrderId,
  onCreated,
  onClose,
}: {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onCreated?: (invoice: Invoice) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { config } = useConfig();
  const { orders: allOrders } = useOrders();
  const { saveInvoice } = useInvoiceActions();

  // Encontrar todas las órdenes activas/abiertas del ERP
  const validOrders = useMemo(() => {
    const list = orders.filter((o) => {
      if (o.isDeleted||o.isSuperseded||(o.invoices||[]).some(invoice=>(invoice as any).quantityPending)) return false;
      const summary = getOrderSummary(o);
      const kOrd = Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const available = (o.deliveries?.length ?? 0) > 0 ? summary.kilosBillableDelivered : kOrd;
      if (available - summary.kilosInvoiced <= 0.01) return false;
      const isPaidAndDelivered =
        (o.creditCycle?.status === 'collected' || o.creditCycle?.status === 'paid') &&
        summary.kilosInvoiced >= summary.kilosDelivered - 0.01 &&
        summary.kilosDelivered >= kOrd - 0.01;
      return !isPaidAndDelivered;
    });

    return list.sort((a, b) => {
      const sa = getOrderSummary(a);
      const sb = getOrderSummary(b);
      const unbilledA = sa.kilosDelivered - sa.kilosInvoiced;
      const unbilledB = sb.kilosDelivered - sb.kilosInvoiced;
      if (unbilledA > 0.01 && unbilledB <= 0.01) return -1;
      if (unbilledB > 0.01 && unbilledA <= 0.01) return 1;
      const kOrdA = Number(a.totalKilograms) || (a.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const kOrdB = Number(b.totalKilograms) || (b.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      return kOrdA - sa.kilosDelivered - (kOrdB - sb.kilosDelivered);
    });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (initialOrderId && validOrders.some((o) => o.id === initialOrderId)) {
      return initialOrderId;
    }
    return validOrders[0]?.id || '';
  });
  const [folio, setFolio] = useState('');
  const [issueDate, setIssueDate] = useState(toInputDate(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [uuidFiscal, setUuidFiscal] = useState('');
  const [saving, setSaving] = useState(false);
  const [conceptRows, setConceptRows] = useState<ConceptRow[]>([]);

  useEffect(() => {
    if (initialOrderId && validOrders.some((o) => o.id === initialOrderId)) {
      setSelectedOrderId(initialOrderId);
    }
  }, [initialOrderId, validOrders]);

  const selectedOrder = validOrders.find((o) => o.id === selectedOrderId);

  // Kilos disponibles sin facturar de la orden seleccionada
  const availableKilos = useMemo(() => {
    if (!selectedOrder) return 0;
    const summary = getOrderSummary(selectedOrder);
    const unbilledDelivered = round2(Math.max(0, summary.kilosBillableDelivered - summary.kilosInvoiced));
    if ((selectedOrder.deliveries?.length ?? 0) > 0) return unbilledDelivered;
    const kOrd =
      Number(selectedOrder.totalKilograms) ||
      (selectedOrder.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const unbilledOrdered = round2(Math.max(0, kOrd - summary.kilosInvoiced));
    return unbilledOrdered;
  }, [selectedOrder]);

  // Datos para la barra de 4 niveles
  const progressData = useMemo(() => {
    if (!selectedOrder) return { kilosOC: 0, kilosDelivered: 0, kilosInvoiced: 0, kilosPending: 0 };
    const summary = getOrderSummary(selectedOrder);
    const kilosOC = round2(
      Number(selectedOrder.totalKilograms) ||
        (selectedOrder.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0)
    );
    return {
      kilosOC,
      kilosDelivered: round2(summary.kilosDelivered),
      kilosInvoiced: round2(summary.kilosInvoiced),
      kilosPending: round2(Math.max(0, summary.kilosBillableDelivered - summary.kilosInvoiced)),
    };
  }, [selectedOrder]);

  const uninvoicedDeliveriesList = useMemo(() => {
    const list: { orderId: string; oc: string; client: string; delivery: Delivery }[] = [];
    validOrders.forEach((o) => {
      (o.deliveries || []).forEach((d) => {
        if (getDeliveryBilling(d).pendingKilos>0) {
          list.push({
            orderId: o.id,
            oc: o.oc || o.folio || 'S/N',
            client: nombreClienteVisible(o.client),
            delivery: d,
          });
        }
      });
    });
    return list;
  }, [validOrders]);

  const currentSellPrice = selectedOrder?.customSellPrice ?? config?.salePricePerKg ?? 0;
  const currentCostPrice = selectedOrder?.customCostPrice ?? config?.costPricePerKg ?? 0;

  const loadRowsForOrder = (oId: string, ordersList: PurchaseOrder[]) => {
    const order = ordersList.find((o) => o.id === oId);
    if (!order) {
      setConceptRows([]);
      return;
    }

    const sellPrice = order.customSellPrice ?? config?.salePricePerKg ?? 0;
    const breakdown = computeItemInvoiceBreakdown(order, sellPrice);

    if (breakdown.length > 0) {
      const rows: ConceptRow[] = breakdown.map((b) => ({
        id: b.id,
        code: b.code,
        description: b.description,
        unit: b.unit,
        unitPrice: b.unitPrice,
        selected: b.selected,
        quantity: b.suggestedKilosToInvoice,
        ocQuantity: b.ocQuantity,
        alreadyInvoiced: b.alreadyInvoiced,
        alreadyDelivered: b.alreadyDelivered,
        uninvoicedDeliveredKilos: b.uninvoicedDeliveredKilos,
        remainingOcKilos: b.remainingOcKilos,
        maxAvailable: (order.deliveries?.length ?? 0) > 0 ? b.suggestedKilosToInvoice : b.remainingOcKilos,
      }));
      setConceptRows(rows);
    } else {
      const summary = getOrderSummary(order);
      const pendingKilos = round2(Math.max(0, summary.kilosBillableDelivered - summary.kilosInvoiced));
      const defaultQty = pendingKilos > 0 ? pendingKilos : Number(order.totalKilograms) || 0;
      setConceptRows([
        {
          id: `default_${Date.now()}`,
          code: '24141500',
          description: 'Bolsa de Polietileno (Venta General)',
          unit: 'KGM',
          unitPrice: sellPrice,
          selected: defaultQty > 0,
          quantity: defaultQty,
          ocQuantity: defaultQty,
          alreadyInvoiced: summary.kilosInvoiced,
          alreadyDelivered: summary.kilosDelivered,
          uninvoicedDeliveredKilos: pendingKilos,
          remainingOcKilos: defaultQty,
          maxAvailable: defaultQty,
        },
      ]);
    }
  };

  // Auto-cargar conceptos al montar o cambiar orden seleccionada o lista de órdenes
  useEffect(() => {
    if (selectedOrderId) {
      loadRowsForOrder(selectedOrderId, validOrders);
    } else if (validOrders.length > 0) {
      const firstId = validOrders[0].id;
      setSelectedOrderId(firstId);
      loadRowsForOrder(firstId, validOrders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId, validOrders]);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    loadRowsForOrder(oId, validOrders);
  };

  const applyTemplate = (items: PurchaseOrderItem[]) => {
    const totalOcKilos = round2(items.reduce((s, it) => s + Number(it.quantity || 0), 0));
    const rows: ConceptRow[] = items.map((it, idx) => {
      const ocQty = Number(it.quantity || 0);
      const q = availableKilos > 0 && totalOcKilos > 0 ? round2(availableKilos * (ocQty / totalOcKilos)) : ocQty;
      return {
        id: it.id || `item_${idx}_${Date.now()}`,
        code: it.code || '24141500',
        description: it.description || 'Bolsa de Polietileno',
        unit: it.unit || 'KGM',
        unitPrice: it.unitPrice || currentSellPrice,
        selected: q > 0,
        quantity: q > 0 ? q : 0,
        ocQuantity: ocQty,
        alreadyInvoiced: 0,
        alreadyDelivered: q,
        uninvoicedDeliveredKilos: q,
        remainingOcKilos: ocQty,
        maxAvailable: q > 0 ? q : ocQty,
      };
    });
    setConceptRows(rows);
    toast(`📦 ${rows.length} partidas de la plantilla cargadas`, 'ok');
  };

  const toggleRowSelect = useCallback((index: number) => {
    setConceptRows((prev) => {
      const next = [...prev];
      const willBeSelected = !next[index].selected;
      const currentQty = next[index].quantity;
      const maxAvail = next[index].maxAvailable;
      const newQty = willBeSelected && currentQty <= 0 && maxAvail > 0 ? maxAvail : currentQty;
      next[index] = { ...next[index], selected: willBeSelected, quantity: newQty };
      return next;
    });
  }, []);

  const updateRowField = useCallback(<K extends keyof ConceptRow>(index: number, field: K, val: ConceptRow[K]) => {
    setConceptRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  }, []);

  const fillRowMax = useCallback((index: number) => {
    setConceptRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].maxAvailable || next[index].quantity, selected: true };
      return next;
    });
  }, []);

  const selectAllRows = useCallback((select: boolean) => {
    setConceptRows((prev) =>
      prev.map((r) => {
        const newQty = select && r.quantity <= 0 && r.maxAvailable > 0 ? r.maxAvailable : r.quantity;
        return { ...r, selected: select, quantity: newQty };
      })
    );
  }, []);

  const addNewCustomRow = useCallback(() => {
    setConceptRows((prev) => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        code: '24141500',
        description: 'Concepto adicional...',
        unit: 'KGM',
        unitPrice: currentSellPrice,
        selected: true,
        quantity: 0,
        ocQuantity: 0,
        alreadyInvoiced: 0,
        alreadyDelivered: 0,
        uninvoicedDeliveredKilos: 0,
        remainingOcKilos: availableKilos,
        maxAvailable: availableKilos,
      },
    ]);
  }, [currentSellPrice, availableKilos]);

  const removeRow = useCallback((index: number) => {
    setConceptRows((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Cálculos en tiempo real basados en los conceptos seleccionados
  const selectedRows = useMemo(() => conceptRows.filter((r) => r.selected), [conceptRows]);

  const kilosToInvoice = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0));
  }, [selectedRows]);

  const subtotalEstimado = useMemo(() => {
    return round2(
      selectedRows.reduce(
        (acc, r) => acc + (Number(r.quantity) || 0) * Number(r.unitPrice),
        0
      )
    );
  }, [selectedRows]);

  const ivaRate = config?.ivaRate ?? 0.16;
  const ivaEstimado = useMemo(() => round2(subtotalEstimado * ivaRate), [subtotalEstimado, ivaRate]);
  const totalEstimadoConIva = useMemo(() => round2(subtotalEstimado + ivaEstimado), [subtotalEstimado, ivaEstimado]);

  const costoEstimado = useMemo(() => round2(kilosToInvoice * currentCostPrice), [kilosToInvoice, currentCostPrice]);
  const gananciaEstimada = useMemo(() => round2(subtotalEstimado - costoEstimado), [subtotalEstimado, costoEstimado]);
  const pctAmparado = useMemo(() => {
    return availableKilos > 0 ? Math.min(100, Math.round((kilosToInvoice / availableKilos) * 100)) : 0;
  }, [kilosToInvoice, availableKilos]);

  // Verificación en tiempo real con Radar Antiduplicados (Folio y UUID)
  const { match: duplicateInvoice } = useDuplicateRadar(allOrders.length > 0 ? allOrders : orders, {
    invoiceFolio: folio,
    uuid: uuidFiscal,
    debounceMs: 120,
  });

  const handleXmlSelected = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseXmlInvoice(text);
      if (!selectedOrder) throw new Error('Selecciona primero la orden de la factura.');
      if (parsed.tipoComprobante !== 'I') throw new Error('Selecciona una factura de ingreso; los complementos de pago se registran en Cobranza.');
      if (parsed.ocNumber && parsed.ocNumber !== selectedOrder.oc) throw new Error('El XML corresponde a otra orden de compra.');
      if (!parsed.conceptos.length || parsed.conceptos.some(concept => concept.claveUnidad !== 'KGM' || concept.cantidad <= 0)) {
        throw new Error('Este XML requiere revisión de unidades. Usa Subir documento para revisar sus conceptos.');
      }
      const importedSubtotal = round2(parsed.conceptos.reduce((sum, concept) => sum + concept.cantidad * concept.valorUnitario, 0));
      if (Math.abs(importedSubtotal - parsed.subTotal) > 0.02 || Math.abs(round2(parsed.subTotal * (1 + ivaRate)) - parsed.total) > 0.02) {
        throw new Error('Este XML contiene descuentos o impuestos distintos de la configuración. Revísalo en Subir documento antes de registrarlo.');
      }
      resolveInvoiceDates(parsed.fecha.slice(0, 10), '', config.creditDays ?? 30);
      const breakdown = computeItemInvoiceBreakdown(selectedOrder, currentSellPrice);
      setConceptRows(parsed.conceptos.map((concept, index) => {
        const matched = breakdown.find(item => (concept.codigo && item.code === concept.codigo) || item.description.trim().toLowerCase() === concept.descripcion.trim().toLowerCase());
        return { id: matched?.id ?? `xml-${index}`, code: concept.codigo || concept.claveProdServ || '24141500',
          description: concept.descripcion, unit: 'KGM', unitPrice: concept.valorUnitario, selected: true, quantity: concept.cantidad,
          ocQuantity: matched?.ocQuantity ?? 0, alreadyInvoiced: matched?.alreadyInvoiced ?? 0,
          alreadyDelivered: matched?.alreadyDelivered ?? 0, uninvoicedDeliveredKilos: matched?.uninvoicedDeliveredKilos ?? 0,
          remainingOcKilos: matched?.remainingOcKilos ?? availableKilos, maxAvailable: matched?.suggestedKilosToInvoice ?? availableKilos };
      }));
      setIssueDate(parsed.fecha.slice(0, 10)); setDueDate('');
      if (parsed.folio) setFolio(parsed.folio);
      if (parsed.uuid) setUuidFiscal(parsed.uuid);
      toast(`Factura ${parsed.folio || 'sin folio'} cargada con ${parsed.conceptos.length} conceptos. Revisa los importes y confirma el registro.`, 'ok');
    } catch (err: any) {
      toast(`Error al leer XML: ${err.message}`, 'bad');
    }
  };

  const handleInvoice = async (overrideFolio?: string) => {
    if (!selectedOrder || saving) return;
    if (selectedRows.some(row => !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0 ||
      !Number.isFinite(Number(row.unitPrice)) || Number(row.unitPrice) < 0)) {
      return toast('Cada concepto seleccionado debe tener kilos positivos y un precio válido.', 'bad');
    }
    const targetFolio = (overrideFolio || folio).trim();
    if (selectedRows.length === 0) {
      triggerHaptic('warning');
      return toast('Selecciona al menos un concepto para facturar', 'bad');
    }
    if (kilosToInvoice <= 0) {
      triggerHaptic('warning');
      return toast('Ingresa una cantidad de kilos válida en los conceptos seleccionados', 'bad');
    }
    if (kilosToInvoice > availableKilos + 0.1) {
      triggerHaptic('warning');
      return toast(
        `⚠️ Los kilos seleccionados (${kilosToInvoice.toLocaleString('es-MX')} kg) superan los disponibles (${availableKilos.toLocaleString('es-MX')} kg)`,
        'bad'
      );
    }
    if (!targetFolio) {
      triggerHaptic('warning');
      return toast('Falta el folio de la factura', 'bad');
    }

    if (duplicateInvoice && duplicateInvoice.exists) {
      triggerHaptic('warning');
      return toast(
        `🚨 El folio/UUID ya existe en la OC #${duplicateInvoice.orderFolio} (${duplicateInvoice.client}).`,
        'bad'
      );
    }

    let dates: ReturnType<typeof resolveInvoiceDates>;
    try { dates = resolveInvoiceDates(issueDate, dueDate, config.creditDays ?? 30); }
    catch (error) { return toast((error as Error).message, 'bad'); }
    setSaving(true);
    try {
      const newInvoiceId = crypto.randomUUID();
      const effectiveConfig = {
        ...config,
        salePricePerKg: currentSellPrice,
        costPricePerKg: currentCostPrice,
      };

      const baseFinancials = computeFinancials(kilosToInvoice, effectiveConfig as any);

      const invoiceItems: PurchaseOrderItem[] = selectedRows.map((r) => ({
        id: r.id,
        code: r.code || '24141500',
        description: r.description.trim(),
        quantity: Number(r.quantity) || 0,
        unit: r.unit || 'KGM',
        unitPrice: Number(r.unitPrice),
        amount: round2((Number(r.quantity) || 0) * Number(r.unitPrice)),
      }));

      const conceptNotes = invoiceItems
        .map((it) => `${it.description} (${it.quantity.toLocaleString('es-MX')} kg)`)
        .join(' · ');

      const newInvoice: Invoice = {
        id: newInvoiceId,
        orderId: selectedOrder.id,
        folio: targetFolio,
        uuid: uuidFiscal.trim() || undefined,
        kilos: kilosToInvoice,
        items: invoiceItems,
        financials: {
          ...baseFinancials,
          saleTotal: subtotalEstimado,
          invoiceTotal: totalEstimadoConIva,
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.fromDate(dates.issue),
          dueDate: Timestamp.fromDate(dates.due),
        },
        collection: {
          paidAmount: 0,
          contrareciboNumber: '',
          notes: conceptNotes ? `Conceptos: ${conceptNotes}` : '',
        },
      };

      // La misma transacción actualiza la OC, sus entregas y el espejo de cobranza.
      // Los límites se vuelven a comprobar con el expediente actual del servidor.
      await saveInvoice(selectedOrder, newInvoice, effectiveConfig);

      triggerHaptic('success');
      onCreated?.(newInvoice);
      onClose();
    } catch (e: any) {
      triggerHaptic('error');
      toast(`Error al facturar: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  // Entregas de la orden seleccionada
  const orderDeliveries = useMemo((): Delivery[] => {
    if (!selectedOrder) return [];
    return [...(selectedOrder.deliveries || [])].sort((a, b) => {
      if (!a.invoiced && b.invoiced) return -1;
      if (a.invoiced && !b.invoiced) return 1;
      const da = a.date
        ? typeof (a.date as any).toDate === 'function'
          ? (a.date as any).toDate().getTime()
          : new Date(a.date as any).getTime()
        : 0;
      const db2 = b.date
        ? typeof (b.date as any).toDate === 'function'
          ? (b.date as any).toDate().getTime()
          : new Date(b.date as any).getTime()
        : 0;
      return db2 - da;
    });
  }, [selectedOrder]);

  const handleDownloadPrefactura = () => {
    if (!selectedOrder) {
      toast('⚠️ Selecciona un expediente primero', 'bad');
      return;
    }
    if (selectedRows.length === 0) {
      triggerHaptic('warning');
      toast('⚠️ Selecciona al menos una partida para la prefactura', 'bad');
      return;
    }

    triggerHaptic('success');
    const ocNum = selectedOrder.oc || selectedOrder.folio || 'S/N';

    downloadPrefacturaExcel({
      clientName: selectedOrder.client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      clientRfc: 'GTP930115PU1',
      clientAddress: 'HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO',
      clientUsoCfdi: 'Uso CFDI: G01 - Adquisición de mercancias',
      oc: ocNum,
      notaCondiciones: `OC ${ocNum}`,
      items: selectedRows.map((r) => {
        const desc = r.code && !r.description.toLowerCase().includes(r.code.toLowerCase())
          ? `${r.code} ${r.description}`
          : r.description;
        return {
          kilos: Number(r.quantity) || 0,
          description: desc,
          unitPrice: Number(r.unitPrice) || currentSellPrice,
        };
      }),
      metodoPago: 'PPD',
      formaPago: '99 por definir',
      claveSat: '24141500',
      unidadSat: 'KGM',
    });

    toast(`📊 Prefactura Excel descargada para OC ${ocNum}`, 'ok');
  };

  const handleDownloadXmlDraft = () => {
    if (!selectedOrder) {
      toast('⚠️ Selecciona un expediente primero', 'bad');
      return;
    }
    if (selectedRows.length === 0) {
      triggerHaptic('warning');
      toast('⚠️ Selecciona al menos una partida para el borrador XML', 'bad');
      return;
    }

    triggerHaptic('success');
    const ocNum = selectedOrder.oc || selectedOrder.folio || 'S/N';

    downloadCfdi40DraftXmlFile({
      ocNumber: ocNum,
      clientName: selectedOrder.client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      clientRfc: 'GTP930115PU1',
      clientPostalCode: '90800',
      clientRegimen: '601',
      clientUsoCfdi: 'G01',
      items: selectedRows.map((r) => {
        const sub = round2((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice));
        const iva = round2(sub * 0.16);
        return {
          code: r.code || 'BOLSA',
          description: r.description,
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || currentSellPrice,
          subtotal: sub,
          iva,
          total: round2(sub + iva),
        };
      }),
    });

    toast(`📄 Borrador XML CFDI 4.0 descargado para OC ${ocNum}`, 'ok');
  };

  const handleWhatsAppContador = () => {
    if (!selectedOrder) {
      toast('⚠️ Selecciona un expediente primero', 'bad');
      return;
    }
    if (selectedRows.length === 0) {
      triggerHaptic('warning');
      toast('⚠️ Selecciona al menos una partida para la prefactura', 'bad');
      return;
    }

    triggerHaptic('success');
    const ocNum = selectedOrder.oc || selectedOrder.folio || 'S/N';
    const msg = generatePrefacturaContadorMessage({
      oc: ocNum,
      client: nombreClienteVisible(selectedOrder.client),
      kilos: kilosToInvoice,
      subtotal: subtotalEstimado,
      iva: ivaEstimado,
      total: totalEstimadoConIva,
      itemsCount: selectedRows.length,
    });

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(msg);
      toast('📲 Mensaje copiado al portapapeles. ¡Pégalo en WhatsApp junto con el Excel!', 'ok');
    }

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <Modal title="Registrar factura" onClose={onClose} wide>
      <style>{`
        @media (max-width: 680px) {
          .qim-concept-table { display: none !important; }
          .qim-concept-cards { display: flex !important; }
        }
        @media (min-width: 681px) {
          .qim-concept-table { display: block !important; }
          .qim-concept-cards { display: none !important; }
        }
      `}</style>

      <div style={{ padding: '4px 0' }}>
        {/* ENCABEZADO EXPLICATIVO */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(59,130,246,0.12) 100%)',
            border: '1px solid rgba(59,130,246,0.2)',
            padding: '12px 16px',
            borderRadius: 12,
            marginBottom: 18,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 22 }}>⚡</span>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            <strong>Facturación Inteligente por Partidas:</strong> Descuenta automáticamente las entregas y facturas ya emitidas para amparar únicamente los kilos reales pendientes.
          </div>
        </div>

        <div className="invoice-dates"><label>Fecha de la factura<input className="input" type="date" value={issueDate} onChange={e => { setIssueDate(e.target.value); setDueDate(''); }} required /></label><label>Fecha de vencimiento<input className="input" type="date" value={dueDate || toInputDate(addDays(fromInputDate(issueDate) || new Date(), config.creditDays ?? 30))} onChange={e => setDueDate(e.target.value)} required /></label></div>
        {/* 1. SELECCIÓN DE EXPEDIENTE */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
            1. Seleccionar Expediente / OC
          </label>
          <select
            value={selectedOrderId}
            onChange={(e) => handleSelectOrder(e.target.value)}
            className="input boxed"
            style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px 14px', borderRadius: 10 }}
          >
            <option value="">-- Selecciona un expediente activo --</option>
            {validOrders.map((o) => {
              const summary = getOrderSummary(o);
              const pendingDelivered = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
              const kOrd =
                Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
              const pendingOrdered = round2(Math.max(0, kOrd - summary.kilosInvoiced));
              const label =
                pendingDelivered > 0.01
                  ? `${pendingDelivered.toLocaleString('es-MX')} kg listos de báscula`
                  : `${pendingOrdered.toLocaleString('es-MX')} kg pendientes de OC`;
              return (
                <option key={o.id} value={o.id}>
                  {o.folio || o.oc || 'S/N'} · {nombreClienteVisible(o.client)} — ({label})
                </option>
              );
            })}
          </select>
          {validOrders.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--ink-soft)' }}>
              ℹ️ No hay expedientes activos pendientes de facturación en este momento.
            </div>
          )}

          {/* CHIPS DE ACCIÓN RÁPIDA: ENTREGAS EN PATIO LISTAS PARA FACTURAR */}
          {uninvoicedDeliveriesList.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚡ Cargar Entrega de Patio en 1 Clic:
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {uninvoicedDeliveriesList.map((item, idx) => (
                  <button
                    key={`${item.orderId}_${idx}`}
                    type="button"
                    onClick={() => {
                      handleSelectOrder(item.orderId);
                      toast(`⚡ Orden ${item.oc} (${Number(item.delivery.kilos).toLocaleString('es-MX')} kg) cargada lista para facturar`, 'ok');
                    }}
                    style={{
                      background: selectedOrderId === item.orderId ? '#d97706' : 'rgba(217, 119, 6, 0.12)',
                      color: selectedOrderId === item.orderId ? '#fff' : '#b45309',
                      border: '1px solid rgba(217, 119, 6, 0.35)',
                      borderRadius: 8,
                      padding: '5px 12px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>🚚</span>
                    <span>{(item.delivery as any).remision || (item.delivery as any).remisionNumber || item.delivery.notes || 'Báscula'}: {Number(item.delivery.kilos).toLocaleString('es-MX')} kg ({item.client})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {/* 1. Barra de Progreso de 4 Niveles */}
            <InvoiceProgressBar {...progressData} />

            {/* 2. Historial de Entregas de Báscula */}
            <InvoiceDeliveryHistory deliveries={orderDeliveries} order={selectedOrder} />

            {/* 3. Tabla Interactiva de Partidas */}
            <InvoiceConceptTable
              conceptRows={conceptRows}
              selectedRows={selectedRows}
              availableKilos={availableKilos}
              kilosToInvoice={kilosToInvoice}
              pctAmparado={pctAmparado}
              currentSellPrice={currentSellPrice}
              selectedOrder={selectedOrder}
              onReloadOrderItems={() => {
                if (selectedOrderId) {
                  loadRowsForOrder(selectedOrderId, validOrders);
                  toast('🎯 Conceptos sincronizados con la OC activa', 'ok');
                }
              }}
              onApplyTemplate={applyTemplate}
              onSelectAll={selectAllRows}
              onAddNewRow={addNewCustomRow}
              onToggleRow={toggleRowSelect}
              onUpdateField={updateRowField}
              onFillMax={fillRowMax}
              onRemoveRow={removeRow}
              onDownloadPrefactura={handleDownloadPrefactura}
            />

            {/* 4. Resumen Financiero y Folio SAT */}
            <InvoiceFinancialCard
              kilosToInvoice={kilosToInvoice}
              subtotalEstimado={subtotalEstimado}
              ivaEstimado={ivaEstimado}
              totalEstimadoConIva={totalEstimadoConIva}
              costoEstimado={costoEstimado}
              gananciaEstimada={gananciaEstimada}
              currentSellPrice={currentSellPrice}
              currentCostPrice={currentCostPrice}
              folio={folio}
              setFolio={setFolio}
              uuidFiscal={uuidFiscal}
              duplicateInvoice={duplicateInvoice}
              saving={saving}
              onInvoice={() => handleInvoice()}
              onClose={onClose}
              onDownloadPrefactura={handleDownloadPrefactura}
              onDownloadXmlDraft={handleDownloadXmlDraft}
              onWhatsAppContador={handleWhatsAppContador}
              onXmlSelected={handleXmlSelected}
              selectedRowsCount={selectedRows.length}
              guardrail={selectedOrder ? validateInvoiceWeightGuardrail(selectedOrder, kilosToInvoice) : null}
            />
          </motion.div>
        )}
      </div>
    </Modal>
  );
}
