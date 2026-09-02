import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { money, fmtDate, toDate } from '../../lib/format';
import { extractCr, daysLate } from '../../lib/finance';
import { generateCollectionNotice, openWhatsAppMessage } from '../../lib/whatsappReminder';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface CalendarEventItem {
  id: string;
  order: PurchaseOrder;
  invoice: Invoice;
  cr: string;
  client: string;
  dept: string;
  amount: number;
  dueDate: Date;
  status: 'overdue' | 'pending' | 'paid' | 'collected';
  daysOverdue: number;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function CashFlowCalendarView({
  orders,
  onOpenInvoice,
}: {
  orders: PurchaseOrder[];
  onOpenInvoice?: (order: PurchaseOrder, invoiceId: string) => void;
}) {
  const [currentDate, setCurrentDate] = useState(() => new Date(2026, 8, 1)); // Septiembre 2026 default
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: CalendarEventItem[] } | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  // 1. Extraer todos los eventos de cobranza
  const allEvents = useMemo(() => {
    const events: CalendarEventItem[] = [];
    const seen = new Set<string>();

    (orders || []).forEach((o) => {
      if (!o || (o as any).isDeleted) return;
      const isTH = (o.client || '').toUpperCase().includes('TH') || (o.folio || '').includes('14114');
      const dept = isTH ? 'TH' : 'GT';

      (o.invoices || []).forEach((inv) => {
        if (!inv) return;
        const cr = extractCr(inv, o);
        const rawDue = inv.creditCycle?.dueDate || inv.collection?.contrareciboDate;
        const due = toDate(rawDue);
        if (!due) return;

        const amt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? ((inv.kilos || 0) * 43 * 1.16);
        if (amt <= 0) return;

        const eventKey = `${cr || inv.folio || inv.id}-${due.toISOString().split('T')[0]}`;
        if (seen.has(eventKey)) return;
        seen.add(eventKey);

        const dLate = daysLate(due) ?? 0;
        const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
        let status: 'overdue' | 'pending' | 'paid' | 'collected' = 'pending';
        if (isPaid) {
          status = inv.creditCycle?.status as any;
        } else if (dLate > 0) {
          status = 'overdue';
        }

        events.push({
          id: inv.id || `evt-${Math.random()}`,
          order: o,
          invoice: inv,
          cr: cr || `F-#${inv.folio || 'S/F'}`,
          client: o.client || 'Providencia',
          dept,
          amount: amt,
          dueDate: due,
          status,
          daysOverdue: dLate,
        });
      });
    });

    return events;
  }, [orders]);

  // 2. Eventos del mes actual
  const monthEvents = useMemo(() => {
    return allEvents.filter((evt) => {
      return (
        evt.dueDate.getFullYear() === currentYear &&
        evt.dueDate.getMonth() === currentMonth
      );
    });
  }, [allEvents, currentYear, currentMonth]);

  // 3. Totales del mes
  const monthTotal = useMemo(() => {
    return monthEvents.reduce((acc, e) => acc + e.amount, 0);
  }, [monthEvents]);

  const monthOverdueTotal = useMemo(() => {
    return monthEvents.filter((e) => e.status === 'overdue').reduce((acc, e) => acc + e.amount, 0);
  }, [monthEvents]);

  // 4. Construir días del mes
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: Array<{ dayNum: number | null; date: Date | null; events: CalendarEventItem[] }> = [];

    // Relleno inicial
    for (let i = 0; i < firstDay; i++) {
      days.push({ dayNum: null, date: null, events: [] });
    }

    // Días del mes
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const thisDate = new Date(currentYear, currentMonth, d);
      const dayEvts = monthEvents.filter((e) => e.dueDate.getDate() === d);
      days.push({ dayNum: d, date: thisDate, events: dayEvts });
    }

    return days;
  }, [currentYear, currentMonth, monthEvents]);

  // Navegación
  const prevMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };
  const nextMonth = () => {
    triggerHaptic('light');
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
  };
  const goToday = () => {
    triggerHaptic('medium');
    setCurrentDate(new Date(2026, 8, 1));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de Control de Navegación & KPIs Mensuales */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 16,
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
            📅 {MONTH_NAMES[currentMonth]} {currentYear}
          </h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
              onClick={prevMonth}
            >
              ◀ Mes Ant.
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
              onClick={goToday}
            >
              🎯 Sep 2026
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700 }}
              onClick={nextMonth}
            >
              Mes Sig. ▶
            </button>
          </div>
        </div>

        {/* Resumen de Flujo del Mes */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
              Flujo Programado en {MONTH_NAMES[currentMonth]}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#059669', letterSpacing: '-0.5px' }}>
              {money(monthTotal)}
            </div>
          </div>
          {monthOverdueTotal > 0 && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '6px 12px',
                borderRadius: 10,
                textAlign: 'right',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#f87171' }}>
                Vencido Acumulado
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#ef4444' }}>
                {money(monthOverdueTotal)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid del Calendario Mensual */}
      <div
        style={{
          background: 'var(--glass-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 16,
          padding: '16px',
          overflowX: 'auto',
        }}
      >
        {/* Cabecera de Días de la Semana */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))',
            gap: 8,
            marginBottom: 10,
            textAlign: 'center',
          }}
        >
          {DAY_NAMES.map((name, i) => (
            <div
              key={name}
              style={{
                fontSize: 12,
                fontWeight: 800,
                textTransform: 'uppercase',
                color: i === 0 || i === 6 ? '#94a3b8' : 'var(--ink-soft)',
                padding: '6px 0',
              }}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Celdas de Días */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(130px, 1fr))',
            gap: 8,
          }}
        >
          {calendarDays.map((cell, idx) => {
            if (!cell.dayNum) {
              return (
                <div
                  key={`empty-${idx}`}
                  style={{
                    minHeight: 110,
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: 12,
                    border: '1px dashed rgba(255, 255, 255, 0.05)',
                  }}
                />
              );
            }

            const hasEvents = cell.events.length > 0;
            const daySum = cell.events.reduce((s, e) => s + e.amount, 0);
            const hasOverdue = cell.events.some((e) => e.status === 'overdue');

            return (
              <motion.div
                key={`day-${cell.dayNum}`}
                whileHover={{ scale: 1.01 }}
                onClick={() => {
                  if (hasEvents) {
                    triggerHaptic('light');
                    setSelectedDayEvents({ date: cell.date!, events: cell.events });
                  }
                }}
                style={{
                  minHeight: 115,
                  background: hasEvents
                    ? hasOverdue
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(185, 28, 28, 0.04) 100%)'
                      : 'linear-gradient(135deg, rgba(5, 150, 105, 0.08) 0%, rgba(4, 120, 87, 0.04) 100%)'
                    : 'var(--paper-sunk)',
                  border: hasEvents
                    ? hasOverdue
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : '1px solid rgba(5, 150, 105, 0.4)'
                    : '1px solid var(--line-soft)',
                  borderRadius: 12,
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: hasEvents ? 'pointer' : 'default',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: hasEvents ? '#fff' : 'var(--ink-soft)',
                    }}
                  >
                    {cell.dayNum}
                  </span>
                  {hasEvents && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        padding: '1px 6px',
                        borderRadius: 999,
                        background: hasOverdue ? '#fee2e2' : '#dcfce7',
                        color: hasOverdue ? '#991b1b' : '#166534',
                      }}
                    >
                      {cell.events.length} CR{cell.events.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {hasEvents ? (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {cell.events.slice(0, 2).map((evt) => (
                        <div
                          key={evt.id}
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 6px',
                            borderRadius: 6,
                            background: evt.status === 'overdue' ? '#dc2626' : '#059669',
                            color: '#fff',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <span>{evt.cr}</span>
                          <span style={{ fontSize: 9.5, opacity: 0.9 }}>{evt.dept}</span>
                        </div>
                      ))}
                      {cell.events.length > 2 && (
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', textAlign: 'center' }}>
                          +{cell.events.length - 2} más...
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 900,
                        color: '#fff',
                        marginTop: 6,
                        textAlign: 'right',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.15)',
                        paddingTop: 4,
                      }}
                    >
                      {money(daySum)}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.2)', textAlign: 'center' }}>
                    —
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Modal / Detalle del Día Seleccionado */}
      {selectedDayEvents && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: 16,
          }}
          onClick={() => setSelectedDayEvents(null)}
        >
          <div
            style={{
              background: 'var(--paper)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              padding: 24,
              maxWidth: 580,
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>
                  📅 Cobranza Programada: {fmtDate(selectedDayEvents.date)}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
                  {selectedDayEvents.events.length} Contrarecibo(s) con fecha de pago
                </p>
              </div>
              <button
                type="button"
                className="btn secondary"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => setSelectedDayEvents(null)}
              >
                ✕ Cerrar
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
              {selectedDayEvents.events.map((evt) => (
                <div
                  key={evt.id}
                  style={{
                    background: 'var(--paper-sunk)',
                    border: '1px solid var(--line)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 900,
                          color: evt.status === 'overdue' ? '#f87171' : '#34d399',
                        }}
                      >
                        {evt.cr}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: evt.dept === 'TH' ? '#e0f2fe' : '#dcfce7',
                          color: evt.dept === 'TH' ? '#0369a1' : '#15803d',
                        }}
                      >
                        {evt.dept} · {evt.client}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                      Factura #{evt.invoice.folio || 'S/F'} · Vencimiento: {fmtDate(evt.dueDate)}
                      {evt.daysOverdue > 0 && (
                        <strong style={{ color: '#ef4444', marginLeft: 6 }}>
                          (+{evt.daysOverdue} días)
                        </strong>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
                        {money(evt.amount)}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn"
                      style={{
                        fontSize: 11,
                        padding: '6px 10px',
                        background: '#25D366',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const msg = generateCollectionNotice({
                          folioFactura: evt.invoice.folio || 'S/F',
                          contrarecibo: evt.cr,
                          cliente: evt.client,
                          monto: evt.amount,
                          fechaVencimiento: evt.dueDate,
                        });
                        openWhatsAppMessage(msg);
                      }}
                    >
                      💬 WhatsApp
                    </button>
                    {onOpenInvoice && (
                      <button
                        type="button"
                        className="btn secondary"
                        style={{ fontSize: 11, padding: '6px 10px' }}
                        onClick={() => {
                          setSelectedDayEvents(null);
                          onOpenInvoice(evt.order, evt.invoice.id);
                        }}
                      >
                        📂 Ver
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
