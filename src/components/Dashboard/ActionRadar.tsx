import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { money, kilos as fmtKilos, nombreClienteVisible, toDate } from '../../lib/format';
import { computeCommissionFromInvoiceTotal, getOrderSummary, round2 } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import { triggerHaptic } from '../../lib/hapticEngine';
import {
  openWhatsAppMessage,
  generateEstadoCuentaSemanalAndresMessage,
  generateReclamarKilosAndresMessage,
} from '../../lib/whatsappReminder';
import { OcClosureModal } from '../Orders/OcClosureModal';
import { OcFulfillmentReportModal } from '../Orders/OcFulfillmentReportModal';
import type { PurchaseOrder, Purchase, FinancialConfig } from '../../lib/types';

interface ActionRadarProps {
  orders: PurchaseOrder[];
  purchases: Purchase[];
  config: FinancialConfig;
  nav: (path: string) => void;
  onOpenOrder?: (order: PurchaseOrder) => void;
}

export type UrgentAction = {
  id: string;
  type: 'sin_facturar' | 'cr_vencido' | 'contador_listo' | 'andres_atraso';
  priority: 'alta' | 'media' | 'baja';
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  amount?: number;
  kilos?: number;
  actionLabel: string;
  onClick: () => void;
};

export function ActionRadar({ orders, purchases, config, nav, onOpenOrder }: ActionRadarProps) {
  const toast = useToast();
  const actions = useMemo<UrgentAction[]>(() => {
    const saleKg = config?.salePricePerKg || 43;
    const costKg = config?.costPricePerKg || 38;
    const ivaRate = config?.ivaRate || 0.16;
    const list: UrgentAction[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    orders.forEach((o) => {
      if (o.isClosedShort) return;
      const clientName = nombreClienteVisible(o.client) || 'Providencia';
      const summary = getOrderSummary(o);
      const kilosEntregados = summary.kilosDelivered;
      const kilosFacturados = summary.kilosInvoiced;
      const invoices = o.invoices || [];

      // 1. Entregas en Providencia sin Facturar
      if (kilosEntregados > kilosFacturados + 0.01) {
        const faltanKg = round2(kilosEntregados - kilosFacturados);
        const montoEstimado = round2(faltanKg * saleKg * (1 + ivaRate));
        list.push({
          id: `sin_fac_${o.id}`,
          type: 'sin_facturar',
          priority: 'alta',
          title: `Entregados ${fmtKilos(faltanKg)} kg sin facturar`,
          subtitle: `OC ${o.oc || o.folio || 'S/N'} (${clientName}) — Valor estimado: ${money(montoEstimado)}`,
          badge: 'Facturar',
          badgeColor: '#f59e0b',
          kilos: faltanKg,
          amount: montoEstimado,
          actionLabel: 'Facturar Ahora',
          onClick: () => {
            if (onOpenOrder) onOpenOrder(o);
            else nav(`/ordenes?abrir=${o.id}`);
          },
        });
      }

      // 2. Facturas de la Orden
      invoices.forEach((inv) => {
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;
        const amt = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));

        // Parseo seguro de fecha de vencimiento con toDate
        const due = toDate(inv.creditCycle?.dueDate);
        const dueTime: number | null = due ? due.getTime() : null;

        // A) Factura emitida SIN número de contrarecibo
        if (!cr && (inv.folio || st === 'pending' || st === 'facturado' || st === 'overdue')) {
          list.push({
            id: `no_cr_${o.id}_${inv.id}`,
            type: 'cr_vencido',
            priority: 'alta',
            title: `Factura #${inv.folio || o.folio || 'S/F'} sin Contrarecibo (${money(amt)})`,
            subtitle: `OC ${o.oc || o.folio || 'S/N'} — Asignar número de CR de ${clientName}`,
            badge: 'Sin CR',
            badgeColor: '#d97706',
            amount: amt,
            actionLabel: '📝 Asignar CR',
            onClick: () => {
              if (onOpenOrder) onOpenOrder(o);
              else nav(`/ordenes?abrir=${o.id}`);
            },
          });
        }

        // B) Contrarecibos Vencidos o Próximos a Vencer
        if (cr && (st === 'overdue' || (dueTime && dueTime < today.getTime() && st !== 'paid' && st !== 'collected'))) {
          const diffDays = Math.max(1, Math.round((today.getTime() - (dueTime || today.getTime())) / (1000 * 60 * 60 * 24)));
          list.push({
            id: `overdue_${o.id}_${inv.id}`,
            type: 'cr_vencido',
            priority: 'alta',
            title: `CR ${cr} vencido hace ${diffDays} día(s) (${money(amt)})`,
            subtitle: `Factura #${inv.folio || o.folio || 'S/F'} — ${clientName}`,
            badge: 'Vencido',
            badgeColor: '#ef4444',
            amount: amt,
            actionLabel: '💸 Cobro Rápido',
            onClick: () => {
              nav('/cobranza');
            },
          });
        }

        // C) Dinero Cobrado con el Contador Listo para Recibir en Caja Chica
        if (st === 'paid') {
          const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(amt, config as any);
          const neto = amt - comision;
          list.push({
            id: `paid_${o.id}_${inv.id}`,
            type: 'contador_listo',
            priority: 'media',
            title: `Dinero cobrado listo con el contador (${money(neto)})`,
            subtitle: `Factura #${inv.folio || o.folio || 'S/F'} (Total: ${money(amt)} − Comisión: ${money(comision)})`,
            badge: 'Con Contador',
            badgeColor: '#10b981',
            amount: neto,
            actionLabel: '💵 Recibir en Caja',
            onClick: () => nav('/dashboard'),
          });
        }
      });
    });

    // 3. Detectar Pedidos de Andrés con Kilos Pendientes de Fabricación
    purchases.forEach((p) => {
      const faltan = (p.expectedKilos || 0) - (p.receivedKilos || 0);
      if (faltan > 20) {
        const orderLinked = orders.find((o) => o.id === p.id);
        const ocName = orderLinked?.oc || orderLinked?.folio || p.id;
        list.push({
          id: `andres_${p.id}`,
          type: 'andres_atraso',
          priority: 'baja',
          title: `Andrés: ${fmtKilos(faltan)} kg pendientes de fabricar`,
          subtitle: `Para pedido ${ocName} (${money(faltan * costKg)} en material)`,
          badge: 'Fabricación',
          badgeColor: '#8b5cf6',
          kilos: faltan,
          actionLabel: '🚚 Ver Maquila',
          onClick: () => {
            nav('/compras');
          },
        });
      }
    });

    // Ordenar por prioridad: alta ➔ media ➔ baja
    const priorityOrder = { alta: 1, media: 2, baja: 3 };
    return list.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [orders, purchases, config, nav, onOpenOrder]);

  const andresSummary = useMemo(() => {
    const costKg = config?.costPricePerKg || 38;
    const activeOcsWithFaltantes: Array<{
      order: PurchaseOrder;
      oc: string;
      cliente: string;
      pedidosKg: number;
      entregadosKg: number;
      faltantesKg: number;
      viajesCount: number;
    }> = [];

    let totalKilosPedidos = 0;
    let totalKilosEntregados = 0;
    let totalKilosFaltantes = 0;
    let totalViajes = 0;

    (orders || []).forEach((o) => {
      if (o.isClosedShort) return;
      const s = getOrderSummary(o);
      const itemsSum = (o.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
      const pedidosKg = itemsSum > 0 ? itemsSum : (Number(o.totalKilograms) || s.kilosDelivered || 0);
      const entregadosKg = s.kilosDelivered;
      const faltantesKg = Math.max(0, pedidosKg - entregadosKg);
      const viajesCount = (o.deliveries || []).length;

      if (pedidosKg > 0) {
        totalKilosPedidos += pedidosKg;
        totalKilosEntregados += entregadosKg;
        totalViajes += viajesCount;
        if (faltantesKg > 0.01) {
          totalKilosFaltantes += faltantesKg;
          activeOcsWithFaltantes.push({
            order: o,
            oc: o.folio || o.oc || o.id,
            cliente: nombreClienteVisible(o.client) || 'Providencia',
            pedidosKg,
            entregadosKg,
            faltantesKg,
            viajesCount,
          });
        }
      }
    });

    return {
      costKg,
      totalKilosPedidos: round2(totalKilosPedidos),
      totalKilosEntregados: round2(totalKilosEntregados),
      totalKilosFaltantes: round2(totalKilosFaltantes),
      totalViajes,
      activeOcsWithFaltantes,
      pctGlobal: totalKilosPedidos > 0 ? Math.round((totalKilosEntregados / totalKilosPedidos) * 100) : 0,
      valorFaltantePesos: round2(totalKilosFaltantes * costKg),
    };
  }, [orders, config]);

  const handleSendWeeklyAndresReport = () => {
    triggerHaptic('light');
    const text = generateEstadoCuentaSemanalAndresMessage({
      providerName: (config as any)?.providerName || 'Andrés',
      totalKilosPedidos: andresSummary.totalKilosPedidos,
      totalKilosEntregados: andresSummary.totalKilosEntregados,
      totalKilosFaltantes: andresSummary.totalKilosFaltantes,
      totalViajes: andresSummary.totalViajes,
      costoKg: andresSummary.costKg,
      desgloseOcs: andresSummary.activeOcsWithFaltantes.map(it => ({
        oc: it.oc,
        cliente: it.cliente,
        pedidosKg: it.pedidosKg,
        entregadosKg: it.entregadosKg,
        faltantesKg: it.faltantesKg,
        viajesCount: it.viajesCount,
      })),
    });
    openWhatsAppMessage(text);
    toast(`📲 Abriendo WhatsApp con reporte semanal para Andrés (${andresSummary.totalKilosFaltantes.toLocaleString('es-MX')} kg pendientes)`, 'ok');
  };

  const [closingOrder, setClosingOrder] = useState<PurchaseOrder | null>(null);
  const [showFulfillmentReport, setShowFulfillmentReport] = useState(false);

  const handleConcluirOc = (order: PurchaseOrder) => {
    triggerHaptic('light');
    setClosingOrder(order);
  };

  return (
    <div
      role="region"
      aria-label="Radar Proactivo de Decisiones del Día"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        padding: '18px 20px',
        marginBottom: 24,
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>⚡</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: 'var(--ink)' }}>
              Radar de Decisiones y Acciones Inmediatas
            </h2>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500 }}>
              Lo que requiere tu atención y decisión hoy (Piloto Proactivo)
            </div>
          </div>
        </div>

        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 999,
            background: (actions.length > 0 || andresSummary.totalKilosFaltantes > 0) ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
            color: (actions.length > 0 || andresSummary.totalKilosFaltantes > 0) ? '#ef4444' : '#10b981',
            border: `1px solid ${(actions.length > 0 || andresSummary.totalKilosFaltantes > 0) ? '#ef4444' : '#10b981'}`,
          }}
        >
          {actions.length > 0
            ? `${actions.length} acciones prioritarias`
            : andresSummary.totalKilosFaltantes > 0
              ? 'Maquila pendiente'
              : '🎉 Todo al día'}
        </span>
      </div>

      {/* CARD DE CONCILIACIÓN SEMANAL DE MAQUILA ANDRÉS */}
      {andresSummary.totalKilosFaltantes > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(124, 58, 237, 0.12) 100%)',
            border: '1.5px solid rgba(139, 92, 246, 0.35)',
            borderRadius: 14,
            padding: '16px 18px',
            marginBottom: 18,
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24 }}>🏭</span>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 900, margin: 0, color: 'var(--ink)' }}>
                    Maquila Andrés · Conciliación de Kilos Pendientes
                  </h3>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    🚨 {fmtKilos(andresSummary.totalKilosFaltantes)} kg por enviar
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
                  Valor de maquila pendiente: <strong>{money(andresSummary.valorFaltantePesos)}</strong> (${andresSummary.costKg.toFixed(2)}/kg) · {andresSummary.activeOcsWithFaltantes.length} OC(s) activas
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleSendWeeklyAndresReport}
                style={{
                  background: '#25D366',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                }}
                title="Enviar consolidado semanal con todas las OCs a Andrés por WhatsApp"
              >
                <span>📲</span>
                <span>Enviar Reporte Semanal a Andrés</span>
              </button>
              <button
                type="button"
                onClick={() => setShowFulfillmentReport(true)}
                style={{
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
                title="Ver balance y reporte de cumplimiento y mermas de todas las OCs"
              >
                <span>📊</span>
                <span>Reporte de Faltantes</span>
              </button>
              <button
                type="button"
                onClick={() => nav('/oc')}
                style={{
                  background: 'rgba(139, 92, 246, 0.15)',
                  color: '#8b5cf6',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🚚 Ver Báscula por OC →
              </button>
            </div>
          </div>

          {/* Desglose de OCs con Kilos Faltantes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8, marginTop: 10 }}>
            {andresSummary.activeOcsWithFaltantes.map((item) => (
              <div
                key={item.oc}
                style={{
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontWeight: 800, fontSize: 12.5, color: 'var(--ink)' }}>
                    OC {item.oc} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-soft)' }}>· {item.cliente}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>
                    Entregado: {fmtKilos(item.entregadosKg)} / {fmtKilos(item.pedidosKg)} kg ({item.viajesCount} viajes)
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#d97706', marginTop: 1 }}>
                    ⏳ Faltan: {fmtKilos(item.faltantesKg)} kg ({money(item.faltantesKg * andresSummary.costKg)})
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const text = generateReclamarKilosAndresMessage({
                        oc: item.oc,
                        client: item.cliente,
                        totalKg: item.pedidosKg,
                        entregadosKg: item.entregadosKg,
                        faltantesKg: item.faltantesKg,
                        providerName: (config as any)?.providerName || 'Andrés',
                        deliveriesCount: item.viajesCount,
                      });
                      openWhatsAppMessage(text);
                    }}
                    style={{
                      border: 'none',
                      background: '#25D366',
                      color: '#fff',
                      padding: '4px 8px',
                      borderRadius: 6,
                      fontSize: 10.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title="Reclamar faltante de esta OC específica a Andrés"
                  >
                    💬 Reclamar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConcluirOc(item.order)}
                    style={{
                      border: '1px solid rgba(217, 119, 6, 0.4)',
                      background: 'rgba(217, 119, 6, 0.1)',
                      color: '#b45309',
                      padding: '3px 7px',
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    title="Cerrar esta OC si Andrés no enviará más kilos y auditar faltantes"
                  >
                    🏁 Concluir OC
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 ? (
        <div
          style={{
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 12,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            color: '#10b981',
          }}
        >
          <span style={{ fontSize: 24 }}>✨</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14 }}>¡Facturación y Cobranza al día!</div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              No tienes entregas pendientes de facturar, contrarecibos vencidos ni dinero pendiente de recolectar.
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.slice(0, 5).map((act) => (
            <motion.div
              key={act.id}
              whileHover={{ scale: 1.01, x: 2 }}
              style={{
                background: 'var(--paper-sunk)',
                border: '1px solid var(--line)',
                borderLeft: `4px solid ${act.badgeColor}`,
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{act.badge}</span> {act.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {act.subtitle}
                </div>
              </div>

              <button
                type="button"
                onClick={act.onClick}
                style={{
                  background: act.badgeColor,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                {act.actionLabel}
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {closingOrder && (
        <OcClosureModal
          order={closingOrder}
          onClose={() => setClosingOrder(null)}
        />
      )}

      {showFulfillmentReport && (
        <OcFulfillmentReportModal
          orders={orders}
          onClose={() => setShowFulfillmentReport(false)}
          onOpenOrder={onOpenOrder}
        />
      )}
    </div>
  );
}
