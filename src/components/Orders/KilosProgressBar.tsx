import { kilos } from '../../lib/format';

interface KilosProgressBarProps {
  deliveredKg: number;
  totalKg: number;
  compact?: boolean;
}

export function KilosProgressBar({ deliveredKg, totalKg, compact = false }: KilosProgressBarProps) {
  const safeTotal = Math.max(0, totalKg || 0);
  const safeDelivered = Math.max(0, deliveredKg || 0);
  const pct = safeTotal > 0 ? Math.min(100, Math.round((safeDelivered / safeTotal) * 100)) : (safeDelivered > 0 ? 100 : 0);
  const isComplete = pct >= 100 || (safeTotal > 0 && safeDelivered >= safeTotal);
  const faltanKg = Math.max(0, safeTotal - safeDelivered);

  const barColor = isComplete
    ? '#10b981'
    : pct >= 50
    ? 'linear-gradient(90deg, #3b82f6 0%, #10b981 100%)'
    : pct > 0
    ? 'linear-gradient(90deg, #f59e0b 0%, #3b82f6 100%)'
    : 'var(--line-soft)';

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', minWidth: 120 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700 }}>
          <span style={{ color: isComplete ? '#047857' : 'var(--ink)' }}>
            {isComplete ? '✅ 100% Surtido' : `${pct}% (${kilos(safeDelivered)}/${kilos(safeTotal)} kg)`}
          </span>
          {!isComplete && faltanKg > 0 && (
            <span style={{ color: '#d97706', fontSize: 10.5 }}>
              Faltan {kilos(faltanKg)} kg
            </span>
          )}
        </div>
        <div
          style={{
            height: 6,
            width: '100%',
            background: 'var(--paper-sunk)',
            borderRadius: 6,
            overflow: 'hidden',
            border: '1px solid var(--line-soft)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: barColor,
              borderRadius: 6,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: '6px 8px',
        background: isComplete ? 'rgba(16,185,129,0.06)' : 'var(--paper-sunk)',
        borderRadius: 8,
        border: `1px solid ${isComplete ? 'rgba(16,185,129,0.25)' : 'var(--line-soft)'}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span>{isComplete ? '📦' : '🚚'}</span>
          <strong style={{ color: isComplete ? '#047857' : 'var(--ink)' }}>
            {isComplete ? '100% Surtido por Andrés' : `Avance de Entrega: ${pct}%`}
          </strong>
        </div>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
          {kilos(safeDelivered)} / {kilos(safeTotal)} kg
        </span>
      </div>

      <div
        style={{
          height: 8,
          width: '100%',
          background: 'var(--paper)',
          borderRadius: 8,
          overflow: 'hidden',
          border: '1px solid var(--line-soft)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: barColor,
            borderRadius: 8,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      {!isComplete && faltanKg > 0 && (
        <div style={{ fontSize: 10.5, color: '#b45309', display: 'flex', justifyContent: 'flex-end', fontWeight: 600 }}>
          ⏳ Faltan por entregar: {kilos(faltanKg)} kg
        </div>
      )}
    </div>
  );
}
