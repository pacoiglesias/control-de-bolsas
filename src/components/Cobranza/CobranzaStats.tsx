import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { money } from '../../lib/format';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '../ui/AnimatedNumber';

export default function CobranzaStats() {
  const ctx = useContext(CobranzaContext);
  if (!ctx || !ctx.data) return null;

  const { data } = ctx;
  const isOverdueAlert = (data.vencido || 0) > 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
        marginBottom: 20,
      }}
    >
      {/* 1. Total por Cobrar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Total por Cobrar
          </span>
          <span style={{ fontSize: 11, background: 'var(--paper-sunk)', color: 'var(--ink-soft)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            {data.open.length} {data.open.length === 1 ? 'factura' : 'facturas'}
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          <AnimatedNumber value={data.meDeben} format="money" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
          En crédito a Providencia
        </div>
      </motion.div>

      {/* 2. Cartera Vencida */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        style={{
          background: isOverdueAlert ? 'var(--bad-bg)' : 'var(--paper-raised)',
          border: isOverdueAlert ? '1.5px solid rgba(225, 29, 72, 0.35)' : '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          boxShadow: isOverdueAlert ? '0 0 20px rgba(225, 29, 72, 0.15)' : 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: isOverdueAlert ? 'var(--bad)' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cartera Vencida
          </span>
          {isOverdueAlert ? (
            <span className="badge b-bad" style={{ fontSize: 10.5, fontWeight: 800 }}>
              ¡Atención!
            </span>
          ) : (
            <span className="badge b-ok" style={{ fontSize: 10.5, fontWeight: 700 }}>
              Al corriente
            </span>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: isOverdueAlert ? 'var(--bad)' : 'var(--ink)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          <AnimatedNumber value={data.vencido} format="money" />
        </div>
        <div style={{ fontSize: 11.5, color: isOverdueAlert ? 'var(--bad)' : 'var(--ink-soft)' }}>
          {isOverdueAlert ? 'Plazo vencido según CR' : '0 facturas en mora'}
        </div>
      </motion.div>

      {/* 3. Proyección Próxima (7 a 15 Días) */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cobro a 7 Días
          </span>
          <span className="badge b-info" style={{ fontSize: 10.5, fontWeight: 700 }}>
            Proyección
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--info)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          <AnimatedNumber value={data.proyeccion7d} format="money" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
          A 15 días: <strong>{money(data.proyeccion15d)}</strong>
        </div>
      </motion.div>

      {/* 4. Total Cobrado / Liquidado */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 'var(--radius)',
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recaudado / En Caja
          </span>
          <span className="badge b-ok" style={{ fontSize: 10.5, fontWeight: 700 }}>
            {data.paid.length + data.collected.length} cobros
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ok)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          <AnimatedNumber value={data.cobrado} format="money" />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
          Comisiones: {money(data.comisiones)}
        </div>
      </motion.div>
    </div>
  );
}