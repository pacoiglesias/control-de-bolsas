import React, { useState } from 'react';
import { money } from '../../lib/format';

export interface MonthlyTrendData {
  month: string;
  facturado: number;
  cobrado: number;
  kilos: number;
}

interface BillingTrendChartProps {
  data?: MonthlyTrendData[];
  title?: string;
  subtitle?: string;
}

const DEFAULT_TREND_DATA: MonthlyTrendData[] = [
  { month: 'Ene', facturado: 420000, cobrado: 390000, kilos: 8400 },
  { month: 'Feb', facturado: 580000, cobrado: 540000, kilos: 11600 },
  { month: 'Mar', facturado: 610000, cobrado: 600000, kilos: 12200 },
  { month: 'Abr', facturado: 740000, cobrado: 710000, kilos: 14800 },
  { month: 'May', facturado: 890000, cobrado: 850000, kilos: 17800 },
  { month: 'Jun', facturado: 1050000, cobrado: 980000, kilos: 21000 },
  { month: 'Jul', facturado: 1180000, cobrado: 1120000, kilos: 23600 },
  { month: 'Ago', facturado: 1320000, cobrado: 1250000, kilos: 26400 },
];

export const BillingTrendChart: React.FC<BillingTrendChartProps> = ({
  data = DEFAULT_TREND_DATA,
  title = '📈 Curva de Facturación vs Cobranza Mensual',
  subtitle = 'Evolución de flujo de efectivo y volumen de entrega en 2026',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 640;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const maxVal = Math.max(...data.map(d => Math.max(d.facturado, d.cobrado)), 100000);

  const getX = (idx: number) => paddingX + (idx / (data.length - 1)) * (width - paddingX * 2);
  const getY = (val: number) => height - paddingY - (val / maxVal) * (height - paddingY * 2);

  // Generar path SVG suave (Bezier)
  const buildSmoothPath = (points: { x: number; y: number }[]) => {
    if (points.length === 0) return '';
    return points.reduce((acc, point, i, arr) => {
      if (i === 0) return `M ${point.x},${point.y}`;
      const prev = arr[i - 1];
      const cx1 = prev.x + (point.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (point.x - prev.x) / 2;
      const cy2 = point.y;
      return `${acc} C ${cx1},${cy1} ${cx2},${cy2} ${point.x},${point.y}`;
    }, '');
  };

  const factPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.facturado) }));
  const cobPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.cobrado) }));

  const factPath = buildSmoothPath(factPoints);
  const cobPath = buildSmoothPath(cobPoints);

  const factArea = `${factPath} L ${factPoints[factPoints.length - 1].x},${height - paddingY} L ${factPoints[0].x},${height - paddingY} Z`;
  const cobArea = `${cobPath} L ${cobPoints[cobPoints.length - 1].x},${height - paddingY} L ${cobPoints[0].x},${height - paddingY} Z`;

  const currentItem = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div
      style={{
        background: 'var(--paper-raised)',
        border: '1px solid var(--line-soft)',
        borderRadius: 'var(--radius)',
        padding: '20px',
        boxShadow: 'var(--shadow-sm)',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}>
            {title}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: 'var(--ink-soft)' }}>
            {subtitle}
          </p>
        </div>

        {/* Leyenda y Valor en Hover */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ color: 'var(--ink-soft)' }}>Facturado:</span>
            <strong className="mono" style={{ color: 'var(--ink)' }}>{money(currentItem.facturado)}</strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ok)', display: 'inline-block' }} />
            <span style={{ color: 'var(--ink-soft)' }}>Cobrado:</span>
            <strong className="mono" style={{ color: 'var(--ok)' }}>{money(currentItem.cobrado)}</strong>
          </div>
        </div>
      </div>

      {/* SVG Interactivo */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', minWidth: 480, overflow: 'visible' }}
        >
          <defs>
            <linearGradient id="factGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="cobGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--ok)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Líneas Guía Horizontales */}
          {[0.25, 0.5, 0.75, 1].map((ratio, i) => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <g key={i}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="var(--line-soft)" strokeDasharray="3 3" strokeWidth="1" />
                <text x={paddingX - 6} y={y + 3} fill="var(--ink-faint)" fontSize="9.5" textAnchor="end" fontFamily="IBM Plex Mono">
                  ${Math.round((maxVal * ratio) / 1000)}k
                </text>
              </g>
            );
          })}

          {/* Áreas de Relleno */}
          <path d={factArea} fill="url(#factGrad)" />
          <path d={cobArea} fill="url(#cobGrad)" />

          {/* Líneas de Tendencia */}
          <path d={factPath} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={cobPath} fill="none" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" />

          {/* Puntos y Nodos */}
          {data.map((d, i) => {
            const x = getX(i);
            const yCob = getY(d.cobrado);
            const isHovered = hoveredIdx === i;

            return (
              <g
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Eje X Etiquetas */}
                <text
                  x={x}
                  y={height - 6}
                  fill={isHovered ? 'var(--ink)' : 'var(--ink-soft)'}
                  fontSize="11"
                  fontWeight={isHovered ? '700' : '500'}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                >
                  {d.month}
                </text>

                {/* Punto Cobrado */}
                <circle
                  cx={x}
                  cy={yCob}
                  r={isHovered ? 5.5 : 3.5}
                  fill="var(--ok)"
                  stroke="var(--paper-raised)"
                  strokeWidth="2"
                  style={{ transition: 'all 0.15s ease' }}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
