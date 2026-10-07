import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { IconClipboardList, IconClock, IconCoins, IconCheckCircle } from '../ui/icons';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): barra de tabs con
 * contadores extraída tal cual, sin cambiar lógica.
 */
export default function CobranzaTabsNav() {
  const { activeTab, setActiveTab, data } = useContext(CobranzaContext)!;

  const operationalTabs = [
    { key: 'tablero', label: 'Tablero Kanban', icon: <IconClipboardList size={16} />, badge: null },
    { key: 'pendientes', label: 'Pendientes', icon: <IconClock size={16} />, badge: data.open.length, color: '#f59e0b' },
    { key: 'pagadas', label: 'Por Recoger', icon: <IconCoins size={16} />, badge: data.paid.length, color: '#3b82f6' },
    { key: 'recogidas', label: 'Recogidas', icon: <IconCheckCircle size={16} />, badge: data.collected.length, color: '#10b981' },
  ];

  const toolTabs = [
    { key: 'calendario', label: '📅 Calendario', title: 'Calendario de proyección de cobros de los viernes' },
    { key: 'rep', label: '🏦 Monitor REP', title: 'Monitor de Complementos de Pago SAT (REP / TR)' },
    { key: 'contabilidad', label: '📑 Liquidación', title: 'Liquidación a Contabilidad y Cortes' },
    { key: 'estado_cuenta', label: '⚖️ Espejo Providencia', title: 'Estado de Cuenta y Validación Espejo' },
    { key: 'three_way', label: '🛡️ 3-Way Match', title: 'Conciliación Canónica: OC ➔ Báscula ➔ Factura SAT' },
  ];

  return (
    <div style={{ marginBottom: 20, marginTop: 16 }}>
      {/* Barra de Control de Cobranza (Segmented Control Táctil ≥ 44px) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(12px)',
          padding: 4,
          borderRadius: 14,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {operationalTabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '8px 16px',
                minHeight: 44,
                borderRadius: 10,
                border: isActive ? '1px solid rgba(37, 99, 235, 0.4)' : '1px solid transparent',
                background: isActive ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.25) 0%, rgba(29, 78, 216, 0.15) 100%)' : 'transparent',
                color: isActive ? '#60a5fa' : 'var(--ink-soft)',
                fontWeight: isActive ? 800 : 600,
                fontSize: 13,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge !== null && t.badge > 0 && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: isActive ? (t.color ? `${t.color}33` : 'rgba(255,255,255,0.2)') : 'rgba(255,255,255,0.06)',
                    color: t.color || '#fff',
                    border: `1px solid ${t.color ? `${t.color}44` : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}

        <div style={{ width: 1, height: 24, background: 'rgba(255, 255, 255, 0.12)', margin: '0 4px', flexShrink: 0 }} />

        {/* Herramientas Fiscales & Auditoría (Pills Rápidas) */}
        {toolTabs.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key as any)}
              title={t.title}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                minHeight: 38,
                borderRadius: 8,
                border: isActive ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
                background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                color: isActive ? '#34d399' : '#94a3b8',
                fontWeight: isActive ? 700 : 500,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
