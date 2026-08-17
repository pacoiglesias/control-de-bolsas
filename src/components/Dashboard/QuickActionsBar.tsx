import { motion } from 'framer-motion';
import { exportTotalBusinessBackupExcel } from '../../lib/export';

interface QuickActionsBarProps {
  onOpenContrarecibos: () => void;
  onOpenSeguimiento: () => void;
  onNewOrder: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  onOpenMagicPaste?: () => void;
  onOpenCorteMensual?: () => void;
  onOpenCorteSemanal?: () => void;
  onRecalc?: () => void;
  recalcBusy?: boolean;
  role: string | null;
}

export function QuickActionsBar({
  onOpenContrarecibos,
  onOpenSeguimiento,
  onNewOrder,
  onQuickInvoice,
  onQuickCollection,
  onQuickPay,
  onOpenMagicPaste,
  onOpenCorteMensual,
  onOpenCorteSemanal,
  onRecalc,
  recalcBusy,
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

            {/* 4.5 Pegado Mágico WhatsApp */}
            {onOpenMagicPaste && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={onOpenMagicPaste}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)',
                  color: '#047857',
                  border: '1px solid #10b981',
                  borderRadius: 12,
                  padding: '9px 16px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span style={{ fontSize: 16 }}>🪄</span> Pegar WhatsApp
              </motion.button>
            )}
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

        {/* Corte Semanal (Semana a Semana) */}
        {onOpenCorteSemanal && role === 'admin' && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenCorteSemanal}
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(5,150,105,0.15) 100%)',
              color: '#047857',
              border: '1px solid #10b981',
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
            <span style={{ fontSize: 15 }}>📅</span> Corte Semanal
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

        {/* 9. Botón Recalcular / Sincronizar */}
        {onRecalc && role === 'admin' && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRecalc}
            disabled={recalcBusy}
            title="Recalcular sumas, IVA y métricas del Dashboard desde el servidor"
            style={{
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#2563eb',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: 12,
              padding: '8px 15px',
              fontSize: 13,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              cursor: recalcBusy ? 'default' : 'pointer',
              opacity: recalcBusy ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: 15 }}>{recalcBusy ? '⏳' : '🔄'}</span>
            {recalcBusy ? 'Recalculando…' : 'Recalcular'}
          </motion.button>
        )}

        {/* 10. Respaldo Total a Excel */}
        {role === 'admin' && (
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => exportTotalBusinessBackupExcel()}
            title="Descargar libro Excel offline con órdenes, facturas, compras y flujo de caja"
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.2) 100%)',
              color: '#059669',
              border: '1px solid #10b981',
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
            <span style={{ fontSize: 15 }}>📥</span> Respaldo Total Excel
          </motion.button>
        )}

        {/* 10. Buscar Cmd+K */}
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
