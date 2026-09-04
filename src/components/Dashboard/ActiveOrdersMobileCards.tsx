import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';
import { money, nombreClienteVisible } from '../../lib/format';
import { getOrderSummary, getSuggestedNextAction, inferDepartment, round2 } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';

interface ActiveOrdersMobileCardsProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenOrder: (order: PurchaseOrder) => void;
  onQuickDelivery: (orderId: string) => void;
  onQuickInvoice: (orderId: string) => void;
  onQuickCR?: (orderId: string) => void;
}

export function ActiveOrdersMobileCards({
  orders,
  config,
  onOpenOrder,
  onQuickDelivery,
  onQuickInvoice,
}: ActiveOrdersMobileCardsProps) {
  // Solo mostrar órdenes activas (no cerradas ni 100% cobradas)
  const activeList = useMemo(() => {
    return orders
      .filter((o) => {
        if (!o || o.isClosedShort) return false;
        const s = getOrderSummary(o);
        return s.status !== 'collected';
      })
      .map((o) => {
        const s = getOrderSummary(o);
        const nextAction = getSuggestedNextAction(o, config);
        const dept = inferDepartment(o);
        const totalKg = Number(o.totalKilograms) || 0;
        const pctEntregado = totalKg > 0 ? Math.min(100, Math.round((s.kilosDelivered / totalKg) * 100)) : 0;
        const pctFacturado = s.kilosDelivered > 0 ? Math.min(100, Math.round((s.kilosInvoiced / s.kilosDelivered) * 100)) : 0;
        const pctCobrado = s.invoiceTotal > 0 ? Math.min(100, Math.round((s.paidAmount / s.invoiceTotal) * 100)) : 0;

        const faltanEntregas = totalKg - s.kilosDelivered > 0.01;
        const faltanFacturas = s.kilosDelivered - s.kilosInvoiced > 0.01;
        const pendingKgToBill = round2(Math.max(0, s.kilosDelivered - s.kilosInvoiced));

        return {
          order: o,
          summary: s,
          nextAction,
          dept,
          totalKg,
          pctEntregado,
          pctFacturado,
          pctCobrado,
          faltanEntregas,
          faltanFacturas,
          pendingKgToBill,
        };
      });
  }, [orders, config]);

  if (activeList.length === 0) {
    return null;
  }

  return (
    <div className="active-orders-mobile-section" style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
            ⚡ Control de OCs Activas ({activeList.length})
          </h3>
          <span style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
            Estado y acciones rápidas paso a paso
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {activeList.map(({ order, summary, nextAction, dept, totalKg, pctEntregado, pctFacturado, pctCobrado, faltanEntregas, faltanFacturas, pendingKgToBill }) => {
          const clientName = nombreClienteVisible(order.client) || 'Providencia';
          const deptBadgeColor = dept === 'TH' ? '#0284c7' : dept === 'GT' ? '#7c3aed' : '#64748b';

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'var(--paper-raised, #ffffff)',
                border: '1px solid var(--line, #e2e8f0)',
                borderRadius: 16,
                padding: '14px 16px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {/* Encabezado de la Tarjeta */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontWeight: 900,
                        fontSize: 16,
                        fontFamily: 'monospace',
                        color: 'var(--ink)',
                      }}
                    >
                      {order.oc || order.folio || 'S/F'}
                    </span>
                    {dept && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 900,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: `${deptBadgeColor}15`,
                          color: deptBadgeColor,
                          border: `1px solid ${deptBadgeColor}40`,
                        }}
                      >
                        {dept}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2, fontWeight: 600 }}>
                    {clientName} · <strong style={{ color: 'var(--ink)' }}>{totalKg.toLocaleString('es-MX')} kg</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic();
                    onOpenOrder(order);
                  }}
                  style={{
                    background: 'var(--paper-sunk)',
                    border: '1px solid var(--line)',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                  }}
                >
                  Ver Ficha ↗
                </button>
              </div>

              {/* Barras de progreso de 3 etapas */}
              <div
                style={{
                  background: 'var(--paper-sunk)',
                  borderRadius: 12,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* 1. Entrega */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>📦 Entregas Andrés:</span>
                    <span style={{ color: pctEntregado >= 100 ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                      {summary.kilosDelivered.toLocaleString('es-MX')} / {totalKg.toLocaleString('es-MX')} kg ({pctEntregado}%)
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctEntregado}%`, background: pctEntregado >= 100 ? '#10b981' : '#3b82f6', borderRadius: 3 }} />
                  </div>
                </div>

                {/* 2. Facturación */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>🧾 Facturado:</span>
                    <span style={{ color: pctFacturado >= 100 ? '#10b981' : '#f59e0b', fontFamily: 'monospace' }}>
                      {summary.kilosInvoiced.toLocaleString('es-MX')} kg ({pctFacturado}%)
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctFacturado}%`, background: pctFacturado >= 100 ? '#10b981' : '#f59e0b', borderRadius: 3 }} />
                  </div>
                </div>

                {/* 3. Cobranza */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, marginBottom: 3 }}>
                    <span style={{ color: 'var(--ink-soft)' }}>💵 Cobrado:</span>
                    <span style={{ color: pctCobrado >= 100 ? '#10b981' : 'var(--ink)', fontFamily: 'monospace' }}>
                      {money(summary.paidAmount)} / {money(summary.invoiceTotal)} ({pctCobrado}%)
                    </span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--line)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pctCobrado}%`, background: pctCobrado >= 100 ? '#10b981' : '#10b981', borderRadius: 3 }} />
                  </div>
                </div>
              </div>

              {/* Siguiente Acción Sugerida */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: nextAction.badgeTone === 'bad' ? '#b91c1c' : nextAction.badgeTone === 'warn' ? '#b45309' : '#1d4ed8',
                  background: nextAction.badgeTone === 'bad' ? '#fef2f2' : nextAction.badgeTone === 'warn' ? '#fef3c7' : '#eff6ff',
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: `1px solid ${nextAction.badgeTone === 'bad' ? '#fecaca' : nextAction.badgeTone === 'warn' ? '#fde68a' : '#bfdbfe'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>👉</span>
                <span style={{ flex: 1 }}>{nextAction.title}: {nextAction.description}</span>
              </div>

              {/* Botones de Acción Rápida (1 solo toque) */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {faltanEntregas && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onQuickDelivery(order.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <span>📦</span> +Entrega
                  </button>
                )}

                {faltanFacturas && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      onQuickInvoice(order.id);
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                    }}
                  >
                    <span>🧾</span> Facturar ({pendingKgToBill.toLocaleString('es-MX')} kg)
                  </button>
                )}

                {nextAction.whatsappText && (
                  <button
                    type="button"
                    onClick={() => {
                      triggerHaptic();
                      window.open(`https://wa.me/?text=${encodeURIComponent(nextAction.whatsappText || '')}`, '_blank');
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #25D366',
                      background: 'rgba(37,211,102,0.1)',
                      color: '#128C7E',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                    title="Enviar WhatsApp"
                  >
                    <span>💬</span> WA
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
