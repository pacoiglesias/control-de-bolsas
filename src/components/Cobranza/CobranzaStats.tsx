import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { money } from '../../lib/format';
import { motion } from 'framer-motion';

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
          background: 'var(--card-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
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
          {money(data.meDeben)}
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
          background: isOverdueAlert ? 'rgba(239, 68, 68, 0.06)' : 'var(--card-bg, var(--paper))',
          border: isOverdueAlert ? '1.5px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
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
            <span style={{ fontSize: 10.5, background: 'var(--bad)', color: '#fff', padding: '2px 8px', borderRadius: 12, fontWeight: 800 }}>
              ¡Atención!
            </span>
          ) : (
            <span style={{ fontSize: 10.5, background: 'var(--ok-bg)', color: 'var(--ok)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
              Al corriente
            </span>
          )}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: isOverdueAlert ? 'var(--bad)' : 'var(--ink)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          {money(data.vencido)}
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
          background: 'var(--card-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cobro a 7 Días
          </span>
          <span style={{ fontSize: 11, background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            Proyección
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#2563eb', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          {money(data.proyeccion7d)}
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
          background: 'var(--card-bg, var(--paper))',
          border: '1px solid var(--card-border, var(--line))',
          borderRadius: 14,
          padding: '14px 18px',
          boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Recaudado / En Caja
          </span>
          <span style={{ fontSize: 11, background: 'var(--ok-bg)', color: 'var(--ok)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
            {data.paid.length + data.collected.length} cobros
          </span>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--ok)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>
          {money(data.cobrado)}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>
          Comisiones: {money(data.comisiones)}
        </div>
      </motion.div>
    </div>
  );
}