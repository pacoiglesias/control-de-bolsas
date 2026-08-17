import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, kilos as fmtKilos, nombreClienteVisible } from '../../lib/format';
import { computeCommissionFromInvoiceTotal } from '../../lib/finance';
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
  amount?: number;
  kilos?: number;
  buttonLabel: string;
  buttonColor: string;
  buttonIcon: string;
  onAction: () => void;
};

export function ActionRadar({ orders, purchases, config, nav, onOpenOrder }: ActionRadarProps) {
  const actions = useMemo<UrgentAction[]>(() => {
    const list: UrgentAction[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const saleKg = config?.salePricePerKg || 43;
    const costKg = config?.costPricePerKg || 42;
    const ivaRate = config?.ivaRate || 0.16;

    orders.forEach((o) => {
      if (o.isClosedShort) return;
      const clientName = nombreClienteVisible(o.client) || 'Providencia';
      const deliveries = o.deliveries || [];
      const kilosEntregados = deliveries.reduce((a: number, d: any) => a + (d.kilos || 0), 0);
      const invoices = o.invoices || [];
      const kilosFacturados = invoices.reduce((a: number, i: any) => a + (i.kilos || 0), 0);

      // 1. Entregas en Providencia sin Facturar
      if (kilosEntregados > kilosFacturados + 0.01) {
        const faltanKg = kilosEntregados - kilosFacturados;
        const montoEstimado = faltanKg * saleKg * (1 + ivaRate);
        list.push({
          id: `sin_fac_${o.id}`,
          type: 'sin_facturar',
          priority: 'alta',
          title: `Entregados ${fmtKilos(faltanKg)} kg sin facturar`,
          subtitle: `OC ${o.oc || o.folio || 'S/N'} (${clientName}) — Valor estimado: ${money(montoEstimado)}`,
          kilos: faltanKg,
          amount: montoEstimado,
          buttonLabel: '⚡ Facturar Ahora',
          buttonColor: '#f59e0b',
          buttonIcon: '📝',
          onAction: () => {
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

        // Parseo seguro de fecha de vencimiento
        const rawDue = inv.creditCycle?.dueDate as any;
        let dueTime: number | null = null;
        if (rawDue) {
          if (typeof rawDue.toMillis === 'function') dueTime = rawDue.toMillis();
          else if (typeof rawDue.toDate === 'function') dueTime = rawDue.toDate().getTime();
          else if (rawDue instanceof Date) dueTime = rawDue.getTime();
          else {
            const d = new Date(rawDue);
            if (!isNaN(d.getTime())) dueTime = d.getTime();
          }
        }

        // A) Factura emitida SIN número de contrarecibo
        if (!cr && (inv.folio || st === 'pending' || st === 'facturado' || st === 'overdue')) {
          list.push({
            id: `no_cr_${o.id}_${inv.id}`,
            type: 'cr_vencido',
            priority: 'alta',
            title: `Factura #${inv.folio || o.folio || 'S/F'} sin Contrarecibo (${money(amt)})`,
            subtitle: `OC ${o.oc || o.folio || 'S/N'} — Asignar número de CR de ${clientName}`,
            amount: amt,
            buttonLabel: '📝 Asignar CR',
            buttonColor: '#d97706',
            buttonIcon: '📝',
            onAction: () => {
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
            amount: amt,
            buttonLabel: '💸 Cobro Rápido',
            buttonColor: '#ef4444',
            buttonIcon: '💸',
            onAction: () => {
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
            amount: neto,
            buttonLabel: '💵 Recibir en Caja',
            buttonColor: '#10b981',
            buttonIcon: '💰',
            onAction: () => nav('/dashboard'),
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
          kilos: faltan,
          buttonLabel: '🚚 Ver Maquila',
          buttonColor: '#8b5cf6',
          buttonIcon: '🚚',
          onAction: () => {
            nav('/compras');
          },
        });
      }
    });

    // Ordenar por prioridad: alta ➔ media ➔ baja
    const priorityOrder = { alta: 1, media: 2, baja: 3 };
    return list.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }, [orders, purchases, config, nav, onOpenOrder]);

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
            background: actions.length > 0 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
            color: actions.length > 0 ? '#ef4444' : '#10b981',
            border: `1px solid ${actions.length > 0 ? '#ef4444' : '#10b981'}`,
          }}
        >
          {actions.length > 0 ? `${actions.length} acciones pendientes` : '🎉 Todo al día'}
        </span>
      </div>

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
            <div style={{ fontWeight: 800, fontSize: 14 }}>¡Operación 100% al día!</div>
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
                borderLeft: `4px solid ${act.buttonColor}`,
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
                  <span>{act.buttonIcon}</span> {act.title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                  {act.subtitle}
                </div>
              </div>

              <button
                type="button"
                onClick={act.onAction}
                style={{
                  background: act.buttonColor,
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
                <span>{act.buttonIcon}</span> {act.buttonLabel}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
