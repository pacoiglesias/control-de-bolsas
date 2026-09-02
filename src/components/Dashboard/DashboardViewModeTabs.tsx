import { motion } from 'framer-motion';
import { sound } from '../../lib/sounds';

export type DashboardViewMode = 'executive' | 'orders' | 'collection' | 'production' | 'pnl' | 'all';

/**
 * Selector de espacio de trabajo con Pastilla Magnética Deslizante (Spring Physics)
 * y respuesta táctil háptica.
 */
export function DashboardViewModeTabs({
  viewMode,
  setViewMode,
  seguimientoOrdersCount,
  providerName,
}: {
  viewMode: DashboardViewMode;
  setViewMode: (v: DashboardViewMode) => void;
  seguimientoOrdersCount: number;
  providerName: string;
}) {
  const tabs: { key: DashboardViewMode; icon: string; label: string; activeColor: string }[] = [
    { key: 'executive', icon: '🌟', label: 'Resumen Ejecutivo', activeColor: 'var(--accent)' },
    { key: 'orders', icon: '📁', label: `Expedientes & OCs (${seguimientoOrdersCount})`, activeColor: 'var(--accent)' },
    { key: 'collection', icon: '📆', label: 'Centro de Cobranza', activeColor: '#0284c7' },
    { key: 'production', icon: '🏭', label: `Compras & ${providerName || 'Andrés'}`, activeColor: '#7c3aed' },
    { key: 'pnl', icon: '⚖️', label: 'Corte & P&L (50/50)', activeColor: '#059669' },
    { key: 'all', icon: '👁️', label: 'Ver Todo', activeColor: 'var(--ink)' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
        background: 'var(--paper-sunk)',
        padding: 6,
        borderRadius: 16,
        border: '1px solid var(--line-soft)',
        overflowX: 'auto',
      }}
    >
      {tabs.map((t) => {
        const isActive = viewMode === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              sound.playPop();
              setViewMode(t.key);
            }}
            style={{
              position: 'relative',
              flex: t.key === 'all' ? undefined : 1,
              minWidth: t.key === 'all' ? 110 : 150,
              padding: '10px 16px',
              borderRadius: 12,
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: 'transparent',
              color: isActive ? t.activeColor : 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              outline: 'none',
              transition: 'color 0.2s ease',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="activeDashboardTabPill"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 12,
                  background: 'var(--paper-raised)',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.04)',
                  zIndex: 1,
                }}
              />
            )}
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

