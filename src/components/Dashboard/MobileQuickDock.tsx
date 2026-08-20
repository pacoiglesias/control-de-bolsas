import { motion } from 'framer-motion';

interface MobileQuickDockProps {
  onNewOrder: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  onMagicPaste: () => void;
  onOpenCalculator: () => void;
  pendingInvoicesCount?: number;
  pendingCollectionsCount?: number;
}

export function MobileQuickDock({
  onNewOrder,
  onQuickInvoice,
  onQuickCollection,
  onQuickPay,
  onMagicPaste,
  onOpenCalculator,
  pendingInvoicesCount = 0,
  pendingCollectionsCount = 0,
}: MobileQuickDockProps) {
  const triggerHaptic = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch { /* vibrate puede fallar en algunos browsers — ignorar silenciosamente */ }
    }
  };

  return (
    <div
      className="mobile-quick-dock"
      role="toolbar"
      aria-label="Barra de Acciones Locales Móvil"
      style={{
        position: 'fixed',
        bottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 20px)',
        maxWidth: 520,
        background: 'var(--paper-raised, rgba(15, 23, 42, 0.95))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--line, rgba(255, 255, 255, 0.15))',
        borderRadius: 24,
        padding: '6px 10px',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxShadow: '0 12px 36px rgba(0,0,0,0.35)',
        zIndex: 990,
      }}
    >
      {/* 1. Nueva Orden */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onNewOrder();
        }}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 14,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 48,
          position: 'relative',
        }}
        title="Crear Nueva Orden de Compra"
      >
        <span style={{ fontSize: 18 }}>➕</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Nueva OC</span>
      </motion.button>

      {/* 2. Facturar Rápido con Badge */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onQuickInvoice();
        }}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 14,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 48,
          position: 'relative',
        }}
        title="Facturar Entregas de Providencia"
      >
        {pendingInvoicesCount > 0 && (
          <span 
            style={{
              position: 'absolute',
              top: 2,
              right: 6,
              background: '#ef4444',
              color: '#ffffff',
              borderRadius: 999,
              fontSize: 9.5,
              fontWeight: 900,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 6px rgba(239, 68, 68, 0.5)',
            }}
          >
            {pendingInvoicesCount}
          </span>
        )}
        <span style={{ fontSize: 18 }}>📝</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Facturar</span>
      </motion.button>

      {/* 3. Cobro Rápido (Destacado Central) con Badge */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onQuickCollection();
        }}
        type="button"
        style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          border: 'none',
          borderRadius: 16,
          padding: '7px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: '#ffffff',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
          minWidth: 54,
          position: 'relative',
        }}
        title="Registrar Cobranza y Contrarecibos"
      >
        {pendingCollectionsCount > 0 && (
          <span 
            style={{
              position: 'absolute',
              top: -4,
              right: -2,
              background: '#f59e0b',
              color: '#ffffff',
              borderRadius: 999,
              fontSize: 9.5,
              fontWeight: 900,
              minWidth: 16,
              height: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              boxShadow: '0 2px 6px rgba(245, 158, 11, 0.6)',
              border: '2px solid var(--paper-raised)',
            }}
          >
            {pendingCollectionsCount}
          </span>
        )}
        <span style={{ fontSize: 18 }}>💸</span>
        <span style={{ fontSize: 10, fontWeight: 900 }}>Cobrar</span>
      </motion.button>

      {/* 4. Pagar Andrés */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onQuickPay();
        }}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 14,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 48,
          position: 'relative',
        }}
        title="Registrar Pago o Abono a Andrés"
      >
        <span style={{ fontSize: 18 }}>💳</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Pagar</span>
      </motion.button>

      {/* 5. Pegar OC Copiada */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onMagicPaste();
        }}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 14,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 48,
          position: 'relative',
        }}
        title="Pegar Texto de Orden Automáticamente"
      >
        <span style={{ fontSize: 18 }}>📋</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Pegar OC</span>
      </motion.button>

      {/* 6. Calculadora de Kilos */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => {
          triggerHaptic();
          onOpenCalculator();
        }}
        type="button"
        style={{
          background: 'transparent',
          border: 'none',
          borderRadius: 14,
          padding: '6px 8px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          color: 'var(--ink)',
          cursor: 'pointer',
          minWidth: 48,
          position: 'relative',
        }}
        title="Abrir Calculadora de Kilos y Bultos"
      >
        <span style={{ fontSize: 18 }}>⚖️</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Calc</span>
      </motion.button>
    </div>
  );
}
