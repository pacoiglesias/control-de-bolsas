import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, toDate, fmtDayAndDate, nombreClienteVisible } from '../../lib/format';
import { QuickCollectionModal } from '../FastFlows/QuickCollectionModal';
import type { PurchaseOrder } from '../../lib/types';

interface ContrarecibosTimelineProps {
  orders: PurchaseOrder[];
  nav: (path: string) => void;
}

export function ContrarecibosTimeline({ orders, nav }: ContrarecibosTimelineProps) {
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [filterType, setFilterType] = useState<'todos' | 'vencidos' | 'semana' | 'mes'>('todos');

  const timelineData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const items: Array<{
      order: PurchaseOrder;
      folio: string;
      cr: string;
      dueDate: Date;
      amount: number;
      status: 'overdue' | 'today' | 'this_week' | 'future';
      daysDiff: number;
    }> = [];

    orders.forEach((o) => {
      if (o.isClosedShort) return;
      (o.invoices || []).forEach((inv) => {
        const cr = (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '').trim();
        const st = inv.creditCycle?.status;
        if (cr && (st === 'pending' || st === 'overdue' || st === 'facturado')) {
          const due = toDate(inv.creditCycle?.dueDate);
          if (due) {
            due.setHours(0, 0, 0, 0);
            const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            const amt = inv.financials?.invoiceTotal ?? (inv.financials?.saleTotal ?? 0);

            let status: 'overdue' | 'today' | 'this_week' | 'future' = 'future';
            if (diffDays < 0) status = 'overdue';
            else if (diffDays === 0) status = 'today';
            else if (diffDays <= 7) status = 'this_week';

            items.push({
              order: o,
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

    return items.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [orders]);

  if (timelineData.length === 0) return null;

  const countVencidos = timelineData.filter((it) => it.status === 'overdue').length;
  const countSemana = timelineData.filter((it) => it.status === 'today' || it.status === 'this_week').length;
  const countMes = timelineData.filter((it) => it.daysDiff >= 0 && it.daysDiff <= 30).length;

  const filteredItems = timelineData.filter((it) => {
    if (filterType === 'vencidos') return it.status === 'overdue';
    if (filterType === 'semana') return it.status === 'today' || it.status === 'this_week';
    if (filterType === 'mes') return it.daysDiff >= 0 && it.daysDiff <= 30;
    return true;
  }).slice(0, 12);

  const totalPorCobrarProximo = filteredItems.reduce((acc, it) => acc + it.amount, 0);

  return (
    <>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📅</span> Próximos Vencimientos de Contrarecibos (Cobranza)
              <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: 11 }}>
                {filteredItems.length} de {timelineData.length}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              Fechas exactas de cobro programadas con Providencia.
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)', textTransform: 'uppercase', fontWeight: 700 }}>Total a Cobrar:</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{money(totalPorCobrarProximo)}</div>
            </div>
            <button
              onClick={() => nav('/cobranza')}
              aria-label="Ver todos los contrarecibos en cobranza"
              className="btn"
              style={{ fontSize: 11, padding: '4px 10px', color: 'var(--accent)', fontWeight: 700 }}
            >
              Ver todos →
            </button>
          </div>
        </div>

        {/* Barra de Filtros Rápidos por Chip */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          <button
            type="button"
            className={`chip ${filterType === 'todos' ? 'active' : ''}`}
            onClick={() => setFilterType('todos')}
            style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
          >
            📋 Todos ({timelineData.length})
          </button>
          {countVencidos > 0 && (
            <button
              type="button"
              className={`chip ${filterType === 'vencidos' ? 'active' : ''}`}
              onClick={() => setFilterType('vencidos')}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                cursor: 'pointer',
                background: filterType === 'vencidos' ? '#ef4444' : 'rgba(239, 68, 68, 0.1)',
                color: filterType === 'vencidos' ? '#fff' : '#b91c1c',
                border: '1px solid #ef4444',
                fontWeight: 700,
              }}
            >
              🚨 Vencidos ({countVencidos})
            </button>
          )}
          <button
            type="button"
            className={`chip ${filterType === 'semana' ? 'active' : ''}`}
            onClick={() => setFilterType('semana')}
            style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
          >
            ⚡ Esta Semana ({countSemana})
          </button>
          <button
            type="button"
            className={`chip ${filterType === 'mes' ? 'active' : ''}`}
            onClick={() => setFilterType('mes')}
            style={{ fontSize: 11, padding: '4px 10px', cursor: 'pointer' }}
          >
            📆 Próximos 30 Días ({countMes})
          </button>
        </div>

        {/* Grid / Lista Responsiva de Contrarecibos con Fechas Destacadas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {filteredItems.map((it, idx) => {
            const isOverdue = it.status === 'overdue';
            const isToday = it.status === 'today';
            const isThisWeek = it.status === 'this_week';

            const borderColor = isOverdue ? '#ef4444' : isToday ? '#10b981' : isThisWeek ? '#f59e0b' : 'var(--line)';
            const headerBg = isOverdue ? 'rgba(239,68,68,0.12)' : isToday ? 'rgba(16,185,129,0.12)' : isThisWeek ? 'rgba(245,158,11,0.12)' : 'var(--paper-sunk)';
            const badgeColor = isOverdue ? '#b91c1c' : isToday ? '#047857' : isThisWeek ? '#b45309' : 'var(--ink-soft)';

            return (
              <motion.div
                key={idx}
                whileHover={{ y: -2, boxShadow: '0 6px 16px rgba(0,0,0,0.08)' }}
                style={{
                  background: 'var(--paper-raised)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Cabecera con Fecha Exacta */}
                <div
                  style={{
                    padding: '8px 12px',
                    background: headerBg,
                    borderBottom: `1px solid ${borderColor}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>📅</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink)' }}>
                      {fmtDayAndDate(it.dueDate)}
                    </span>
                  </div>
                  <span
                    className="badge"
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      background: isOverdue ? '#fee2e2' : isToday ? '#dcfce7' : isThisWeek ? '#fef3c7' : 'var(--paper)',
                      color: badgeColor,
                    }}
                  >
                    {isOverdue
                      ? `⚠️ Vencido hace ${Math.abs(it.daysDiff)} d`
                      : isToday
                      ? '🟢 Vence Hoy'
                      : it.daysDiff === 1
                      ? '⏳ Vence Mañana'
                      : `En ${it.daysDiff} días`}
                  </span>
                </div>

                {/* Cuerpo con Datos Clave */}
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent-deep)' }}>
                        CR #{it.cr}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                        Factura #{it.folio} • {nombreClienteVisible(it.order.client)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Importe c/IVA:</div>
                      <div style={{ fontSize: 16, fontWeight: 900, fontFamily: 'monospace', color: 'var(--ink)' }}>
                        {money(it.amount)}
                      </div>
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ fontSize: 11, padding: '4px 10px', fontWeight: 700 }}
                      onClick={() => setSelectedOrder(it.order)}
                      title="Registrar cobro de este contrarecibo localmente"
                    >
                      💸 Cobrar
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {selectedOrder && (
        <QuickCollectionModal
          orders={[selectedOrder]}
          onClose={() => setSelectedOrder(null)}
        />
      )}
    </>
  );
}

