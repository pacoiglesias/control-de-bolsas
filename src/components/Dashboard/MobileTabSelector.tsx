import { motion } from 'framer-motion';

export type DashboardSectionTab = 'hoy' | 'flujo' | 'kilos' | 'cobranza' | 'todo';

interface MobileTabSelectorProps {
  activeTab: DashboardSectionTab;
  urgentCount: number;
  onSelect: (tab: DashboardSectionTab) => void;
}

export function MobileTabSelector({ activeTab, urgentCount, onSelect }: MobileTabSelectorProps) {
  const tabs: { key: DashboardSectionTab; label: string; icon: string; badge?: number }[] = [
    { key: 'hoy', label: 'Hoy', icon: '⚡', badge: urgentCount > 0 ? urgentCount : undefined },
    { key: 'flujo', label: 'Dinero', icon: '💰' },
    { key: 'kilos', label: 'Kilos', icon: '🚚' },
    { key: 'cobranza', label: 'Cobranza', icon: '🧾' },
    { key: 'todo', label: 'Todo', icon: '🏢' },
  ];

  return (
    <div
      role="tablist"
      aria-label="Pestañas de Navegación del Dashboard"
      style={{
        display: 'flex',
        gap: 6,
        background: 'var(--paper-raised)',
        padding: '6px',
        borderRadius: 16,
        border: '1px solid var(--line)',
        marginBottom: 16,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {tabs.map((t) => {
        const isActive = activeTab === t.key;
        return (
          <motion.button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(t.key)}
            type="button"
            style={{
              flex: '1 0 auto',
              background: isActive ? 'var(--brand, #2563eb)' : 'transparent',
              color: isActive ? '#ffffff' : 'var(--ink-soft)',
              border: 'none',
              borderRadius: 12,
              padding: '8px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              boxShadow: isActive ? '0 2px 8px rgba(37, 99, 235, 0.3)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span
                style={{
                  background: isActive ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                  color: isActive ? '#ffffff' : '#ef4444',
                  fontSize: 10,
                  fontWeight: 900,
                  borderRadius: 999,
                  padding: '1px 6px',
                }}
              >
                {t.badge}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
