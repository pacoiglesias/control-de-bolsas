import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { camposInvoices } from '../../lib/invoiceOps';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice, PurchaseOrderItem, Delivery } from '../../lib/types';
import { round2, getOrderSummary, computeFinancials, validateInvoiceWeightGuardrail } from '../../lib/finance';
import { nombreClienteVisible } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';
import { computeItemInvoiceBreakdown, linkDeliveriesToInvoice } from '../../lib/deliveries';

// Subcomponentes modulares de Facturación Rápida
import { InvoiceProgressBar } from './InvoiceProgressBar';
import { InvoiceDeliveryHistory } from './InvoiceDeliveryHistory';
import { InvoiceConceptTable, type ConceptRow } from './InvoiceConceptTable';
import { InvoiceFinancialCard } from './InvoiceFinancialCard';

export function QuickInvoiceModal({
  orders,
  initialOrderId,
  onClose,
}: {
  orders: PurchaseOrder[];
  initialOrderId?: string | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const { config } = useConfig();
  const { orders: allOrders } = useOrders();

  // Encontrar todas las órdenes activas/abiertas del ERP
  const validOrders = useMemo(() => {
    const list = orders.filter((o) => {
      if ((o as any).isDeleted) return false;
      const summary = getOrderSummary(o);
      const kOrd = Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
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
  const [saving, setSaving] = useState(false);
  const [conceptRows, setConceptRows] = useState<ConceptRow[]>([]);

  const selectedOrder = validOrders.find((o) => o.id === selectedOrderId);

  // Kilos disponibles sin facturar de la orden seleccionada
  const availableKilos = useMemo(() => {
    if (!selectedOrder) return 0;
    const summary = getOrderSummary(selectedOrder);
    const unbilledDelivered = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
    if (unbilledDelivered > 0.01) return unbilledDelivered;
    const kOrd =
      Number(selectedOrder.totalKilograms) ||
      (selectedOrder.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const unbilledOrdered = round2(Math.max(0, kOrd - summary.kilosInvoiced));
    return unbilledOrdered > 0 ? unbilledOrdered : kOrd;
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
      kilosPending: round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced)),
    };
  }, [selectedOrder]);

  const currentSellPrice = selectedOrder?.customSellPrice || config?.salePricePerKg || 43;
  const currentCostPrice = selectedOrder?.customCostPrice || config?.costPricePerKg || 38;

  // Auto-cargar conceptos al montar o cambiar orden seleccionada
  useEffect(() => {
    if (selectedOrderId) {
      handleSelectOrder(selectedOrderId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrderId]);

  const handleSelectOrder = (oId: string) => {
    setSelectedOrderId(oId);
    const order = validOrders.find((o) => o.id === oId);
    if (!order) {
      setConceptRows([]);
      return;
    }

    const breakdown = computeItemInvoiceBreakdown(order, currentSellPrice);

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
        maxAvailable: b.uninvoicedDeliveredKilos > 0 ? b.uninvoicedDeliveredKilos : b.remainingOcKilos,
      }));
      setConceptRows(rows);
    } else {
      const summary = getOrderSummary(order);
      const pendingKilos = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
      const defaultQty = pendingKilos > 0 ? pendingKilos : Number(order.totalKilograms) || 1000;
      setConceptRows([
        {
          id: `default_${Date.now()}`,
          code: '24141500',
          description: 'Bolsa de Polietileno (Venta General)',
          unit: 'KGM',
          unitPrice: currentSellPrice,
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

  const toggleRowSelect = (index: number) => {
    setConceptRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const updateRowField = <K extends keyof ConceptRow>(index: number, field: K, val: ConceptRow[K]) => {
    setConceptRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const fillRowMax = (index: number) => {
    setConceptRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].maxAvailable || next[index].quantity, selected: true };
      return next;
    });
  };

  const selectAllRows = (select: boolean) => {
    setConceptRows((prev) => prev.map((r) => ({ ...r, selected: select })));
  };

  const addNewCustomRow = () => {
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
  };

  const removeRow = (index: number) => {
    setConceptRows((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculos en tiempo real basados en los conceptos seleccionados
  const selectedRows = useMemo(() => conceptRows.filter((r) => r.selected), [conceptRows]);

  const kilosToInvoice = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0));
  }, [selectedRows]);

  const subtotalEstimado = useMemo(() => {
    return round2(
      selectedRows.reduce(
        (acc, r) => acc + (Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice),
        0
      )
    );
  }, [selectedRows, currentSellPrice]);

  const ivaRate = config?.ivaRate || 0.16;
  const ivaEstimado = round2(subtotalEstimado * ivaRate);
  const totalEstimadoConIva = round2(subtotalEstimado + ivaEstimado);

  const costoEstimado = kilosToInvoice * currentCostPrice;
  const gananciaEstimada = subtotalEstimado - costoEstimado;
  const pctAmparado =
    availableKilos > 0 ? Math.min(100, Math.round((kilosToInvoice / availableKilos) * 100)) : 0;

  // Verificación en tiempo real de factura duplicada
  const duplicateInvoice = useMemo(() => {
    if (!folio.trim()) return null;
    return findDuplicateInvoiceFolio(allOrders.length > 0 ? allOrders : orders, folio.trim());
  }, [folio, allOrders, orders]);

  const handleInvoice = async () => {
    if (!selectedOrder) return;
    if (selectedRows.length === 0) return toast('Selecciona al menos un concepto para facturar', 'bad');
    if (kilosToInvoice <= 0) return toast('Ingresa una cantidad de kilos válida en los conceptos seleccionados', 'bad');
    if (kilosToInvoice > availableKilos + 0.1) {
      return toast(
        `⚠️ Los kilos seleccionados (${kilosToInvoice.toLocaleString('es-MX')} kg) superan los disponibles (${availableKilos.toLocaleString('es-MX')} kg)`,
        'bad'
      );
    }
    if (!folio.trim()) return toast('Falta el folio de la factura', 'bad');

    if (duplicateInvoice) {
      return toast(
        `🚨 La factura #${folio.trim()} ya fue registrada en la OC #${duplicateInvoice.orderFolio}. No se permiten facturas duplicadas.`,
        'bad'
      );
    }

    setSaving(true);
    try {
      const newInvoiceId = `inv_${Date.now()}`;
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
        unitPrice: Number(r.unitPrice) || currentSellPrice,
        amount: round2((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice)),
      }));

      const conceptNotes = invoiceItems
        .map((it) => `${it.description} (${it.quantity.toLocaleString('es-MX')} kg)`)
        .join(' · ');

      const newInvoice: Invoice = {
        id: newInvoiceId,
        orderId: selectedOrder.id,
        folio: folio.trim(),
        kilos: kilosToInvoice,
        items: invoiceItems,
        financials: {
          ...baseFinancials,
          saleTotal: subtotalEstimado,
          invoiceTotal: totalEstimadoConIva,
        },
        creditCycle: {
          status: 'pending',
          issueDate: Timestamp.now(),
          dueDate: Timestamp.fromMillis(Date.now() + (config?.creditDays || 30) * 24 * 60 * 60 * 1000),
        },
        collection: {
          paidAmount: 0,
          contrareciboNumber: '',
          notes: conceptNotes ? `Conceptos: ${conceptNotes}` : '',
        },
      };

      // Vincular entregas de báscula a la factura usando el motor unificado
      const updatedDeliveries = linkDeliveriesToInvoice(
        selectedOrder.deliveries || [],
        newInvoiceId,
        kilosToInvoice
      );

      const updatedInvoices = [...(selectedOrder.invoices || []), newInvoice];

      const payload = {
        deliveries: updatedDeliveries,
        ...camposInvoices(updatedInvoices),
      };

      await updateDoc(doc(db, PATHS.orders, selectedOrder.id), payload);

      toast('✅ Factura emitida con conceptos desglosados y kilos descontados exitosamente', 'ok');
      onClose();
    } catch (e: any) {
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

  return (
    <Modal title="🧾 Facturación Rápida Multi-Concepto" onClose={onClose} wide>
      <style>{`
        @media (max-width: 600px) {
          .qim-concept-table { display: none !important; }
          .qim-concept-cards { display: flex !important; }
        }
        @media (min-width: 601px) {
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
              onApplyTemplate={applyTemplate}
              onSelectAll={selectAllRows}
              onAddNewRow={addNewCustomRow}
              onToggleRow={toggleRowSelect}
              onUpdateField={updateRowField}
              onFillMax={fillRowMax}
              onRemoveRow={removeRow}
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
              duplicateInvoice={duplicateInvoice}
              saving={saving}
              onInvoice={handleInvoice}
              onClose={onClose}
              selectedRowsCount={selectedRows.length}
              guardrail={selectedOrder ? validateInvoiceWeightGuardrail(selectedOrder, kilosToInvoice) : null}
            />
          </motion.div>
        )}
      </div>
    </Modal>
  );
}
