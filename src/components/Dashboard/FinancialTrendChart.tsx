import React, { useState, useMemo } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';
import { AnimatedNumber } from '../ui/AnimatedNumber';

interface FinancialTrendChartProps {
  orders: PurchaseOrder[];
  style?: React.CSSProperties;
}

export const FinancialTrendChart: React.FC<FinancialTrendChartProps> = ({
  orders,
  style = {},
}) => {
  const [period, setPeriod] = useState<'30d' | '90d' | '1y'>('30d');
  const [activePoint, setActivePoint] = useState<{ label: string; kilos: number; sales: number; profit: number } | null>(null);

  const data = useMemo(() => {
    const days = period === '30d' ? 30 : period === '90d' ? 90 : 365;
    const now = Date.now();
    const startTime = now - days * 24 * 60 * 60 * 1000;

    const bucketCount = period === '30d' ? 6 : period === '90d' ? 8 : 12;
    const bucketDuration = (days * 24 * 60 * 60 * 1000) / bucketCount;

    const buckets = Array.from({ length: bucketCount }).map((_, i) => {
      const bStart = startTime + i * bucketDuration;
      const d = new Date(bStart);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      return {
        label,
        start: bStart,
        end: bStart + bucketDuration,
        kilos: 0,
        sales: 0,
        profit: 0,
      };
    });

    (orders || []).forEach((order) => {
      (order.deliveries || []).forEach((del: any) => {
        const t = del.date?.toMillis ? del.date.toMillis() : del.date?._seconds ? del.date._seconds * 1000 : 0;
        if (t >= startTime && t <= now) {
          const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - startTime) / bucketDuration)));
          buckets[bIdx].kilos += Number(del.kilograms) || 0;
        }
      });

      (order.invoices || []).forEach((inv: any) => {
        const st = inv.creditCycle?.status;
        if (st === 'pedido') return;
        const rawDate = inv.creditCycle?.issueDate ?? inv.issueDate;
        const t = rawDate?.toMillis ? rawDate.toMillis() : rawDate?._seconds ? rawDate._seconds * 1000 : 0;
        if (t >= startTime && t <= now) {
          const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - startTime) / bucketDuration)));
          buckets[bIdx].sales += Number(inv.financials?.subtotal) || Number(inv.financials?.saleTotal) || 0;
          buckets[bIdx].profit += Number(inv.financials?.netProfit) || Number(inv.financials?.netCashFlow) || 0;
        }
      });
    });

    return buckets;
  }, [orders, period]);

  const maxSales = Math.max(...data.map((d) => d.sales), 1000);
  const maxKilos = Math.max(...data.map((d) => d.kilos), 500);

  const width = 600;
  const height = 180;
  const padding = 30;

  const pointsSales = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.sales / maxSales) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const pointsKilos = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = height - padding - (d.kilos / maxKilos) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(' ');

  const totalKilosPeriod = data.reduce((acc, d) => acc + d.kilos, 0);
  const totalSalesPeriod = data.reduce((acc, d) => acc + d.sales, 0);
  const totalProfitPeriod = data.reduce((acc, d) => acc + d.profit, 0);

  return (
    <div
      style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* Header & Period Switcher */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>📈</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>
              Tendencia de Flujo & Producción
            </h3>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            Volumen de kilos maquilados vs. facturación neta
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'var(--paper-sunk)', padding: 3, borderRadius: 10 }}>
          {(['30d', '90d', '1y'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? 'var(--accent)' : 'transparent',
                color: period === p ? '#fff' : 'var(--ink-soft)',
                border: 'none',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {p === '30d' ? '30 Días' : p === '90d' ? '90 Días' : '1 Año'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Chips */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: 'var(--info-bg)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 700 }}>KILOS MAQUILADOS</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--info)' }}>
            <AnimatedNumber value={totalKilosPeriod} format="kilos" />
          </div>
        </div>
        <div style={{ background: 'var(--ok-bg)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 700 }}>FACTURACIÓN</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ok)' }}>
            <AnimatedNumber value={totalSalesPeriod} format="money" />
          </div>
        </div>
        <div style={{ background: 'var(--warn-bg)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 700 }}>UTILIDAD NETA</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--warn)' }}>
            <AnimatedNumber value={totalProfitPeriod} format="money" />
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: 180, display: 'block' }}>
          <defs>
            <linearGradient id="salesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--ok)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="kilosGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--info)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--info)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = height - padding - ratio * (height - 2 * padding);
            return (
              <line
                key={ratio}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="var(--line-soft)"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Lines */}
          <polyline fill="none" stroke="var(--info)" strokeWidth="2.5" strokeLinecap="round" points={pointsKilos} />
          <polyline fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" points={pointsSales} />

          {/* Interactive Points */}
          {data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
            const ySales = height - padding - (d.sales / maxSales) * (height - 2 * padding);
            const yKilos = height - padding - (d.kilos / maxKilos) * (height - 2 * padding);
            return (
              <g key={i} onMouseEnter={() => setActivePoint(d)} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={ySales} r={4} fill="var(--ok)" stroke="var(--paper-raised)" strokeWidth={2} />
                <circle cx={x} cy={yKilos} r={4} fill="var(--info)" stroke="var(--paper-raised)" strokeWidth={2} />
                <text x={x} y={height - 8} fill="var(--ink-faint)" fontSize="10" textAnchor="middle" fontWeight="600">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {activePoint && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              right: 10,
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11.5,
              color: 'var(--ink)',
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 800, color: 'var(--accent)', marginBottom: 2 }}>Período {activePoint.label}</div>
            <div>🔵 Kilos: <b>{activePoint.kilos.toLocaleString('es-MX')} kg</b></div>
            <div>🟢 Ventas: <b>{money(activePoint.sales)}</b></div>
            <div>🟡 Utilidad: <b>{money(activePoint.profit)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
};
