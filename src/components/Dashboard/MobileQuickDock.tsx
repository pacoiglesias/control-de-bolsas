import { motion } from 'framer-motion';

interface MobileQuickDockProps {
  urgentCount: number;
  onOpenRadar: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onMagicPaste: () => void;
  onOpenCalculator: () => void;
}

export function MobileQuickDock({
  urgentCount,
  onOpenRadar,
  onQuickInvoice,
  onQuickCollection,
  onMagicPaste,
  onOpenCalculator,
}: MobileQuickDockProps) {
  return (
    <div
      className="mobile-quick-dock"
      role="toolbar"
      aria-label="Barra de Acciones Rápidas Móvil"
      style={{
        position: 'fixed',
        bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 24px)',
        maxWidth: 460,
        background: 'var(--glass-bg, rgba(20, 24, 33, 0.85))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border, rgba(255, 255, 255, 0.15))',
        borderRadius: 24,
        padding: '8px 12px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        zIndex: 990,
      }}
    >
      {/* 1. Radar de Acciones */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onOpenRadar}
        type="button"
        style={{
          background: urgentCount > 0 ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
          border: urgentCount > 0 ? '1px solid rgba(239, 68, 68, 0.4)' : 'none',
          borderRadius: 16,
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: urgentCount > 0 ? '#ef4444' : 'var(--ink)',
          cursor: 'pointer',
          position: 'relative',
          minWidth: 54,
        }}
      >
        <span style={{ fontSize: 20 }}>⚡</span>
        <span style={{ fontSize: 10, fontWeight: 800 }}>Radar</span>
        {urgentCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -2,
              background: '#ef4444',
              color: '#fff',
              fontSize: 10,
              fontWeight: 900,
              borderRadius: 999,
              padding: '1px 6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            }}
          >
            {urgentCount}
          </span>
        )}
      </motion.button>

      {/* 2. Facturar Rápido */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onQuickInvoice}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 16,
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 54,
        }}
      >
        <span style={{ fontSize: 20 }}>📝</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Facturar</span>
      </motion.button>

      {/* 3. Cobro Rápido (Central Highlight) */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onQuickCollection}
        type="button"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: 'none',
          borderRadius: 18,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          minWidth: 60,
        }}
      >
        <span style={{ fontSize: 20 }}>💸</span>
        <span style={{ fontSize: 10, fontWeight: 900 }}>Cobrar</span>
      </motion.button>

      {/* 4. Pegado Mágico WhatsApp */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onMagicPaste}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 16,
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 54,
        }}
      >
        <span style={{ fontSize: 20 }}>📋</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>WhatsApp</span>
      </motion.button>

      {/* 5. Calculadora Flotante */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onOpenCalculator}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 16,
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 54,
        }}
      >
        <span style={{ fontSize: 20 }}>⚖️</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Calc</span>
      </motion.button>
    </div>
  );
}
