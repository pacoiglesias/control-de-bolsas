import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { useOrders } from '../../hooks/useOrders';
import { camposInvoices } from '../../lib/invoiceOps';
import { Modal } from '../ui';
import type { PurchaseOrder, Invoice, PurchaseOrderItem, Delivery } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { useConfig } from '../../hooks/useConfig';
import { computeFinancials, round2, getOrderSummary } from '../../lib/finance';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';

interface ConceptRow {
  id: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  selected: boolean;
  quantity: number;
  maxAvailable: number;
}

// ─── Sub-componente: Barra de Progreso de 4 Niveles ────────────────────────
function DeliveryProgressBar({
  kilosOC,
  kilosDelivered,
  kilosInvoiced,
  kilosPending,
}: {
  kilosOC: number;
  kilosDelivered: number;
  kilosInvoiced: number;
  kilosPending: number;
}) {
  const base = Math.max(kilosOC, kilosDelivered, 0.01);
  const pctDelivered = Math.min(100, Math.round((kilosDelivered / base) * 100));
  const pctInvoiced  = Math.min(100, Math.round((kilosInvoiced  / base) * 100));

  return (
    <div style={{ background: 'var(--paper-sunk)', padding: '14px 16px', borderRadius: 12, border: '1px solid var(--line-soft)' }}>
      {/* Fila de totales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 14 }}>
        <StatChip label="OC Pedida" value={`${kilosOC.toLocaleString('es-MX')} kg`} color="var(--ink-soft)" />
        <StatChip label="Entregado" value={`${kilosDelivered.toLocaleString('es-MX')} kg`} color="#2563eb" />
        <StatChip label="Ya Facturado" value={`${kilosInvoiced.toLocaleString('es-MX')} kg`} color="#7c3aed" />
        <StatChip
          label="⚡ Por Facturar"
          value={`${kilosPending.toLocaleString('es-MX')} kg`}
          color={kilosPending > 0.01 ? '#059669' : 'var(--ink-soft)'}
          highlight={kilosPending > 0.01}
        />
      </div>

      {/* Barra: Entregado vs OC */}
      <ProgressRow label="Entregado / OC" pct={pctDelivered} color="linear-gradient(90deg,#3b82f6,#2563eb)" />
      {/* Barra: Facturado vs OC */}
      <ProgressRow label="Facturado / OC" pct={pctInvoiced}  color="linear-gradient(90deg,#7c3aed,#6d28d9)" />
    </div>
  );
}

function StatChip({ label, value, color, highlight }: { label: string; value: string; color: string; highlight?: boolean }) {
  return (
    <div style={{
      background: highlight ? 'rgba(5,150,105,0.07)' : 'var(--paper-raised)',
      border: highlight ? '1px solid rgba(5,150,105,0.3)' : '1px solid var(--line-soft)',
      borderRadius: 8, padding: '6px 10px',
    }}>
      <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div className="mono" style={{ fontWeight: 800, fontSize: 13, color }}>{value}</div>
    </div>
  );
}

function ProgressRow({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'var(--ink-soft)', marginBottom: 3 }}>
        <span>{label}</span>
        <span className="mono" style={{ fontWeight: 700 }}>{pct}%</span>
      </div>
      <div style={{ width: '100%', height: 7, background: 'rgba(0,0,0,0.1)', borderRadius: 999, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', damping: 22, stiffness: 180 }}
          style={{ height: '100%', background: color, borderRadius: 999 }}
        />
      </div>
    </div>
  );
}

