import React, { useState, useMemo } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';

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

    // Bucket into 6 intervals for smooth visual points
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
      // Aggregate deliveries
      (order.deliveries || []).forEach((del: any) => {
        const t = del.date?.toMillis ? del.date.toMillis() : del.date?._seconds ? del.date._seconds * 1000 : 0;
        if (t >= startTime && t <= now) {
          const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - startTime) / bucketDuration)));
          buckets[bIdx].kilos += Number(del.kilograms) || 0;
        }
      });

      // Aggregate invoices
      (order.invoices || []).forEach((inv: any) => {
        const t = inv.issueDate?.toMillis ? inv.issueDate.toMillis() : inv.issueDate?._seconds ? inv.issueDate._seconds * 1000 : 0;
        if (t >= startTime && t <= now) {
          const bIdx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - startTime) / bucketDuration)));
          buckets[bIdx].sales += Number(inv.financials?.subtotal) || 0;
          buckets[bIdx].profit += Number(inv.financials?.netProfit) || 0;
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
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: '20px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(12px)',
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
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#fff' }}>
              Tendencia de Flujo & Producción
            </h3>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            Volumen de kilos maquilados vs. facturación neta
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.06)', padding: 3, borderRadius: 10 }}>
          {(['30d', '90d', '1y'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                background: period === p ? '#3b82f6' : 'transparent',
                color: period === p ? '#fff' : 'rgba(255,255,255,0.6)',
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
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>KILOS MAQUILADOS</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#60a5fa' }}>{totalKilosPeriod.toLocaleString('es-MX')} kg</div>
        </div>
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>FACTURACIÓN</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#34d399' }}>{money(totalSalesPeriod)}</div>
        </div>
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 10, padding: '8px 12px' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>UTILIDAD NETA</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fbbf24' }}>{money(totalProfitPeriod)}</div>
        </div>
      </div>

      {/* SVG Interactive Chart */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: 180, display: 'block' }}>
          <defs>
            <linearGradient id="salesGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="kilosGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.0" />
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
                stroke="rgba(255, 255, 255, 0.05)"
                strokeDasharray="4,4"
              />
            );
          })}

          {/* Lines */}
          <polyline fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" points={pointsKilos} />
          <polyline fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" points={pointsSales} />

          {/* Interactive Points */}
          {data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
            const ySales = height - padding - (d.sales / maxSales) * (height - 2 * padding);
            const yKilos = height - padding - (d.kilos / maxKilos) * (height - 2 * padding);
            return (
              <g key={i} onMouseEnter={() => setActivePoint(d)} onMouseLeave={() => setActivePoint(null)} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={ySales} r={4} fill="#34d399" stroke="#0f172a" strokeWidth={2} />
                <circle cx={x} cy={yKilos} r={4} fill="#60a5fa" stroke="#0f172a" strokeWidth={2} />
                <text x={x} y={height - 8} fill="rgba(255,255,255,0.4)" fontSize="10" textAnchor="middle" fontWeight="600">
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
              background: 'rgba(15, 23, 42, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 11,
              color: '#fff',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div style={{ fontWeight: 800, color: '#a78bfa', marginBottom: 2 }}>Período {activePoint.label}</div>
            <div>🔵 Kilos: <b>{activePoint.kilos.toLocaleString('es-MX')} kg</b></div>
            <div>🟢 Ventas: <b>{money(activePoint.sales)}</b></div>
            <div>🟡 Utilidad: <b>{money(activePoint.profit)}</b></div>
          </div>
        )}
      </div>
    </div>
  );
};
