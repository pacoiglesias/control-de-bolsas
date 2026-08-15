import { motion } from 'framer-motion';

interface QuickActionsBarProps {
  onOpenContrarecibos: () => void;
  onOpenSeguimiento: () => void;
  onNewOrder: () => void;
  onQuickInvoice: () => void;
  onQuickCollection: () => void;
  onQuickPay: () => void;
  role: string | null;
}

export function QuickActionsBar({ onOpenContrarecibos, onOpenSeguimiento, onNewOrder, onQuickInvoice, onQuickCollection, onQuickPay, role }: QuickActionsBarProps) {
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="quick-btn primary"
        onClick={onNewOrder}
      >
        <span className="icon">➕</span> Nuevo Expediente
      </motion.button>

        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="quick-btn outline"
          onClick={() => document.dispatchEvent(new CustomEvent('open-command-menu'))}
        >
          <span className="icon">🔍</span> Buscar (Cmd+K)
        </motion.button>

      {role !== 'viewer' && (
        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="quick-btn glass"
          onClick={onOpenContrarecibos}
        >
          <span className="icon">📆</span> Vencimientos (CR)
        </motion.button>
      )}

      {role === 'admin' && (
        <motion.a 
          href="/portal-maquilador"
          target="_blank"
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="quick-btn portal"
        >
          <span className="icon">🏭</span> Ver Portal Proveedor
        </motion.a>
      )}

      <motion.button 
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="btn"
        style={{ padding: '16px 24px', fontSize: 16, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass-bg)', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)' }}
        onClick={onOpenSeguimiento}
      >
        <span style={{ fontSize: 20 }}>📦</span> Seguimiento de Pedidos
      </motion.button>

      {role !== 'viewer' && (
        <>
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{ padding: '16px 24px', fontSize: 16, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper-sunk)', border: '1px solid var(--ok)', color: 'var(--ink)' }}
            onClick={onQuickInvoice}
          >
            <span style={{ fontSize: 20 }}>🧾</span> Facturar (Rápido)
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{ padding: '16px 24px', fontSize: 16, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper-sunk)', border: '1px solid var(--warn)', color: 'var(--ink)' }}
            onClick={onQuickCollection}
          >
            <span style={{ fontSize: 20 }}>🗂️</span> Capturar Contrarecibo
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="btn"
            style={{ padding: '16px 24px', fontSize: 16, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: '#fff' }}
            onClick={onQuickPay}
          >
            <span style={{ fontSize: 20 }}>💸</span> Registrar Cobro
          </motion.button>
        </>
      )}
    </div>
  );
}
