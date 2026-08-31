import { useMemo, useState } from 'react';
import type { PurchaseOrder, Invoice } from '../../lib/types';
import { money, toDate } from '../../lib/format';
import { inferDepartment, round2 } from '../../lib/finance';

interface WeeklyBucket {
  weekKey: string;
  label: string;
  sublabel: string;
  startDate: Date;
  endDate: Date;
  invoices: { invoice: Invoice; order: PurchaseOrder; dept: string | null }[];
  totalExpectedWithIva: number;
  totalNetDeposit: number;
  totalCommission: number;
  isOverdue?: boolean;
  isCurrentWeek?: boolean;
}

export function CashFlowForecastWidget({ orders }: { orders: PurchaseOrder[] }) {
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [plantFilter, setPlantFilter] = useState<'ALL' | 'TH' | 'GT'>('ALL');

  const forecastData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const daysToMonday = (dayOfWeek + 6) % 7;
    
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - daysToMonday);

    const buckets: Record<string, WeeklyBucket> = {
      overdue: {
        weekKey: 'overdue',
        label: '🚨 Vencidas / Por Conciliar',
        sublabel: 'Cobranza inmediata',
        startDate: new Date(0),
        endDate: new Date(currentMonday.getTime() - 1),
        invoices: [],
        totalExpectedWithIva: 0,
        totalNetDeposit: 0,
        totalCommission: 0,
        isOverdue: true,
      },
    };

    for (let i = 0; i < 5; i++) {
      const start = new Date(currentMonday);
      start.setDate(currentMonday.getDate() + i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      const key = `week_${i}`;
      const startDay = start.getDate();
      const endDay = end.getDate();
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const monthStr = monthNames[start.getMonth()];

      const label = i === 0 
        ? '📅 Esta Semana' 
        : i === 1 
        ? '⚡ Próxima Semana' 
        : `Semana +${i}`;

      buckets[key] = {
        weekKey: key,
        label,
        sublabel: `${startDay} - ${endDay} ${monthStr}`,
        startDate: start,
        endDate: end,
        invoices: [],
        totalExpectedWithIva: 0,
        totalNetDeposit: 0,
        totalCommission: 0,
        isCurrentWeek: i === 0,
      };
    }

    buckets.later = {
      weekKey: 'later',
      label: '⏳ A +30 Días',
      sublabel: 'Cobranza a futuro',
      startDate: new Date(currentMonday.getTime() + 35 * 86400000),
      endDate: new Date(currentMonday.getTime() + 365 * 86400000),
      invoices: [],
      totalExpectedWithIva: 0,
      totalNetDeposit: 0,
      totalCommission: 0,
    };

    orders.forEach((o) => {
      if ((o as any).isDeleted) return;
      const dept = inferDepartment(o);
      if (plantFilter !== 'ALL' && dept !== plantFilter) return;

      (o.invoices || []).forEach((inv) => {
        const status = inv.creditCycle?.status || 'pending';
        if (status === 'paid' || status === 'collected') return;

        const due = toDate(inv.creditCycle?.dueDate);
        const invTotal = Number(inv.financials?.invoiceTotal) || Number(inv.kilos || 0) * 49.88;
        const subtotal = Number(inv.financials?.saleTotal) || Number(inv.kilos || 0) * 43.00;
        const comm = subtotal * 0.08;
        const netDeposit = subtotal * 1.08;

        const item = { invoice: inv, order: o, dept };

        if (!due || due < currentMonday) {
          buckets.overdue.invoices.push(item);
          buckets.overdue.totalExpectedWithIva += invTotal;
          buckets.overdue.totalNetDeposit += netDeposit;
          buckets.overdue.totalCommission += comm;
        } else {
          let placed = false;
          for (let i = 0; i < 5; i++) {
            const key = `week_${i}`;
            if (due >= buckets[key].startDate && due <= buckets[key].endDate) {
              buckets[key].invoices.push(item);
              buckets[key].totalExpectedWithIva += invTotal;
              buckets[key].totalNetDeposit += netDeposit;
              buckets[key].totalCommission += comm;
              placed = true;
              break;
            }
          }
          if (!placed) {
            buckets.later.invoices.push(item);
            buckets.later.totalExpectedWithIva += invTotal;
            buckets.later.totalNetDeposit += netDeposit;
            buckets.later.totalCommission += comm;
          }
        }
      });
    });

    return Object.values(buckets).filter((b) => b.invoices.length > 0 || b.isCurrentWeek);
  }, [orders, plantFilter]);

  const activeBucket = forecastData.find((b) => b.weekKey === selectedWeek) || forecastData[0];
  const grandTotalNet = useMemo(() => {
    return round2(forecastData.reduce((acc, b) => acc + b.totalNetDeposit, 0));
  }, [forecastData]);

  return (
    <div
      style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius-lg, 18px)',
        padding: '18px 20px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 20,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.25) 100%)',
              color: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            📅
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
              Proyección Semanal de Flujo de Efectivo (Cash Flow)
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink-soft)' }}>
              Estimación de depósitos netos esperados por semana según contrarecibos y plazos de crédito.
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-soft)', display: 'block' }}>Flujo Total Proyectado:</span>
          <span className="mono" style={{ fontSize: 18, fontWeight: 900, color: '#10b981' }}>
            {money(grandTotalNet)}
          </span>
        </div>
      </div>

      {/* Selector de Planta Providencia */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Planta:</span>
        <button
          type="button"
          onClick={() => setPlantFilter('ALL')}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
            border: plantFilter === 'ALL' ? '1px solid #3b82f6' : '1px solid var(--line)',
            background: plantFilter === 'ALL' ? 'rgba(59,130,246,0.15)' : 'var(--paper-sunk)',
            color: plantFilter === 'ALL' ? '#2563eb' : 'var(--ink-soft)',
          }}
        >
          🌟 Ambas Plantas
        </button>
        <button
          type="button"
          onClick={() => setPlantFilter('TH')}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
            border: plantFilter === 'TH' ? '1px solid #0284c7' : '1px solid var(--line)',
            background: plantFilter === 'TH' ? 'rgba(2,132,199,0.15)' : 'var(--paper-sunk)',
            color: plantFilter === 'TH' ? '#0284c7' : 'var(--ink-soft)',
          }}
        >
          🟦 Textil Hogar (TH · Nava)
        </button>
        <button
          type="button"
          onClick={() => setPlantFilter('GT')}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            borderRadius: 8,
            fontWeight: 700,
            cursor: 'pointer',
            border: plantFilter === 'GT' ? '1px solid #059669' : '1px solid var(--line)',
            background: plantFilter === 'GT' ? 'rgba(5,150,105,0.15)' : 'var(--paper-sunk)',
            color: plantFilter === 'GT' ? '#059669' : 'var(--ink-soft)',
          }}
        >
          🟩 Grupo Textil (GT · Evelia)
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {forecastData.map((b) => {
          const isSelected = activeBucket?.weekKey === b.weekKey;
          return (
            <button
              key={b.weekKey}
              type="button"
              onClick={() => setSelectedWeek(b.weekKey)}
              style={{
                background: isSelected 
                  ? 'linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(59,130,246,0.18) 100%)'
                  : 'var(--paper-sunk)',
                border: isSelected 
                  ? '2px solid #3b82f6' 
                  : b.isOverdue 
                  ? '1px solid rgba(239, 68, 68, 0.4)' 
                  : '1px solid var(--line)',
                borderRadius: 14,
                padding: '12px 14px',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: b.isOverdue ? '#ef4444' : 'var(--ink)' }}>
                  {b.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: b.invoices.length > 0 ? (b.isOverdue ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.15)') : 'transparent',
                    color: b.isOverdue ? '#ef4444' : '#2563eb',
                    padding: '1px 6px',
                    borderRadius: 6,
                  }}
                >
                  {b.invoices.length} fac
                </span>
              </div>
              <span style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>{b.sublabel}</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 900, color: b.totalNetDeposit > 0 ? (b.isOverdue ? '#ef4444' : '#10b981') : 'var(--ink-soft)', marginTop: 4 }}>
                {money(b.totalNetDeposit)}
              </span>
            </button>
          );
        })}
      </div>

      {activeBucket && activeBucket.invoices.length > 0 && (
        <div
          style={{
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, fontWeight: 800, color: 'var(--ink)' }}>
            <span>📋 Facturas amparadas en {activeBucket.label} ({activeBucket.invoices.length}):</span>
            <span style={{ color: 'var(--ok)' }}>Depósito Neto Esperado: {money(activeBucket.totalNetDeposit)}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {activeBucket.invoices.map(({ invoice, order, dept }, idx) => {
              const due = toDate(invoice.creditCycle?.dueDate);
              const subtotal = Number(invoice.financials?.saleTotal) || Number(invoice.kilos || 0) * 43;
              const netDep = subtotal * 1.08;
              const crNumber = invoice.collection?.contrareciboNumber || order.collection?.contrareciboNumber;

              return (
                <div
                  key={`${invoice.id}_${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--paper-raised)',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--line-soft)',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 800, color: 'var(--ink)' }}>Factura #{invoice.folio}</span>
                    <span className="badge-pill" style={{ fontSize: 10, padding: '1px 6px', background: dept === 'TH' ? 'rgba(2,132,199,0.1)' : 'rgba(5,150,105,0.1)', color: dept === 'TH' ? '#0284c7' : '#059669' }}>
                      {dept}
                    </span>
                    {crNumber && (
                      <span style={{ fontSize: 11, color: '#d97706', fontWeight: 700 }}>
                        CR: {crNumber}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      ({Number(invoice.kilos || 0).toLocaleString('es-MX')} kg)
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      Vence: {due ? due.toLocaleDateString('es-MX') : 'S/F'}
                    </span>
                    <strong className="mono" style={{ color: 'var(--ok)', fontSize: 13 }}>
                      {money(netDep)}
                    </strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}