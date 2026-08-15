import { motion } from 'framer-motion';

interface QuickActionsBarProps {
  onOpenContrarecibos: () => void;
  onOpenSeguimiento: () => void;
  onNewOrder: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  onOpenCorteMensual?: () => void;
  role: string | null;
}

export function QuickActionsBar({
  onOpenContrarecibos,
  onOpenSeguimiento,
  onNewOrder,
  onQuickInvoice,
  onQuickCollection,
  onQuickPay,
  onOpenCorteMensual,
  role,
}: QuickActionsBarProps) {
  return (
    <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* ─── FILA 1: OPERACIONES CLAVE DE FLUJO ─────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft)', marginRight: 2 }}>
          ⚡ Operación:
        </span>

        {/* 1. Nuevo Expediente (Hero Principal) */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewOrder}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 12,
            padding: '9px 18px',
            fontSize: 13.5,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
          }}
        >
          <span style={{ fontSize: 16 }}>➕</span> Nuevo Expediente
        </motion.button>

        {role !== 'viewer' && (
          <>
            {/* 2. Facturar Rápido */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onQuickInvoice}
              style={{
                background: 'var(--paper-raised)',
                color: '#047857',
                border: '1px solid #10b981',
                borderRadius: 12,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: 16 }}>🧾</span> Facturar (Rápido)
            </motion.button>

            {/* 3. Capturar Contrarecibo */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onQuickCollection}
              style={{
                background: 'var(--paper-raised)',
                color: '#b45309',
                border: '1px solid #f59e0b',
                borderRadius: 12,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: 16 }}>🗂️</span> Capturar Contrarecibo
            </motion.button>

            {/* 4. Registrar Cobro */}
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onQuickPay}
              style={{
                background: 'var(--paper-raised)',
                color: '#0d9488',
                border: '1px solid #14b8a6',
                borderRadius: 12,
                padding: '9px 16px',
                fontSize: 13.5,
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <span style={{ fontSize: 16 }}>💸</span> Registrar Cobro
            </motion.button>
          </>
        )}
      </div>

      {/* ─── FILA 2: CONTROL, SEGUIMIENTO Y HERRAMIENTAS ───────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ink-soft)', marginRight: 2 }}>
          🛠️ Control:
        </span>

        {/* 5. Corte Mensual Contable */}
        {onOpenCorteMensual && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCorteMensual}
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(37,99,235,0.15) 100%)',
              color: '#1d4ed8',
              border: '1px solid #3b82f6',
              borderRadius: 12,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15 }}>📑</span> Corte Mensual
          </motion.button>
        )}

        {/* 6. Vencimientos Contrarecibos */}
        {role !== 'viewer' && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenContrarecibos}
            style={{
              background: 'var(--paper-raised)',
              color: 'var(--ink)',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15 }}>📆</span> Vencimientos (CR)
          </motion.button>
        )}

        {/* 7. Seguimiento de Pedidos */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onOpenSeguimiento}
          style={{
            background: 'var(--paper-raised)',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '8px 15px',
            fontSize: 13,
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 15 }}>📦</span> Seguimiento OCs
        </motion.button>

        {/* 8. Portal Maquilador */}
        {role === 'admin' && (
          <motion.a
            href="/portal-maquilador"
            target="_blank"
            rel="noreferrer"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            style={{
              background: 'var(--paper-sunk)',
              color: 'var(--ink)',
              border: '1px solid var(--line-soft)',
              borderRadius: 12,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 15 }}>🏭</span> Portal Andrés
          </motion.a>
        )}

        {/* 9. Buscar Cmd+K */}
        <motion.button
          whileHover={{ scale: 1.02, y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => document.dispatchEvent(new CustomEvent('open-command-menu'))}
          style={{
            background: 'transparent',
            color: 'var(--ink-soft)',
            border: '1px dashed var(--line)',
            borderRadius: 12,
            padding: '8px 14px',
            fontSize: 12.5,
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          <span style={{ fontSize: 14 }}>🔍</span> Buscar <kbd style={{ fontSize: 10, background: 'var(--paper-sunk)', padding: '1px 5px', borderRadius: 4 }}>Ctrl+K</kbd>
        </motion.button>
      </div>
    </div>
  );
}
