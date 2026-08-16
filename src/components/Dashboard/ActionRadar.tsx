import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, kilos as fmtKilos, nombreClienteVisible } from '../../lib/format';
import { computeCommissionFromInvoiceTotal } from '../../lib/finance';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
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

    // 1. Detectar Entregas en Providencia sin Facturar
    orders.forEach((o) => {
      if (o.isClosedShort || o.client === 'MIGRACION') return;
      const deliveries = o.deliveries || [];
      const kilosEntregados = deliveries.reduce((a: number, d: any) => a + (d.kilos || 0), 0);
      const invoices = o.invoices || [];
      const kilosFacturados = invoices.reduce((a: number, i: any) => a + (i.kilos || 0), 0);

      if (kilosEntregados > kilosFacturados + 0.01) {
        const faltanKg = kilosEntregados - kilosFacturados;
        const montoEstimado = faltanKg * saleKg * (1 + ivaRate);
        list.push({
          id: `sin_fac_${o.id}`,
          type: 'sin_facturar',
          priority: 'alta',
          title: `Entregados ${fmtKilos(faltanKg)} kg sin facturar`,
          subtitle: `OC ${o.oc || o.folio || 'S/N'} (${nombreClienteVisible(o.client)}) — Valor: ${money(montoEstimado)}`,
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

      // 2. Detectar Contrarecibos Vencidos o por cobrar
      invoices.forEach((inv) => {
        const cr = (inv.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;
        const rawDue = (inv.creditCycle?.dueDate as any)?.toDate?.() || (inv.creditCycle?.dueDate ? new Date(inv.creditCycle.dueDate as any) : null);
        const amt = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate));

        if (st === 'overdue' || (rawDue && st === 'pending' && new Date(rawDue).getTime() < today.getTime())) {
          const due = rawDue ? new Date(rawDue) : today;
          const diffDays = Math.max(1, Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
          list.push({
            id: `overdue_${o.id}_${inv.id}`,
            type: 'cr_vencido',
            priority: 'alta',
            title: `CR ${cr || 'S/N'} vencido hace ${diffDays} días (${money(amt)})`,
            subtitle: `Factura ${inv.folio || o.folio || 'S/F'} — ${nombreClienteVisible(o.client)}`,
            amount: amt,
            buttonLabel: '📲 Cobrar por WhatsApp',
            buttonColor: '#ef4444',
            buttonIcon: '💬',
            onAction: () => {
              const notice = generateCollectionNotice({
                cliente: nombreClienteVisible(o.client) || 'Grupo Textil Providencia',
                folioFactura: inv.folio || o.folio || 'S/N',
                contrarecibo: cr || undefined,
                monto: amt,
                fechaVencimiento: rawDue,
              });
              openWhatsAppMessage(notice);
            },
          });
        }

        // 3. Detectar Dinero Cobrado con el Contador Listo para Recibir en Caja
        if (st === 'paid') {
          const comision = inv.financials?.commission ?? computeCommissionFromInvoiceTotal(amt, config as any);
          const neto = amt - comision;
          list.push({
            id: `paid_${o.id}_${inv.id}`,
            type: 'contador_listo',
            priority: 'media',
            title: `Dinero cobrado listo en contabilidad (${money(neto)})`,
            subtitle: `Factura ${inv.folio || o.folio || 'S/F'} (Total: ${money(amt)}, Comisión 8%: ${money(comision)})`,
            amount: neto,
            buttonLabel: '💰 Recibir en Caja',
            buttonColor: '#10b981',
            buttonIcon: '💵',
            onAction: () => nav('/caja-chica'),
          });
        }
      });
    });

    // 4. Detectar Pedidos de Andrés con Atraso de Fabricación
    purchases.forEach((p) => {
      const faltan = (p.expectedKilos || 0) - (p.receivedKilos || 0);
      if (faltan > 50) {
        const orderLinked = orders.find(o => o.id === p.id);
        const ocName = orderLinked?.oc || orderLinked?.folio || p.id;
        list.push({
          id: `andres_${p.id}`,
          type: 'andres_atraso',
          priority: 'baja',
          title: `Andrés tiene pendiente fabricar ${fmtKilos(faltan)} kg`,
          subtitle: `Para pedido ${ocName} (${money(faltan * costKg)} en material)`,
          kilos: faltan,
          buttonLabel: '📞 Preguntar a Andrés',
          buttonColor: '#8b5cf6',
          buttonIcon: '📲',
          onAction: () => {
            const msg = `Hola Andrés, ¿cómo vas con los ${fmtKilos(faltan)} kg pendientes para el pedido ${ocName}? ¿Cuándo sale la próxima entrega?`;
            openWhatsAppMessage(msg);
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
