import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { money, kilos as fmtKilos, nombreClienteVisible } from '../../lib/format';
import { getOrderSummary, round2 } from '../../lib/finance';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';

interface ProactiveBriefingCardProps {
  orders: PurchaseOrder[];
  config: FinancialConfig;
  onOpenQuickInvoice: (orderId?: string) => void;
  onOpenQuickCollection: () => void;
  onOpenOrder: (order: PurchaseOrder) => void;
}

interface ActionItem {
  id: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  actionLabel: string;
  actionColor: string;
  actionIcon: string;
  onExecute: () => void;
}

export function ProactiveBriefingCard({
  orders,
  config,
  onOpenQuickInvoice,
  onOpenQuickCollection,
  onOpenOrder,
}: ProactiveBriefingCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const saleKg = config?.salePricePerKg || 43;
  const ivaRate = config?.ivaRate || 0.16;

  const proactiveActions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Entregas recibidas listas para facturar
    const unbilledOrders = orders.filter(o => {
      if (o.isClosedShort) return false;
      const s = getOrderSummary(o);
      return s.kilosDelivered > s.kilosInvoiced + 0.01;
    });

    if (unbilledOrders.length > 0) {
      const topOrder = unbilledOrders[0];
      const summary = getOrderSummary(topOrder);
      const pendingKg = round2(Math.max(0, summary.kilosDelivered - summary.kilosInvoiced));
      const estTotal = round2(pendingKg * saleKg * (1 + ivaRate));
      const client = nombreClienteVisible(topOrder.client) || 'Providencia';

      items.push({
        id: `bill_${topOrder.id}`,
        badge: '⚡ LISTO PARA FACTURAR',
        badgeColor: '#f59e0b',
        title: `Hay ${fmtKilos(pendingKg)} kg entregados sin factura (${client})`,
        description: `OC ${topOrder.oc || topOrder.folio || 'S/N'} ampara aprox. ${money(estTotal)} con IVA. Emite la factura para acelerar el contrarecibo.`,
        actionLabel: 'Facturar Entregas',
        actionColor: '#f59e0b',
        actionIcon: '📝',
        onExecute: () => onOpenQuickInvoice(topOrder.id),
      });
    }

    // 2. Facturas en manos del contador listas para ingresar a Caja
    let withAccountantCount = 0;
    let withAccountantTotal = 0;
    orders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        if (inv.creditCycle?.status === 'paid') {
          withAccountantCount++;
          withAccountantTotal += (inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate)));
        }
      });
    });

    if (withAccountantCount > 0) {
      items.push({
        id: 'accountant_cash',
        badge: '💵 CON EL CONTADOR',
        badgeColor: '#10b981',
        title: `${withAccountantCount} factura(s) cobrada(s) por el contador (${money(withAccountantTotal)})`,
        description: `El dinero ya fue liquidado por el cliente. Registra la recepción en efectivo para sumar a Caja Chica.`,
        actionLabel: 'Ingresar a Caja',
        actionColor: '#10b981',
        actionIcon: '💰',
        onExecute: onOpenQuickCollection,
      });
    }

    // 3. Facturas con Contrarecibo vencido o por vencer hoy
    const urgentInvoices: { order: PurchaseOrder; folio: string; cr: string; amount: number; isOverdue: boolean }[] = [];
    orders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;
        if ((st === 'pending' || st === 'overdue' || st === 'facturado') && cr) {
          const rawDue = inv.creditCycle?.dueDate as any;
          let dueTime: number | null = null;
          if (rawDue) {
            if (typeof rawDue.toMillis === 'function') dueTime = rawDue.toMillis();
            else if (typeof rawDue.toDate === 'function') dueTime = rawDue.toDate().getTime();
            else if (rawDue instanceof Date) dueTime = rawDue.getTime();
          }

          const isOverdue = st === 'overdue' || (dueTime !== null && dueTime <= today.getTime());
          if (isOverdue) {
            urgentInvoices.push({
              order: o,
              folio: inv.folio || o.folio || 'S/F',
              cr,
              amount: inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * (1 + ivaRate)),
              isOverdue,
            });
          }
        }
      });
    });

    if (urgentInvoices.length > 0) {
      const topUrgent = urgentInvoices[0];
      items.push({
        id: `cr_due_${topUrgent.cr}`,
        badge: '🔴 COBRO VENCIDO HOY',
        badgeColor: '#ef4444',
        title: `Contrarecibo ${topUrgent.cr} listo para cobrar (${money(topUrgent.amount)})`,
        description: `Factura #${topUrgent.folio} (${nombreClienteVisible(topUrgent.order.client)}). Contacta a tesorería o al contador para conciliar el pago.`,
        actionLabel: 'Ver en Cobranza',
        actionColor: '#ef4444',
        actionIcon: '📲',
        onExecute: () => onOpenOrder(topUrgent.order),
      });
    }

    return items;
  }, [orders, saleKg, ivaRate, onOpenQuickInvoice, onOpenQuickCollection, onOpenOrder]);

  if (proactiveActions.length === 0) return null;

  const current = proactiveActions[Math.min(currentIndex, proactiveActions.length - 1)];

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % proactiveActions.length);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + proactiveActions.length) % proactiveActions.length);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="proactive-briefing-card"
      style={{
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.95) 100%)',
        border: `1px solid ${current.badgeColor}40`,
        borderRadius: 18,
        padding: '14px 18px',
        marginBottom: 16,
        color: '#ffffff',
        boxShadow: `0 8px 24px -6px ${current.badgeColor}25, 0 4px 12px rgba(0,0,0,0.2)`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Barra de brillo decorativa superior */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, transparent, ${current.badgeColor}, transparent)`,
        }} 
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        
        {/* Cabecera & Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span 
            style={{ 
              fontSize: 10.5, 
              fontWeight: 800, 
              padding: '3px 8px', 
              borderRadius: 6, 
              background: `${current.badgeColor}25`, 
              color: current.badgeColor,
              border: `1px solid ${current.badgeColor}60`,
              letterSpacing: '0.04em'
            }}
          >
            {current.badge}
          </span>
          {proactiveActions.length > 1 && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
              Acción {currentIndex + 1} de {proactiveActions.length}
            </span>
          )}
        </div>

        {/* Controles de Navegación si hay más de 1 acción */}
        {proactiveActions.length > 1 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              onClick={handlePrev}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
              aria-label="Acción anterior"
            >
              ◀
            </button>
            <button
              type="button"
              onClick={handleNext}
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}
              aria-label="Siguiente acción"
            >
              ▶
            </button>
          </div>
        )}
      </div>

      {/* Contenido Dinámico */}
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2 }}
          style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}
        >
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#f8fafc', lineHeight: 1.3 }}>
              {current.title}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.4 }}>
              {current.description}
            </div>
          </div>

          <div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              type="button"
              onClick={current.onExecute}
              style={{
                background: current.actionColor,
                color: '#ffffff',
                border: 'none',
                borderRadius: 10,
                padding: '9px 16px',
                fontWeight: 800,
                fontSize: 13,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: `0 4px 14px ${current.actionColor}50`,
                whiteSpace: 'nowrap',
              }}
            >
              <span>{current.actionIcon}</span> {current.actionLabel}
            </motion.button>
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
