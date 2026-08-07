import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SpeedDial({
  onNewOrder,
  onManualSale,
  onNewExpense,
  onFastEntry
}: {
  onNewOrder: () => void;
  onManualSale: () => void;
  onNewExpense: () => void;
  onFastEntry: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 16 }}>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-end' }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setOpen(false); onNewExpense(); }}
              className="speed-dial-action"
              style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
            >
              <span>💸 Gasto de Caja Chica</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setOpen(false); onFastEntry(); }}
              className="speed-dial-action"
              style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--ok)', padding: '10px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ok)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
            >
              <span>⚡ Pegar Facturas / Pagos</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setOpen(false); onManualSale(); }}
              className="speed-dial-action"
              style={{ background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--glass-border)', padding: '10px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ink)', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 600 }}
            >
              <span>🛒 Venta Manual</span>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setOpen(false); onNewOrder(); }}
              className="speed-dial-action"
              style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '10px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', fontWeight: 600 }}
            >
              <span>📄 Expediente Manual</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(!open)}
        style={{
          width: 60, height: 60, borderRadius: 30,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28,
        }}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          +
        </motion.div>
      </motion.button>
    </div>
  );
}
