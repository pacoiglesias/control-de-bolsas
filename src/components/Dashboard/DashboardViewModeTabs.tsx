export type DashboardViewMode = 'executive' | 'orders' | 'collection' | 'production' | 'pnl' | 'all';

/**
 * FIX (v8.9.8, split de pages/Dashboard.tsx — ~1460 lineas): selector de
 * espacio de trabajo (pestañas de alta densidad) extraido tal cual como
 * componente presentacional puro, sin cambiar logica ni estilos.
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
      <button
        type="button"
        onClick={() => setViewMode('executive')}
        style={{
          flex: 1,
          minWidth: 150,
          padding: '10px 16px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'executive' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'executive' ? 'var(--accent)' : 'var(--ink-soft)',
          boxShadow: viewMode === 'executive' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>🌟</span>
        <span>Resumen Ejecutivo</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('orders')}
        style={{
          flex: 1,
          minWidth: 150,
          padding: '10px 16px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'orders' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'orders' ? 'var(--accent)' : 'var(--ink-soft)',
          boxShadow: viewMode === 'orders' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>📁</span>
        <span>Expedientes & OCs ({seguimientoOrdersCount})</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('collection')}
        style={{
          flex: 1,
          minWidth: 150,
          padding: '10px 16px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'collection' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'collection' ? '#0284c7' : 'var(--ink-soft)',
          boxShadow: viewMode === 'collection' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>📆</span>
        <span>Centro de Cobranza</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('production')}
        style={{
          flex: 1,
          minWidth: 150,
          padding: '10px 16px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'production' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'production' ? '#7c3aed' : 'var(--ink-soft)',
          boxShadow: viewMode === 'production' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>🏭</span>
        <span>Compras & {providerName || 'Andrés'}</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('pnl')}
        style={{
          flex: 1,
          minWidth: 150,
          padding: '10px 16px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'pnl' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'pnl' ? '#059669' : 'var(--ink-soft)',
          boxShadow: viewMode === 'pnl' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>⚖️</span>
        <span>Corte & P&L (50/50)</span>
      </button>

      <button
        type="button"
        onClick={() => setViewMode('all')}
        style={{
          flex: 1,
          minWidth: 110,
          padding: '10px 14px',
          borderRadius: 12,
          border: 'none',
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          background: viewMode === 'all' ? 'var(--paper-raised)' : 'transparent',
          color: viewMode === 'all' ? 'var(--ink)' : 'var(--ink-soft)',
          boxShadow: viewMode === 'all' ? '0 2px 10px rgba(0,0,0,0.08)' : 'none',
          transition: 'all 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        }}
      >
        <span>👁️</span>
        <span>Ver Todo</span>
      </button>
    </div>
  );
}