// ─── Sub-componente: Historial de Entregas de Báscula ───────────────────────
function DeliveryHistoryPanel({ deliveries, order }: { deliveries: Delivery[]; order: PurchaseOrder }) {
  const [collapsed, setCollapsed] = useState(false);

  if (deliveries.length === 0) {
    return (
      <div style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 18 }}>📭</span>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
          <strong style={{ color: 'var(--ink)' }}>Sin entregas registradas en báscula.</strong><br />
          Los kilos se calcularán desde la cantidad de la OC.
        </div>
      </div>
    );
  }

  const pendingDeliveries  = deliveries.filter(d => !d.invoiced);
  const invoicedDeliveries = deliveries.filter(d => d.invoiced);

  const deliveryKilos = (d: Delivery) =>
    d.items && d.items.length > 0
      ? round2(d.items.reduce((s, it) => s + Number(it.quantity || 0), 0))
      : round2(Number(d.kilos || 0));

  const totalPending  = round2(pendingDeliveries.reduce((s, d) => s + deliveryKilos(d), 0));
  const totalInvoiced = round2(invoicedDeliveries.reduce((s, d) => s + deliveryKilos(d), 0));

  return (
    <div style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', textAlign: 'left', padding: '12px 16px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          borderBottom: collapsed ? 'none' : '1px solid var(--line-soft)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🚚</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
              Historial de Entregas en Báscula
              <span className="badge" style={{ marginLeft: 8, background: '#2563eb', fontSize: 10 }}>
                {deliveries.length} entrega{deliveries.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 1 }}>
              {pendingDeliveries.length > 0
                ? `${pendingDeliveries.length} sin facturar (${totalPending.toLocaleString('es-MX')} kg)`
                : 'Todas las entregas ya facturadas'}
              {invoicedDeliveries.length > 0 && ` · ${invoicedDeliveries.length} facturada${invoicedDeliveries.length !== 1 ? 's' : ''} (${totalInvoiced.toLocaleString('es-MX')} kg)`}
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: 'var(--ink-soft)', transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Entregas sin facturar primero */}
          {pendingDeliveries.map(d => (
            <DeliveryRow key={d.id} delivery={d} kilos={deliveryKilos(d)} invoiced={false} order={order} />
          ))}
          {/* Separador si hay ambos tipos */}
          {pendingDeliveries.length > 0 && invoicedDeliveries.length > 0 && (
            <div style={{ borderTop: '1px dashed var(--line-soft)', margin: '4px 0', padding: '4px 0', fontSize: 10.5, color: 'var(--ink-soft)', textAlign: 'center' }}>
              ── ya facturadas ──
            </div>
          )}
          {/* Entregas ya facturadas */}
          {invoicedDeliveries.map(d => (
            <DeliveryRow key={d.id} delivery={d} kilos={deliveryKilos(d)} invoiced order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryRow({ delivery: d, kilos, invoiced, order }: { delivery: Delivery; kilos: number; invoiced: boolean; order: PurchaseOrder }) {
  const dateStr = d.date
    ? (typeof (d.date as any).toDate === 'function'
        ? (d.date as any).toDate().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
        : new Date(d.date as any).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }))
    : 'Sin fecha';

  // Encontrar la factura vinculada si existe
  const linkedInvoice = invoiced && d.invoiceId
    ? (order.invoices || []).find(inv => inv.id === d.invoiceId)
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 10px', borderRadius: 8,
      background: invoiced ? 'rgba(0,0,0,0.03)' : 'rgba(5,150,105,0.06)',
      border: invoiced ? '1px solid var(--line-soft)' : '1px solid rgba(5,150,105,0.25)',
      opacity: invoiced ? 0.75 : 1,
    }}>
      {/* Icono estado */}
      <span style={{ fontSize: 16, flexShrink: 0 }}>{invoiced ? '✅' : '🔴'}</span>

      {/* Info principal */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: invoiced ? 'var(--ink-soft)' : 'var(--ink)' }}>
            {kilos.toLocaleString('es-MX')} kg
          </span>
          {d.docFolio && (
            <span className="mono" style={{ fontSize: 10.5, color: '#2563eb', background: 'rgba(37,99,235,0.08)', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
              {d.docType === 'remision' ? 'Rem.' : d.docType === 'factura' ? 'Fac.' : ''} {d.docFolio}
            </span>
          )}
          {d.driver && (
            <span style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>· {d.driver}</span>
          )}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', marginTop: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span>📅 {dateStr}</span>
          {linkedInvoice?.folio && (
            <span style={{ color: '#7c3aed' }}>· Factura #{linkedInvoice.folio}</span>
          )}
          {d.notes && <span>· {d.notes}</span>}
        </div>
        {/* Items detallados si existen */}
        {d.items && d.items.length > 1 && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {d.items.map((it, i) => {
              const ocItem = (order.items || []).find(oi => oi.id === it.itemId || oi.code === it.itemId);
              return (
                <span key={i} style={{ fontSize: 10, background: 'var(--paper-sunk)', padding: '1px 6px', borderRadius: 4, color: 'var(--ink-soft)' }}>
                  {ocItem?.description || it.itemId}: {Number(it.quantity || 0).toLocaleString('es-MX')} kg
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Badge estado */}
      <span className="badge" style={{
        fontSize: 9.5, padding: '2px 7px', flexShrink: 0,
        background: invoiced ? 'rgba(124,58,237,0.12)' : 'rgba(5,150,105,0.15)',
        color: invoiced ? '#7c3aed' : '#059669',
        border: invoiced ? '1px solid rgba(124,58,237,0.25)' : '1px solid rgba(5,150,105,0.3)',
      }}>
        {invoiced ? 'Facturada' : 'Sin facturar'}
      </span>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────
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
    const list = orders.filter(o => {
      if ((o as any).isDeleted) return false;
      const summary = getOrderSummary(o);
      const kOrd = Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
      const isPaidAndDelivered = (o.creditCycle?.status === 'collected' || o.creditCycle?.status === 'paid') && summary.kilosInvoiced >= summary.kilosDelivered - 0.01 && summary.kilosDelivered >= kOrd - 0.01;
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
      return (kOrdA - sa.kilosDelivered) - (kOrdB - sb.kilosDelivered);
    });
  }, [orders]);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    if (initialOrderId && validOrders.some(o => o.id === initialOrderId)) {
      return initialOrderId;
    }
    return validOrders[0]?.id || '';
  });
  const [folio, setFolio] = useState('');
  const [saving, setSaving] = useState(false);
  const [conceptRows, setConceptRows] = useState<ConceptRow[]>([]);

  const selectedOrder = validOrders.find(o => o.id === selectedOrderId);
  
  // Kilos disponibles sin facturar de la orden seleccionada
  const availableKilos = useMemo(() => {
    if (!selectedOrder) return 0;
    const summary = getOrderSummary(selectedOrder);
    const unbilledDelivered = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
    if (unbilledDelivered > 0.01) return unbilledDelivered;
    const kOrd = Number(selectedOrder.totalKilograms) || (selectedOrder.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
    const unbilledOrdered = round2(Math.max(0, kOrd - summary.kilosInvoiced));
    return unbilledOrdered > 0 ? unbilledOrdered : kOrd;
  }, [selectedOrder]);

  // Datos para la barra de 4 niveles
  const progressData = useMemo(() => {
    if (!selectedOrder) return { kilosOC: 0, kilosDelivered: 0, kilosInvoiced: 0, kilosPending: 0 };
    const summary = getOrderSummary(selectedOrder);
    const kilosOC = round2(Number(selectedOrder.totalKilograms) || (selectedOrder.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0));
    return {
      kilosOC,
      kilosDelivered: round2(summary.kilosDelivered),
      kilosInvoiced:  round2(summary.kilosInvoiced),
      kilosPending:   round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced)),
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
    const order = validOrders.find(o => o.id === oId);
    if (!order) {
      setConceptRows([]);
      return;
    }

    const summary = getOrderSummary(order);
    const pendingKilos = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
    const uninvoicedDeliveries = (order.deliveries || []).filter(d => !d.invoiced);

    // Total de kilos sin facturar de entregas que no tienen items detallados
    const uninvoicedKilosFlat = round2(uninvoicedDeliveries
      .filter(d => !d.items || d.items.length === 0)
      .reduce((sum, d) => sum + Number(d.kilos || 0), 0));

    if (order.items && order.items.length > 0) {
      const totalOCKilos = round2(order.items.reduce((s, it) => s + Number(it.quantity || 0), 0));

      const rows: ConceptRow[] = order.items.map((it, idx) => {
        // 1. Intentar calcular desde items detallados de entregas
        const deliveredPendingDetailed = uninvoicedDeliveries.reduce((sum, d) => {
          const di = (d.items || []).find((x: any) => x.itemId === it.id || x.itemId === it.code);
          return sum + (di ? Number(di.quantity || 0) : 0);
        }, 0);

        // 2. Fallback proporcional: si la entrega no tiene items por partida,
        //    distribuir los kilos planos proporcionalmente al peso de esta partida en la OC
        let maxAvail = round2(deliveredPendingDetailed);
        if (maxAvail < 0.01 && uninvoicedKilosFlat > 0 && totalOCKilos > 0) {
          const proporcion = Number(it.quantity || 0) / totalOCKilos;
          maxAvail = round2(uninvoicedKilosFlat * proporcion);
        }

        // 3. Si sigue en 0 pero hay solo 1 partida y hay pendingKilos, usarlos directamente
        if (maxAvail < 0.01 && order.items!.length === 1 && pendingKilos > 0) {
          maxAvail = pendingKilos;
        }

        return {
          id: it.id || `item_${idx}_${Date.now()}`,
          code: it.code || '24111500',
          description: it.description || 'Bolsa de Polietileno',
          unit: it.unit || 'KGM',
          unitPrice: it.unitPrice || currentSellPrice,
          selected: maxAvail > 0 || (order.items!.length === 1),
          quantity: maxAvail > 0 ? maxAvail : Number(it.quantity || 0),
          maxAvailable: maxAvail > 0 ? maxAvail : Number(it.quantity || 0),
        };
      });
      setConceptRows(rows);
    } else {
      setConceptRows([{
        id: `default_${Date.now()}`,
        code: '24111500',
        description: 'Bolsa de Polietileno (Venta General)',
        unit: 'KGM',
        unitPrice: currentSellPrice,
        selected: true,
        quantity: pendingKilos,
        maxAvailable: pendingKilos,
      }]);
    }
  };

  const toggleRowSelect = (index: number) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const updateRowField = <K extends keyof ConceptRow>(index: number, field: K, val: ConceptRow[K]) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const fillRowMax = (index: number) => {
    setConceptRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: next[index].maxAvailable || next[index].quantity, selected: true };
      return next;
    });
  };

  const selectAllRows = (select: boolean) => {
    setConceptRows(prev => prev.map(r => ({ ...r, selected: select })));
  };

  const addNewCustomRow = () => {
    setConceptRows(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        code: '24111500',
        description: 'Concepto adicional...',
        unit: 'KGM',
        unitPrice: currentSellPrice,
        selected: true,
        quantity: 0,
        maxAvailable: availableKilos,
      }
    ]);
  };

  const removeRow = (index: number) => {
    setConceptRows(prev => prev.filter((_, i) => i !== index));
  };

  // Cálculos en tiempo real basados en los conceptos seleccionados
  const selectedRows = useMemo(() => conceptRows.filter(r => r.selected), [conceptRows]);

  const kilosToInvoice = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + (Number(r.quantity) || 0), 0));
  }, [selectedRows]);

  const subtotalEstimado = useMemo(() => {
    return round2(selectedRows.reduce((acc, r) => acc + ((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice)), 0));
  }, [selectedRows, currentSellPrice]);

  const ivaRate = config?.ivaRate || 0.16;
  const ivaEstimado = round2(subtotalEstimado * ivaRate);
  const totalEstimadoConIva = round2(subtotalEstimado + ivaEstimado);

  const costoEstimado = kilosToInvoice * currentCostPrice;
  const gananciaEstimada = subtotalEstimado - costoEstimado;
  const pctAmparado = availableKilos > 0 ? Math.min(100, Math.round((kilosToInvoice / availableKilos) * 100)) : 0;

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
      return toast(`⚠️ Los kilos seleccionados (${kilosToInvoice.toLocaleString('es-MX')} kg) superan los entregados pendientes (${availableKilos.toLocaleString('es-MX')} kg)`, 'bad');
    }
    if (!folio.trim()) return toast('Falta el folio de la factura', 'bad');

    if (duplicateInvoice) {
      return toast(`🚨 La factura #${folio.trim()} ya fue registrada en la OC #${duplicateInvoice.orderFolio}. No se permiten facturas duplicadas.`, 'bad');
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
      
      const invoiceItems: PurchaseOrderItem[] = selectedRows.map(r => ({
        id: r.id,
        code: r.code || '24111500',
        description: r.description.trim(),
        quantity: Number(r.quantity) || 0,
        unit: r.unit || 'KGM',
        unitPrice: Number(r.unitPrice) || currentSellPrice,
        amount: round2((Number(r.quantity) || 0) * (Number(r.unitPrice) || currentSellPrice)),
      }));

      const conceptNotes = invoiceItems.map(it => `${it.description} (${it.quantity.toLocaleString('es-MX')} kg)`).join(' · ');

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
        }
      };

      // Mark deliveries as invoiced
      let remainingToInvoice = kilosToInvoice;
      const updatedDeliveries = (selectedOrder.deliveries || []).map(d => {
        const dKilos = (d.items && d.items.length > 0)
          ? d.items.reduce((sum, it) => sum + Number(it.quantity || 0), 0)
          : Number(d.kilos || 0);

        if (!d.invoiced && dKilos > 0 && remainingToInvoice > 0) {
          const inv = Math.min(dKilos, remainingToInvoice);
          remainingToInvoice -= inv;
          return { ...d, invoiced: true, invoiceId: newInvoiceId };
        }
        return d;
      });

      const updatedInvoices = [...(selectedOrder.invoices || []), newInvoice];
      
      const payload = {
        deliveries: updatedDeliveries,
        ...camposInvoices(updatedInvoices)
      };

      await updateDoc(doc(db, PATHS.orders, selectedOrder.id), payload);

      toast('✅ Factura emitida con conceptos desglosados y vinculada exitosamente', 'ok');
      onClose();
    } catch (e: any) {
      toast(`Error al facturar: ${e.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  // Entregas de la orden seleccionada (ordenadas: sin facturar primero, luego por fecha desc)
  const orderDeliveries = useMemo((): Delivery[] => {
    if (!selectedOrder) return [];
    return [...(selectedOrder.deliveries || [])].sort((a, b) => {
      if (!a.invoiced && b.invoiced) return -1;
      if (a.invoiced && !b.invoiced) return 1;
      const da = a.date ? (typeof (a.date as any).toDate === 'function' ? (a.date as any).toDate().getTime() : new Date(a.date as any).getTime()) : 0;
      const db2 = b.date ? (typeof (b.date as any).toDate === 'function' ? (b.date as any).toDate().getTime() : new Date(b.date as any).getTime()) : 0;
      return db2 - da;
    });
  }, [selectedOrder]);

  return (
    <Modal title="🧾 Facturación Rápida Multi-Concepto" onClose={onClose} wide>
      {/* Estilos inline para media queries móvil */}
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
        <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(59,130,246,0.12) 100%)', border: '1px solid rgba(59,130,246,0.2)', padding: '12px 16px', borderRadius: 12, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚡</span>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            <strong>Facturación Inteligente por Partidas:</strong> Revisa las entregas de báscula, marca los conceptos a amparar y genera la factura con desglose fiscal SAT.
          </div>
        </div>

        {/* 1. SELECCIÓN DE EXPEDIENTE */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
            1. Seleccionar Expediente / OC con Entregas Recibidas
          </label>
          <select 
            value={selectedOrderId} 
            onChange={e => handleSelectOrder(e.target.value)}
            className="input boxed"
            style={{ width: '100%', fontSize: 14, fontWeight: 600, padding: '10px 14px', borderRadius: 10 }}
          >
            <option value="">-- Selecciona un expediente activo --</option>
            {validOrders.map(o => {
              const summary = getOrderSummary(o);
              const pendingDelivered = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
              const kOrd = Number(o.totalKilograms) || (o.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
              const pendingOrdered = round2(Math.max(0, kOrd - summary.kilosInvoiced));
              const label = pendingDelivered > 0.01 
                ? `${pendingDelivered.toLocaleString('es-MX')} kg listos de báscula`
                : `${pendingOrdered.toLocaleString('es-MX')} kg de OC`;
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
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* ─── BARRA DE PROGRESO 4 NIVELES ─────────── */}
            <DeliveryProgressBar {...progressData} />

            {/* ─── HISTORIAL DE ENTREGAS DE BÁSCULA ─────────── */}
            <DeliveryHistoryPanel deliveries={orderDeliveries} order={selectedOrder} />

            {/* ─── SELECTOR INTERACTIVO DE CONCEPTOS Y PARTIDAS ─────────── */}
            <div style={{ background: 'var(--paper-raised)', padding: 16, borderRadius: 14, border: '1px solid var(--line)', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📦</span> 2. Conceptos a Incluir en la Factura ({selectedRows.length} de {conceptRows.length} seleccionados)
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Confirma qué partidas ampara esta factura y ajusta los kilos si es necesario.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11.5, padding: '4px 10px', background: 'var(--paper)', border: '1px solid var(--line)' }}
                    onClick={() => selectAllRows(true)}
                  >
                    ⚡ Todos
                  </button>
                  <button
                    type="button"
                    className="btn"
                    style={{ fontSize: 11.5, padding: '4px 10px', background: 'var(--paper)', border: '1px solid var(--line)' }}
                    onClick={() => selectAllRows(false)}
                  >
                    Ninguno
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ fontSize: 11.5, padding: '4px 12px' }}
                    onClick={addNewCustomRow}
                  >
                    ➕ Agregar
                  </button>
                </div>
              </div>

              {/* Resumen de kilos seleccionados */}
              {availableKilos > 0 && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--ink-soft)' }}>Amparando:</span>
                  <span className="mono" style={{ fontWeight: 800, color: 'var(--ink)' }}>{kilosToInvoice.toLocaleString('es-MX')} kg</span>
                  <span style={{ color: 'var(--ink-soft)' }}>de</span>
                  <span className="mono" style={{ fontWeight: 700, color: '#2563eb' }}>{availableKilos.toLocaleString('es-MX')} kg disponibles</span>
                  <span className="badge" style={{ background: pctAmparado === 100 ? '#059669' : '#2563eb', fontSize: 10 }}>
                    {pctAmparado}%
                  </span>
                </div>
              )}

              {conceptRows.length > 0 ? (
                <>
                  {/* ── TABLA (desktop) ── */}
                  <div className="qim-concept-table">
                    <div className="table-scroll" style={{ maxHeight: 280, overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: 12, width: '100%' }}>
                        <thead>
                          <tr>
                            <th style={{ width: 40, textAlign: 'center' }}>✓</th>
                            <th style={{ width: 115 }}>Clave SAT</th>
                            <th>Descripción del Concepto</th>
                            <th className="num" style={{ width: 145 }}>Kilos Facturar</th>
                            <th className="num" style={{ width: 100 }}>P. Unitario</th>
                            <th className="num" style={{ width: 115 }}>Importe</th>
                            <th style={{ width: 32 }}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <AnimatePresence>
                            {conceptRows.map((row, idx) => {
                              const rowAmount = round2((Number(row.quantity) || 0) * (Number(row.unitPrice) || currentSellPrice));
                              return (
                                <motion.tr 
                                  key={row.id || idx}
                                  layout
                                  initial={{ opacity: 0, y: 4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  style={{ 
                                    background: row.selected ? 'rgba(37,99,235,0.06)' : 'transparent',
                                    borderLeft: row.selected ? '3px solid #2563eb' : '3px solid transparent',
                                    opacity: row.selected ? 1 : 0.6,
                                    transition: 'all 0.2s ease'
                                  }}
                                >
                                  <td style={{ textAlign: 'center' }}>
                                    <input 
                                      type="checkbox" 
                                      checked={row.selected} 
                                      onChange={() => toggleRowSelect(idx)}
                                      style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#2563eb' }}
                                    />
                                  </td>
                                  <td>
                                    <input 
                                      type="text"
                                      className="input boxed mono"
                                      value={row.code}
                                      onChange={e => updateRowField(idx, 'code', e.target.value)}
                                      placeholder="24111500"
                                      style={{ fontSize: 11.5, padding: '4px 6px', fontWeight: 600, color: '#1e40af' }}
                                      disabled={!row.selected}
                                    />
                                  </td>
                                  <td>
                                    <input 
                                      type="text"
                                      className="input boxed"
                                      value={row.description}
                                      onChange={e => updateRowField(idx, 'description', e.target.value)}
                                      placeholder="Descripción del producto..."
                                      style={{ fontSize: 12, padding: '4px 8px', fontWeight: row.selected ? 700 : 400 }}
                                      disabled={!row.selected}
                                    />
                                  </td>
                                  <td className="num">
                                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                                      <input 
                                        type="number"
                                        step="0.01"
                                        className="input boxed mono"
                                        value={row.quantity || ''}
                                        onChange={e => updateRowField(idx, 'quantity', Number(e.target.value))}
                                        style={{ width: 85, textAlign: 'right', fontWeight: 800, padding: '4px 6px' }}
                                        disabled={!row.selected}
                                      />
                                      {row.maxAvailable > 0 && row.quantity !== row.maxAvailable && (
                                        <button
                                          type="button"
                                          onClick={() => fillRowMax(idx)}
                                          className="chip"
                                          style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(37,99,235,0.12)', color: '#1d4ed8', border: 'none', cursor: 'pointer', fontWeight: 800 }}
                                          title="Llenar máximo disponible"
                                        >
                                          Máx
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                  <td className="num">
                                    <input 
                                      type="number"
                                      step="0.01"
                                      className="input boxed mono"
                                      value={row.unitPrice || ''}
                                      onChange={e => updateRowField(idx, 'unitPrice', Number(e.target.value))}
                                      style={{ width: 75, textAlign: 'right', padding: '4px 6px' }}
                                      disabled={!row.selected}
                                    />
                                  </td>
                                  <td className="num mono" style={{ fontWeight: 900, color: row.selected ? '#047857' : 'inherit' }}>
                                    {money(rowAmount)}
                                  </td>
                                  <td style={{ textAlign: 'center' }}>
                                    <button
                                      type="button"
                                      onClick={() => removeRow(idx)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 14, opacity: 0.7 }}
                                      title="Eliminar fila"
                                    >
                                      ✕
                                    </button>
                                  </td>
                                </motion.tr>
                              );
                            })}
                          </AnimatePresence>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── TARJETAS (móvil) ── */}
                  <div className="qim-concept-cards" style={{ flexDirection: 'column', gap: 10 }}>
                    <AnimatePresence>
                      {conceptRows.map((row, idx) => {
                        const rowAmount = round2((Number(row.quantity) || 0) * (Number(row.unitPrice) || currentSellPrice));
                        return (
                          <motion.div
                            key={row.id || idx}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            style={{
                              background: row.selected ? 'rgba(37,99,235,0.07)' : 'var(--paper-sunk)',
                              border: row.selected ? '2px solid #3b82f6' : '1px solid var(--line-soft)',
                              borderRadius: 12, padding: 14,
                              opacity: row.selected ? 1 : 0.65,
                              transition: 'all 0.2s ease',
                            }}
                          >
                            {/* Fila 1: checkbox + descripción + eliminar */}
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                              <input
                                type="checkbox"
                                checked={row.selected}
                                onChange={() => toggleRowSelect(idx)}
                                style={{ width: 22, height: 22, cursor: 'pointer', accentColor: '#2563eb', flexShrink: 0, marginTop: 2 }}
                              />
                              <input
                                type="text"
                                className="input boxed"
                                value={row.description}
                                onChange={e => updateRowField(idx, 'description', e.target.value)}
                                style={{ flex: 1, fontWeight: row.selected ? 700 : 400, fontSize: 13, padding: '6px 10px' }}
                                disabled={!row.selected}
                              />
                              <button
                                type="button"
                                onClick={() => removeRow(idx)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--bad)', fontSize: 18, flexShrink: 0, opacity: 0.7, padding: 0 }}
                              >
                                ✕
                              </button>
                            </div>

                            {/* Fila 2: clave SAT */}
                            <div style={{ marginBottom: 10 }}>
                              <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>Clave SAT</label>
                              <input
                                type="text"
                                className="input boxed mono"
                                value={row.code}
                                onChange={e => updateRowField(idx, 'code', e.target.value)}
                                style={{ fontSize: 12, padding: '6px 10px', color: '#1e40af', fontWeight: 700 }}
                                disabled={!row.selected}
                              />
                            </div>

                            {/* Fila 3: Kilos + Precio unitario */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                              <div>
                                <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>
                                  Kilos a Facturar
                                  {row.maxAvailable > 0 && <span style={{ color: '#2563eb', marginLeft: 4 }}>(máx {row.maxAvailable.toLocaleString('es-MX')})</span>}
                                </label>
                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="input boxed mono"
                                    value={row.quantity || ''}
                                    onChange={e => updateRowField(idx, 'quantity', Number(e.target.value))}
                                    style={{ flex: 1, textAlign: 'right', fontWeight: 800, fontSize: 15, padding: '8px 10px' }}
                                    disabled={!row.selected}
                                  />
                                  {row.maxAvailable > 0 && row.quantity !== row.maxAvailable && (
                                    <button
                                      type="button"
                                      onClick={() => fillRowMax(idx)}
                                      style={{ padding: '8px 10px', background: 'rgba(37,99,235,0.15)', color: '#1d4ed8', border: '1px solid #3b82f6', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}
                                    >
                                      Máx
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div>
                                <label style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-soft)', display: 'block', marginBottom: 4 }}>P. Unitario ($/kg)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  className="input boxed mono"
                                  value={row.unitPrice || ''}
                                  onChange={e => updateRowField(idx, 'unitPrice', Number(e.target.value))}
                                  style={{ width: '100%', textAlign: 'right', padding: '8px 10px', fontSize: 14 }}
                                  disabled={!row.selected}
                                />
                              </div>
                            </div>

                            {/* Fila 4: Importe total */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>Importe:</span>
                              <span className="mono" style={{ fontWeight: 900, fontSize: 16, color: row.selected ? '#047857' : 'var(--ink-soft)' }}>
                                {money(rowAmount)}
                              </span>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </>
              ) : (
                <div style={{ background: 'var(--paper-sunk)', padding: 16, borderRadius: 10, textAlign: 'center', color: 'var(--ink-soft)' }}>
                  No hay conceptos cargados. Usa "+ Agregar" para crear uno.
                </div>
              )}
            </div>

            {/* ─── DATOS FISCALES & RECIBO DIGITAL ────────────────────────────────────── */}
            <div style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.03) 0%, rgba(30,41,59,0.06) 100%)', border: '1px solid var(--line)', padding: 18, borderRadius: 14 }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 16 }}>
                {/* Folio */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                    3. Folio Fiscal de la Factura (SAT / CFDI)
                  </label>
                  <input 
                    type="text" 
                    value={folio} 
                    onChange={e => setFolio(e.target.value.toUpperCase())}
                    className="input boxed mono" 
                    placeholder="Ej. A-1234"
                    style={{ width: '100%', fontWeight: 900, fontSize: 15, padding: '10px 14px', letterSpacing: '0.05em' }}
                    autoFocus
                  />
                  {duplicateInvoice && (
                    <div style={{ marginTop: 6, fontSize: 11.5, color: '#dc2626', fontWeight: 800, background: 'rgba(239,68,68,0.1)', padding: '6px 10px', borderRadius: 6 }}>
                      🚨 Factura #{folio.trim()} ya registrada en la OC #{duplicateInvoice.orderFolio} ({duplicateInvoice.client}).
                    </div>
                  )}
                </div>
                
                {/* Resumen Kilos */}
                <div>
                  <label style={{ display: 'block', fontWeight: 800, fontSize: 13, color: 'var(--ink)', marginBottom: 6 }}>
                    Total Kilos a Amparar
                  </label>
                  <div style={{ padding: '9px 14px', background: 'var(--paper-raised)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="mono" style={{ fontWeight: 900, fontSize: 17, color: 'var(--ink)' }}>
                      {kilosToInvoice.toLocaleString('es-MX')} kg
                    </span>
                    <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
                      de {availableKilos.toLocaleString('es-MX')} kg
                    </span>
                  </div>
                </div>
              </div>

              {/* Tarjeta de Totales Fiscales */}
              <div style={{ background: 'var(--paper-raised)', padding: 16, borderRadius: 12, border: '1px solid var(--line)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Subtotal (sin IVA):</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: 'var(--ink)', marginTop: 2 }}>{money(subtotalEstimado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>IVA ({Math.round(ivaRate * 100)}%):</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 16, color: '#2563eb', marginTop: 2 }}>+{money(ivaEstimado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11.5, color: '#047857', fontWeight: 800 }}>Total con IVA a Cobrar:</div>
                  <div className="mono" style={{ fontWeight: 900, fontSize: 19, color: '#047857', marginTop: 2 }}>{money(totalEstimadoConIva)}</div>
                </div>
                <div style={{ borderLeft: '1px solid var(--line-soft)', paddingLeft: 12 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 600 }}>Margen Bruto Est.:</div>
                  <div className="mono" style={{ fontWeight: 800, fontSize: 15, color: gananciaEstimada >= 0 ? '#059669' : '#dc2626', marginTop: 2 }}>
                    {money(gananciaEstimada)}
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <button className="btn" onClick={onClose} disabled={saving} style={{ minHeight: 44, padding: '0 18px' }}>Cancelar</button>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="btn btn-primary" 
            onClick={handleInvoice} 
            disabled={!selectedOrder || saving || !folio.trim() || !!duplicateInvoice || kilosToInvoice <= 0 || selectedRows.length === 0}
            style={{ 
              fontWeight: 900, 
              padding: '12px 24px', 
              fontSize: 14,
              minHeight: 46,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 6px 20px rgba(37,99,235,0.35)',
              border: 'none',
            }}
          >
            {saving ? 'Facturando…' : `🧾 Emitir Factura (#${folio || '…'}) · ${money(totalEstimadoConIva)}`}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}
