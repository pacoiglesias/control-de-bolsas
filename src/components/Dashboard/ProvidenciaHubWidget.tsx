import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../../hooks/useOrders';
import { money } from '../../lib/format';
import { getOrderSummary, inferDepartment, extractCr } from '../../lib/finance';
import { useNavigate } from 'react-router-dom';
import type { PurchaseOrder } from '../../lib/types';
import { RegistrarEntregaModal } from '../Compras/OrderModals';
import { QuickCrModal } from '../QuickCrModal';
import OrderModal from '../OrderModal';
import { useConfig } from '../../hooks/useConfig';

export function ProvidenciaHubWidget() {
  const { orders } = useOrders();
  const { config } = useConfig();
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<'ALL' | 'TH' | 'GT'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'PENDING_ACTION' | 'ACTIVE' | 'ALL'>('PENDING_ACTION');
  
  // Modales interactivos
  const [entregaOrder, setEntregaOrder] = useState<PurchaseOrder | null>(null);
  const [crOrder, setCrOrder] = useState<{ order: PurchaseOrder; inv?: any } | null>(null);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);

  // 1. Filtrar todas las órdenes de compra reales pertenecientes a Providencia
  const providenciaOrders = useMemo(() => {
    return orders.filter(o => {
      if (!o || (o as any).isDeleted) return false;
      const oc = (o.oc || o.folio || '').toUpperCase().trim();
      const folio = (o.folio || '').toUpperCase().trim();

      // Excluir expedientes obsoletos de prueba
      if (oc === '120267114014' || folio === '120267114014' || folio === '6167') {
        return false;
      }

      // Excluir expedientes cuyo folio principal es un Contrarecibo (viven en Cobranza)
      if (folio.startsWith('TH-') || folio.startsWith('GT-') || oc.startsWith('TH-') || oc.startsWith('GT-')) {
        return false;
      }

      const c = (o.client || '').toUpperCase();
      const d = (o.department || '').toUpperCase();
      return (
        oc.startsWith('12026') ||
        c.includes('PROVIDENCIA') ||
        c.includes('TEXTIL HOGAR') ||
        c.includes('GRUPO TEXTIL') ||
        c.includes('NAVA') ||
        c.includes('EVELIA') ||
        d.includes('TH') ||
        d.includes('P4') ||
        d.includes('GT')
      );
    });
  }, [orders]);

  // 2. Procesar datos enriquecidos para cada orden (Deduplicadas por OC)
  const processedOrders = useMemo(() => {
    // Agrupar órdenes por su clave canónica de OC
    const ocMap = new Map<string, PurchaseOrder[]>();

    for (const order of providenciaOrders) {
      if (!order || (order as any).isDeleted) continue;
      const rawOc = (order.oc || order.folio || order.id).trim();
      const ocKey = rawOc.toUpperCase();
      
      const existing = ocMap.get(ocKey) || [];
      existing.push(order);
      ocMap.set(ocKey, existing);
    }

    const list = [];

    for (const [, groupOrders] of ocMap.entries()) {
      const primaryOrder = groupOrders.reduce((best, curr) => {
        const bestScore = (best.items?.length || 0) * 10 + (best.invoices?.length || 0) * 5 + (best.deliveries?.length || 0);
        const currScore = (curr.items?.length || 0) * 10 + (curr.invoices?.length || 0) * 5 + (curr.deliveries?.length || 0);
        return currScore > bestScore ? curr : best;
      }, groupOrders[0]);

      // Fusionar facturas y entregas sin duplicados
      const allInvoicesRaw: any[] = [];
      const invoiceFolioSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const inv of ord.invoices || []) {
          const key = (inv.folio || inv.id || '').toUpperCase().trim();
          if (key && !invoiceFolioSet.has(key)) {
            invoiceFolioSet.add(key);
            allInvoicesRaw.push(inv);
          }
        }
      }

      const allDeliveriesRaw: any[] = [];
      const deliveryIdSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const del of ord.deliveries || []) {
          const key = (del.id || `${del.kilos}-${del.date}`).trim();
          if (key && !deliveryIdSet.has(key)) {
            deliveryIdSet.add(key);
            allDeliveriesRaw.push(del);
          }
        }
      }

      const o: PurchaseOrder = {
        ...primaryOrder,
        invoices: allInvoicesRaw.length > 0 ? allInvoicesRaw : primaryOrder.invoices,
        deliveries: allDeliveriesRaw.length > 0 ? allDeliveriesRaw : primaryOrder.deliveries,
      };

      const dept = inferDepartment(o) || (o.department?.toUpperCase().includes('TH') ? 'TH' : o.department?.toUpperCase().includes('GT') ? 'GT' : 'TH');
      const summary = getOrderSummary(o);
      const itemsSum = o.items?.reduce((s, i) => s + (Number(i.quantity) || 0), 0) || 0;
      const totalKg = itemsSum > 0 ? itemsSum : (Number(o.totalKilograms) || summary.kilosDelivered || 0);
      const deliveredKg = summary.kilosDelivered || 0;
      const invoicedKg = summary.kilosInvoiced || 0;
      const remainingKg = Math.max(0, totalKg - deliveredKg);
      const unInvoicedKg = Math.max(0, deliveredKg - invoicedKg);
      const progress = totalKg > 0 ? Math.min(100, Math.round((deliveredKg / totalKg) * 100)) : 0;
      const invoices = o.invoices || [];
      const hasPendingCr = invoices.some(inv => !inv.collection?.contrareciboNumber && !o.collection?.contrareciboNumber);
      
      const pendingBalance = invoices.reduce((sum, inv) => {
        if (inv.creditCycle?.status === 'pending' || inv.creditCycle?.status === 'overdue' || inv.creditCycle?.status === 'facturado') {
          return sum + (inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
        }
        return sum;
      }, 0);

      const isCompleted = remainingKg <= 0 && unInvoicedKg <= 0 && pendingBalance <= 0;
      const hasPendingDeliveryOrInvoicing = remainingKg > 0 || unInvoicedKg > 0;

      list.push({
        o,
        dept,
        totalKg,
        deliveredKg,
        invoicedKg,
        remainingKg,
        unInvoicedKg,
        progress,
        invoices,
        hasPendingCr,
        pendingBalance,
        isCompleted,
        hasPendingDeliveryOrInvoicing,
      });
    }

    return list;
  }, [providenciaOrders]);

  // 3. Segmentar por Planta y por Estado Operativo
  const filteredByStatus = useMemo(() => {
    if (statusFilter === 'PENDING_ACTION') {
      const pending = processedOrders.filter(x => x.hasPendingDeliveryOrInvoicing || x.hasPendingCr);
      return pending.length > 0 ? pending : processedOrders.filter(x => !x.isCompleted);
    }
    if (statusFilter === 'ACTIVE') {
      return processedOrders.filter(x => !x.isCompleted);
    }
    return processedOrders;
  }, [processedOrders, statusFilter]);

  const thOrders = useMemo(() => filteredByStatus.filter(x => x.dept === 'TH'), [filteredByStatus]);
  const gtOrders = useMemo(() => filteredByStatus.filter(x => x.dept === 'GT'), [filteredByStatus]);

  // 4. Métricas Globales Consolidadas
  const targetOrders = activeTab === 'ALL' ? filteredByStatus : activeTab === 'TH' ? thOrders : gtOrders;

  const totals = useMemo(() => {
    return targetOrders.reduce(
      (acc, x) => {
        acc.totalKg += x.totalKg;
        acc.deliveredKg += x.deliveredKg;
        acc.remainingKg += x.remainingKg;
        acc.unInvoicedKg += x.unInvoicedKg;
        acc.pendingBalance += x.pendingBalance;
        return acc;
      },
      { totalKg: 0, deliveredKg: 0, remainingKg: 0, unInvoicedKg: 0, pendingBalance: 0 }
    );
  }, [targetOrders]);

  const globalProgress = totals.totalKg > 0 ? Math.min(100, Math.round((totals.deliveredKg / totals.totalKg) * 100)) : 0;
  const thGlobalProgress = thOrders.reduce((s, x) => s + x.totalKg, 0) > 0 
    ? Math.round((thOrders.reduce((s, x) => s + x.deliveredKg, 0) / thOrders.reduce((s, x) => s + x.totalKg, 0)) * 100) 
    : 0;
  const gtGlobalProgress = gtOrders.reduce((s, x) => s + x.totalKg, 0) > 0 
    ? Math.round((gtOrders.reduce((s, x) => s + x.deliveredKg, 0) / gtOrders.reduce((s, x) => s + x.totalKg, 0)) * 100) 
    : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(30, 41, 59, 0.96) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          borderRadius: 24,
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Header con Título, Subtítulo y Filtros de Pestaña */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              boxShadow: '0 8px 16px rgba(59, 130, 246, 0.35)',
            }}>
              🏭
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 8 }}>
                Operaciones Providencia en Tiempo Real
                <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  {targetOrders.length} {targetOrders.length === 1 ? 'ORDEN' : 'ÓRDENES'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
                Monitoreo en vivo de entregas pendientes, kilos en patio y contrarecibos
              </div>
            </div>
          </div>

          {/* Selector de Planta (Pestañas Superiores) */}
          <div style={{ display: 'flex', background: 'rgba(0, 0, 0, 0.35)', padding: 4, borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap', gap: 4 }}>
            <button
              onClick={() => setActiveTab('ALL')}
              style={{
                background: activeTab === 'ALL' ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' : 'transparent',
                color: activeTab === 'ALL' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              📊 Consolidado ({globalProgress}%)
            </button>
            <button
              onClick={() => setActiveTab('TH')}
              style={{
                background: activeTab === 'TH' ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' : 'transparent',
                color: activeTab === 'TH' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🏢 TH · Nava ({thGlobalProgress}%)
            </button>
            <button
              onClick={() => setActiveTab('GT')}
              style={{
                background: activeTab === 'GT' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'transparent',
                color: activeTab === 'GT' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              🏭 GT · Evelia ({gtGlobalProgress}%)
            </button>
          </div>
        </div>

        {/* Barra de Sub-Filtros Operativos (Enfocados en lo que falta entregar o complementar) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
            Filtrar:
          </span>
          <button
            onClick={() => setStatusFilter('PENDING_ACTION')}
            style={{
              background: statusFilter === 'PENDING_ACTION' ? '#2563eb' : 'rgba(255, 255, 255, 0.06)',
              color: statusFilter === 'PENDING_ACTION' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🔥 Por Entregar o Facturar ({processedOrders.filter(x => x.hasPendingDeliveryOrInvoicing || x.hasPendingCr).length})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            style={{
              background: statusFilter === 'ACTIVE' ? '#2563eb' : 'rgba(255, 255, 255, 0.06)',
              color: statusFilter === 'ACTIVE' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🚚 Todas las Abiertas ({processedOrders.filter(x => !x.isCompleted).length})
          </button>
          <button
            onClick={() => setStatusFilter('ALL')}
            style={{
              background: statusFilter === 'ALL' ? '#2563eb' : 'rgba(255, 255, 255, 0.06)',
              color: statusFilter === 'ALL' ? '#fff' : 'rgba(255, 255, 255, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              padding: '5px 12px',
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            🌟 Historial Completo ({processedOrders.length})
          </button>
        </div>

        {/* Barra de KPIs Resumen en Tiempo Real */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>📦 PEDIDO TOTAL</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginTop: 4 }}>
              {totals.totalKg.toLocaleString('es-MX')} kg
            </div>
          </div>
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#6ee7b7', fontWeight: 800 }}>🚚 ENTREGADO EN BÁSCULA</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', marginTop: 4 }}>
              {totals.deliveredKg.toLocaleString('es-MX')} kg
            </div>
          </div>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#fcd34d', fontWeight: 800 }}>⏳ FALTA POR SURTIR</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fbbf24', marginTop: 4 }}>
              {totals.remainingKg.toLocaleString('es-MX')} kg
            </div>
          </div>
          <div style={{ background: totals.unInvoicedKg > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)', border: `1px solid ${totals.unInvoicedKg > 0 ? '#3b82f6' : 'rgba(255,255,255,0.08)'}`, borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: totals.unInvoicedKg > 0 ? '#60a5fa' : '#94a3b8', fontWeight: 800 }}>
              📄 EN PATIO POR FACTURAR
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: totals.unInvoicedKg > 0 ? '#93c5fd' : '#fff', marginTop: 4 }}>
              {totals.unInvoicedKg.toLocaleString('es-MX')} kg
            </div>
          </div>
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#34d399', fontWeight: 800 }}>💵 FLUJO NETO EN CAJA ($8.44/kg)</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
              {money(totals.deliveredKg * 8.44)}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Total OC: {money(totals.totalKg * 8.44)}
            </div>
          </div>
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 14, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 800 }}>💰 SALDO POR COBRAR</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f87171', marginTop: 4 }}>
              {money(totals.pendingBalance)}
            </div>
          </div>
        </div>

        {/* Grid de Tarjetas de Órdenes Reales */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          <AnimatePresence>
            {targetOrders.map(({ o, dept, totalKg, deliveredKg, remainingKg, unInvoicedKg, progress, invoices, hasPendingCr, pendingBalance }) => {
              const isTH = dept === 'TH';
              const deptLabel = isTH ? '🏢 TEXTIL HOGAR · TH-ALMACEN-1' : '🏭 GRUPO TEXTIL · PLANTA P4';
              const contactLabel = isTH ? 'Solicitó: JOSÉ NAVA FLORES · Autorizó: TORRE LAMUÑO' : 'Solicitó / Contacto: EVELIA · Almacén: P4-ALM';
              const crPrefix = isTH ? 'TH-' : 'GT-';

              return (
                <motion.div
                  key={o.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isTH ? 'rgba(139, 92, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    borderRadius: 18,
                    padding: '18px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 900, color: isTH ? '#c084fc' : '#34d399', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {deptLabel}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginTop: 2 }}>
                        OC: {o.oc || o.folio || 'S/F'}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.65)', marginTop: 2 }}>
                        {contactLabel} · Prefijo: <strong>{crPrefix}</strong>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 900,
                      padding: '4px 10px',
                      borderRadius: 8,
                      background: isTH ? 'rgba(139, 92, 246, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                      color: isTH ? '#d8b4fe' : '#6ee7b7',
                      border: `1px solid ${isTH ? 'rgba(139, 92, 246, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                    }}>
                      {progress}% Surtido
                    </span>
                  </div>

                  {/* Barra de Progreso */}
                  <div style={{ width: '100%', height: 10, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6, overflow: 'hidden', marginBottom: 12 }}>
                    <div
                      style={{
                        width: `${progress}%`,
                        height: '100%',
                        background: isTH ? 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 100%)' : 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
                        borderRadius: 6,
                        transition: 'width 0.6s ease',
                      }}
                    />
                  </div>

                  {/* Métricas Clave de la Orden */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                    <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '8px 10px' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>PEDIDO OC</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', marginTop: 2 }}>{totalKg.toLocaleString('es-MX')} kg</div>
                    </div>
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <div style={{ fontSize: 10, color: '#6ee7b7', fontWeight: 700 }}>ENTREGADO</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#34d399', marginTop: 2 }}>{deliveredKg.toLocaleString('es-MX')} kg</div>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderRadius: 10, padding: '8px 10px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <div style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700 }}>FALTA SURTIR</div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', marginTop: 2 }}>{remainingKg.toLocaleString('es-MX')} kg</div>
                    </div>
                  </div>

                  {/* Flujo Neto Real en Caja ($8.44/kg) */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(5, 150, 105, 0.08) 100%)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#6ee7b7', textTransform: 'uppercase' }}>
                        💵 Flujo Neto Real en Caja ($8.44/kg)
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
                        {money(deliveredKg * 8.44)}
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>
                          ganado de {money(totalKg * 8.44)}
                        </span>
                      </div>
                    </div>
                    {remainingKg > 0 && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: '#fcd34d', fontWeight: 700 }}>Por Ganar</div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#fbbf24' }}>
                          +{money(remainingKg * 8.44)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Facturas y Contrarecibos Asociados */}
                  <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 12, background: 'rgba(255,255,255,0.03)', padding: '8px 10px', borderRadius: 8 }}>
                    {invoices && invoices.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontWeight: 800, color: '#fff', display: 'flex', justifyContent: 'space-between' }}>
                          <span>🧾 Facturas ({invoices.length}):</span>
                          {pendingBalance > 0 && <span style={{ color: '#fca5a5' }}>Por Cobrar: {money(pendingBalance)}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                          {invoices.map(inv => {
                            const cr = extractCr(inv, o);
                            return (
                              <span
                                key={inv.id}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  background: cr ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.2)',
                                  border: `1px solid ${cr ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.4)'}`,
                                  color: cr ? '#6ee7b7' : '#fca5a5',
                                  fontWeight: 700,
                                  fontSize: 10.5,
                                }}
                              >
                                F-#{inv.folio || 'S/N'}: {cr ? `CR ${cr}` : '⚠️ Sin CR'} ({(inv.kilos || 0).toLocaleString('es-MX')} kg)
                              </span>
                            );
                          })}
                        </div>
                        {unInvoicedKg > 0 && (
                          <div style={{ marginTop: 4, color: '#60a5fa', fontWeight: 700, fontSize: 11 }}>
                            ⚡ {unInvoicedKg.toLocaleString('es-MX')} kg entregados en patio esperando factura.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {deliveredKg > 0 ? (
                          <span style={{ color: '#60a5fa' }}>
                            ⚡ {deliveredKg.toLocaleString('es-MX')} kg entregados listos para timbrar factura fiscal.
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>
                            Sin facturas aún · Esperando pesadas de entrega en báscula.
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Acciones Rápidas */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {remainingKg > 0 && (
                      <button
                        onClick={() => setEntregaOrder(o)}
                        style={{
                          flex: 1,
                          background: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          color: '#6ee7b7',
                          padding: '7px 10px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        + Báscula
                      </button>
                    )}

                    {hasPendingCr && (
                      <button
                        onClick={() => setCrOrder({ order: o })}
                        style={{
                          flex: 1,
                          background: 'rgba(59, 130, 246, 0.2)',
                          border: '1px solid #3b82f6',
                          color: '#93c5fd',
                          padding: '7px 10px',
                          borderRadius: 8,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        📝 Asignar CR {crPrefix}
                      </button>
                    )}

                    <button
                      onClick={() => setViewOrder(o)}
                      style={{
                        flex: 1,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: '#fff',
                        padding: '7px 10px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      📂 Expediente
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {targetOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '36px 20px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 14, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
              ¡Todo al día en esta sección de Providencia!
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, maxWidth: 420, margin: '4px auto 14px' }}>
              {statusFilter === 'PENDING_ACTION' 
                ? 'No hay entregas pendientes de báscula ni trámites de contrarecibo en este momento.'
                : 'No se encontraron órdenes registradas para este filtro.'}
            </div>
            <button
              onClick={() => setStatusFilter('ALL')}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ver Historial de Órdenes
            </button>
          </div>
        )}

        {/* Footer con Resumen de Rentabilidad y Flujo Neto Providencia */}
        <div style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              💵 Flujo Neto Real Entregas ($8.44/kg): <strong style={{ color: '#34d399' }}>{money(totals.deliveredKg * 8.44)}</strong>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              ⏳ Flujo Proyectado Restante: <strong style={{ color: '#fbbf24' }}>{money(totals.remainingKg * 8.44)}</strong>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              (Factura $49.88 - Andrés $38.00 - Contador 8% $3.44 = $8.44/kg)
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => nav('/oc')}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🚚 Seguimiento por OC
            </button>
            <button
              onClick={() => nav('/fast-entry')}
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                border: 'none',
                color: '#fff',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              }}
            >
              <span>⚡</span> Recepción Rápida (Pegar XML / PDF)
            </button>
          </div>
        </div>
      </motion.div>

      {/* MODAL 1: REGISTRAR PESADA EN BÁSCULA */}
      {entregaOrder && (
        <RegistrarEntregaModal
          order={entregaOrder}
          costPricePerKg={config?.costPricePerKg || 38}
          onClose={() => setEntregaOrder(null)}
        />
      )}

      {/* MODAL 2: ASIGNAR CONTRARECIBO RÁPIDO */}
      {crOrder && (
        <QuickCrModal
          order={crOrder.order}
          invoice={crOrder.inv}
          onClose={() => setCrOrder(null)}
        />
      )}

      {/* MODAL 3: EXPEDIENTE COMPLETO */}
      {viewOrder && (
        <OrderModal
          order={viewOrder}
          onClose={() => setViewOrder(null)}
          config={config}
        />
      )}
    </>
  );
}
