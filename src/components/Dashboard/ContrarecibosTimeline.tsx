import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { money } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';

interface ContrarecibosTimelineProps {
  orders: PurchaseOrder[];
  nav: (path: string) => void;
}

export function ContrarecibosTimeline({ orders, nav }: ContrarecibosTimelineProps) {
  const handleNavigate = useCallback(() => nav('/cobranza'), [nav]);

  const timelineData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: Array<{
      folio: string;
      cr: string;
      dueDate: Date;
      amount: number;
      status: 'overdue' | 'this_week' | 'future';
      daysDiff: number;
    }> = [];

    orders.forEach((o) => {
      (o.invoices || []).forEach((inv) => {
        const cr = (inv.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;
        if (cr && (st === 'pending' || st === 'overdue')) {
          const rawDue = (inv.creditCycle?.dueDate as any)?.toDate?.() || (inv.creditCycle?.dueDate ? new Date(inv.creditCycle.dueDate as any) : null);
          if (rawDue) {
            const due = new Date(rawDue);
            due.setHours(0, 0, 0, 0);
            const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const amt = inv.financials?.invoiceTotal ?? (inv.financials?.saleTotal ?? 0);

            let status: 'overdue' | 'this_week' | 'future' = 'future';
            if (diffDays < 0) status = 'overdue';
            else if (diffDays <= 7) status = 'this_week';

            items.push({
              folio: inv.folio || o.folio || 'S/N',
              cr,
              dueDate: due,
              amount: amt,
              status,
              daysDiff: diffDays,
            });
          }
        }
      });
    });

    return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()).slice(0, 8);
  }, [orders]);

  if (timelineData.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Línea de tiempo de contrarecibos por cobrar"
      style={{
        background: 'var(--paper)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 24,
        boxShadow: 'var(--shadow-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>📅</span> Timeline de Contrarecibos (Próximos Cobros)
        </div>
        <button
          onClick={handleNavigate}
          aria-label="Ver todos los contrarecibos en cobranza"
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
        >
          Ver todos →
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
        {timelineData.map((it) => {
          const color = it.status === 'overdue' ? '#ef4444' : it.status === 'this_week' ? '#f59e0b' : '#10b981';
          const bg = it.status === 'overdue' ? 'rgba(239,68,68,0.1)' : it.status === 'this_week' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';

          return (
            <motion.div
              key={`${it.folio}-${it.cr}`}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNavigate}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              aria-label={`Contrarecibo ${it.cr}, ${money(it.amount)}, vence en ${it.daysDiff} días`}
              style={{
                minWidth: 140,
                background: bg,
                border: `1px solid ${color}`,
                borderRadius: 10,
                padding: '8px 10px',
                flexShrink: 0,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 800, fontSize: 11, color }}>{it.cr}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ink-soft)' }}>{it.folio}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink)' }}>
                {money(it.amount)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 2 }}>
                {it.daysDiff < 0 ? `Vencido hace ${Math.abs(it.daysDiff)} d` : it.daysDiff === 0 ? 'Vence hoy' : `Vence en ${it.daysDiff} d`}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
