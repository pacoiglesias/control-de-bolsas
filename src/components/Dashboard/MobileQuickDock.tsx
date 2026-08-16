import { motion } from 'framer-motion';

interface MobileQuickDockProps {
  onNewOrder: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  onMagicPaste: () => void;
  onOpenCalculator: () => void;
}

export function MobileQuickDock({
  onNewOrder,
  onQuickInvoice,
  onQuickCollection,
  onQuickPay,
  onMagicPaste,
  onOpenCalculator,
}: MobileQuickDockProps) {
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
        onClick={onNewOrder}
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
        }}
        title="Crear Nueva Orden de Compra"
      >
        <span style={{ fontSize: 18 }}>➕</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Nueva OC</span>
      </motion.button>

      {/* 2. Facturar Rápido */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onQuickInvoice}
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
        }}
        title="Facturar Entregas de Providencia"
      >
        <span style={{ fontSize: 18 }}>📝</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Facturar</span>
      </motion.button>

      {/* 3. Cobro Rápido (Destacado Central) */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onQuickCollection}
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
        }}
        title="Registrar Cobranza y Contrarecibos"
      >
        <span style={{ fontSize: 18 }}>💸</span>
        <span style={{ fontSize: 10, fontWeight: 900 }}>Cobrar</span>
      </motion.button>

      {/* 4. Pagar Andrés */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onQuickPay}
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
        }}
        title="Registrar Pago o Abono a Andrés"
      >
        <span style={{ fontSize: 18 }}>💳</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Pagar</span>
      </motion.button>

      {/* 5. Pegar OC Copiada */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onMagicPaste}
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
        }}
        title="Pegar Texto de Orden Automáticamente"
      >
        <span style={{ fontSize: 18 }}>📋</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Pegar OC</span>
      </motion.button>

      {/* 6. Calculadora de Kilos */}
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onOpenCalculator}
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
        }}
        title="Abrir Calculadora de Kilos y Bultos"
      >
        <span style={{ fontSize: 18 }}>⚖️</span>
        <span style={{ fontSize: 10, fontWeight: 700 }}>Calc</span>
      </motion.button>
    </div>
  );
}

