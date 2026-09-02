import React from 'react';

interface KilosFuelBarProps {
  goal: number;
  delivered: number;
  invoiced?: number;
  collected?: number;
  height?: number;
  showLabels?: boolean;
  compact?: boolean;
}

export const KilosFuelBar: React.FC<KilosFuelBarProps> = ({
  goal,
  delivered,
  invoiced = 0,
  collected = 0,
  height = 8,
  showLabels = true,
  compact = false,
}) => {
  const safeGoal = Math.max(1, goal || delivered || 1);
  const pctDelivered = Math.min(100, Math.round((delivered / safeGoal) * 100));
  const pctInvoiced = Math.min(100, Math.round((invoiced / safeGoal) * 100));
  const pctCollected = Math.min(100, Math.round((collected / safeGoal) * 100));

  const isComplete = delivered >= safeGoal && safeGoal > 1;

  return (
    <div style={{ width: '100%' }}>
      {showLabels && !compact && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 11.5,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ color: isComplete ? '#10b981' : '#38bdf8' }}>
              {delivered.toLocaleString('es-MX')} kg
            </span>
            <span style={{ color: 'var(--ink-soft)', opacity: 0.6 }}>/</span>
            <span style={{ color: 'var(--ink-soft)' }}>
              {safeGoal.toLocaleString('es-MX')} kg
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {invoiced > 0 && (
              <span style={{ color: '#f59e0b', fontSize: 10.5 }} title="Kilos Facturados">
                🧾 {pctInvoiced}% fac
              </span>
            )}
            <span
              style={{
                background: isComplete ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                color: isComplete ? '#10b981' : '#38bdf8',
                padding: '1px 6px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {pctDelivered}%
            </span>
          </div>
        </div>
      )}

      {/* Barra de Progreso Multi-Capa */}
      <div
        style={{
          width: '100%',
          height,
          background: 'var(--paper-sunk, rgba(0,0,0,0.25))',
          borderRadius: 999,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
        }}
      >
        {/* Capa 1: Entregas (Base) */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pctDelivered}%`,
            background: isComplete
              ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)'
              : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
            borderRadius: 999,
            transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isComplete ? '0 0 8px rgba(16, 185, 129, 0.5)' : '0 0 8px rgba(56, 189, 248, 0.4)',
          }}
        />

        {/* Capa 2: Facturado */}
        {invoiced > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pctInvoiced}%`,
              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.6) 0%, rgba(217, 119, 6, 0.8) 100%)',
              borderRadius: 999,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}

        {/* Capa 3: Cobrado */}
        {collected > 0 && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${pctCollected}%`,
              background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
              borderRadius: 999,
              transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        )}
      </div>
    </div>
  );
};
