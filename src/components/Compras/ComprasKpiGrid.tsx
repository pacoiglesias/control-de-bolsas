import { motion } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export function ComprasKpiGrid({
  totalReceivedKilos,
  saldoProveedor,
  entregasAtrasadasCount,
  onPayAtrasadas,
  onPayDebt
}: {
  totalReceivedKilos: number;
  saldoProveedor: number;
  entregasAtrasadasCount: number;
  onPayAtrasadas: () => void;
  onPayDebt: (amount: number) => void;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}
    >
      {/* 1. Kilos Recibidos */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Kilos Recibidos (Báscula)
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            🚚
          </div>
        </div>
        <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.8px', margin: '4px 0 6px' }}>
          <AnimatedNumber value={totalReceivedKilos} format="kilos" />
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-soft)' }}>
          Total histórico de mercancía ingresada por Andrés en planta.
        </p>
        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="btn" 
          style={{
            width: '100%',
            marginTop: 'auto',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line)',
            color: 'var(--ink)',
            fontWeight: 700,
            borderRadius: 10,
            fontSize: 12.5,
          }} 
          onClick={onPayAtrasadas}
        >
          📦 Registrar Llegada de Material
        </motion.button>
      </motion.div>

      {/* 2. Estado de Cuenta */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: saldoProveedor < 0 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #059669, #34d399)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: saldoProveedor < 0 ? 'var(--bad)' : 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Estado de Cuenta Andrés
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: saldoProveedor < 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            ⚖️
          </div>
        </div>
        <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: saldoProveedor < 0 ? 'var(--bad)' : saldoProveedor > 0 ? 'var(--ok)' : 'var(--ink)', letterSpacing: '-0.8px', margin: '4px 0 6px' }}>
          {saldoProveedor < 0 ? '-' : '+'}<AnimatedNumber value={Math.abs(saldoProveedor)} format="money" />
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-soft)' }}>
          {saldoProveedor < 0 ? 'Pasivo / Deuda actual pendiente con Andrés.' : saldoProveedor > 0 ? 'Saldo a favor de la empresa (Anticipos).' : 'Cuenta saldada en ceros.'}
        </p>
        <motion.button 
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className="btn btn-primary" 
          style={{ 
            width: '100%', 
            marginTop: 'auto',
            minHeight: 44,
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center', 
            gap: 6,
            background: saldoProveedor < 0 ? '#dc2626' : '#059669', 
            borderColor: saldoProveedor < 0 ? '#b91c1c' : '#047857', 
            color: '#fff', 
            fontWeight: 800,
            borderRadius: 10,
            fontSize: 12.5,
          }} 
          onClick={() => onPayDebt(saldoProveedor < 0 ? Math.abs(saldoProveedor) : 0)}
        >
          {saldoProveedor < 0 ? '💸 Liquidar Deuda en Caja' : '💰 Abonar Anticipo'}
        </motion.button>
      </motion.div>

      {/* 3. Entregas Atrasadas */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{
          background: entregasAtrasadasCount > 0 ? 'rgba(245, 158, 11, 0.05)' : 'var(--paper-raised)',
          border: `1px solid ${entregasAtrasadasCount > 0 ? 'rgba(245, 158, 11, 0.35)' : 'var(--line-soft)'}`,
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: entregasAtrasadasCount > 0 ? 'linear-gradient(90deg, #d97706, #fbbf24)' : 'linear-gradient(90deg, #10b981, #34d399)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: entregasAtrasadasCount > 0 ? 'var(--warn)' : 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Entregas Atrasadas
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: entregasAtrasadasCount > 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {entregasAtrasadasCount > 0 ? '⚠️' : '✨'}
          </div>
        </div>
        <div className="tabular-nums" style={{ fontSize: 30, fontWeight: 900, color: entregasAtrasadasCount > 0 ? 'var(--warn)' : 'var(--ok)', letterSpacing: '-0.8px', margin: '4px 0 6px' }}>
          <AnimatedNumber value={entregasAtrasadasCount} format="number" decimals={0} />
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'var(--ink-soft)' }}>
          {entregasAtrasadasCount > 0 ? `${entregasAtrasadasCount} OCs pasaron su fecha estimada de entrega.` : 'Todas las entregas de Andrés al corriente.'}
        </p>
        <motion.button 
          whileHover={entregasAtrasadasCount > 0 ? { scale: 1.01 } : {}}
          whileTap={entregasAtrasadasCount > 0 ? { scale: 0.98 } : {}}
          className="btn" 
          style={{ 
            width: '100%', 
            marginTop: 'auto',
            minHeight: 44,
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'center', 
            gap: 6,
            background: entregasAtrasadasCount > 0 ? 'rgba(217, 119, 6, 0.12)' : 'var(--paper-sunk)', 
            borderColor: entregasAtrasadasCount > 0 ? '#d97706' : 'var(--line)', 
            color: entregasAtrasadasCount > 0 ? '#d97706' : 'var(--ink-soft)', 
            fontWeight: 700,
            borderRadius: 10,
            fontSize: 12.5,
            cursor: entregasAtrasadasCount > 0 ? 'pointer' : 'default',
            opacity: entregasAtrasadasCount > 0 ? 1 : 0.7
          }} 
          disabled={entregasAtrasadasCount <= 0}
          onClick={onPayAtrasadas}
        >
          {entregasAtrasadasCount > 0 ? '🔍 Ver Órdenes Atrasadas' : '✨ Todo al Corriente'}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}
