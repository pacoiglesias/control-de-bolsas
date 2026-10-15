import { motion, AnimatePresence } from 'framer-motion';
import { sound } from '../../lib/sounds';

export type DashboardViewMode = 'executive' | 'bascula' | 'orders' | 'collection' | 'production' | 'pnl' | 'all';

interface TabDef {
  key: DashboardViewMode;
  icon: string;
  label: string;
  shortLabel: string;
  accentColor: string;
  badgeCount?: number;
  badgeVariant?: 'urgent' | 'info' | 'warn';
}

/**
 * Selector de espacio de trabajo — Pastilla Magnética Deslizante (Spring Physics)
 * ✅ a11y: role="tablist", aria-selected, aria-controls
 * ✅ Touch targets: mínimo 44px
 * ✅ Vistas por Puesto de Trabajo (Báscula, Cobranza, Administración)
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
  const tabs: TabDef[] = [
    {
      key: 'executive',
      icon: '🌟',
      label: 'Mi día',
      shortLabel: 'Mi día',
      accentColor: 'var(--accent)',
    },
    {
      key: 'bascula',
      icon: '⚖️',
      label: 'Báscula & Patio',
      shortLabel: 'Báscula',
      accentColor: '#ea580c',
    },
    {
      key: 'orders',
      icon: '📁',
      label: 'Expedientes & OCs',
      shortLabel: 'OCs',
      accentColor: 'var(--accent)',
      badgeCount: seguimientoOrdersCount,
      badgeVariant: seguimientoOrdersCount > 0 ? 'warn' : undefined,
    },
    {
      key: 'collection',
      icon: '📆',
      label: 'Centro de Cobranza',
      shortLabel: 'Cobranza',
      accentColor: '#0284c7',
    },
    {
      key: 'production',
      icon: '🏭',
      label: `Compras & ${providerName || 'Andrés'}`,
      shortLabel: 'Compras',
      accentColor: '#7c3aed',
    },
    {
      key: 'pnl',
      icon: '⚖️',
      label: 'Resultados',
      shortLabel: 'Resultados',
      accentColor: '#059669',
    },
    {
      key: 'all',
      icon: '👁️',
      label: 'Ver Todo',
      shortLabel: 'Todo',
      accentColor: 'var(--ink)',
    },
  ];

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Barra de Pestañas Deslizante */}
      <div
        role="group"
        aria-label="Espacio de trabajo del dashboard"
        style={{
          display: 'flex',
          gap: 4,
          background: 'var(--paper-sunk)',
          padding: '5px 6px',
          borderRadius: 18,
          border: '1px solid var(--line-soft)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
        }}
      >
      {tabs.map((t) => {
        const isActive = viewMode === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={isActive}
            id={`tab-${t.key}`}
            onClick={() => {
              sound.playPop?.();
              localStorage.setItem('preferred_job_view', t.key);
              setViewMode(t.key);
            }}
            style={{
              position: 'relative',
              flex: t.key === 'all' ? '0 0 auto' : '1 1 0',
              minWidth: t.key === 'all' ? 96 : 120,
              minHeight: 44,           /* ✅ Touch target mínimo */
              padding: '10px 14px',
              borderRadius: 13,
              border: 'none',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              background: 'transparent',
              color: isActive ? t.accentColor : 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              outline: 'none',
              transition: 'color 0.2s ease',
              WebkitTapHighlightColor: 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            {/* 🧲 Pastilla deslizante con spring physics */}
            {isActive && (
              <motion.div
                layoutId="activeDashboardTabPill"
                transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 13,
                  background: 'var(--paper-raised)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.05)',
                  zIndex: 1,
                }}
              />
            )}

            {/* Contenido del tab */}
            <span
              style={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>{t.icon}</span>
              <span className="tab-label-full">{t.label}</span>
              <span className="tab-label-short" style={{ display: 'none' }}>{t.shortLabel}</span>

              {/* Badge animado con conteo */}
              <AnimatePresence>
                {t.badgeCount != null && t.badgeCount > 0 && (
                  <motion.span
                    key={`badge-${t.key}`}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 30 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 18,
                      height: 18,
                      paddingInline: 5,
                      borderRadius: 9,
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1,
                      background: t.badgeVariant === 'urgent' ? 'var(--bad)'
                        : t.badgeVariant === 'warn' ? 'var(--accent)'
                        : 'var(--info)',
                      color: '#fff',
                      letterSpacing: '0',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                    }}
                  >
                    {t.badgeCount > 99 ? '99+' : t.badgeCount}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </button>
        );
      })}

      {/* Estilos responsivos para etiquetas cortas en mobile */}
      <style>{`
        @media (max-width: 680px) {
          .tab-label-full { display: none !important; }
          .tab-label-short { display: inline !important; }
        }
      `}</style>
      </div>
    </div>
  );
}
