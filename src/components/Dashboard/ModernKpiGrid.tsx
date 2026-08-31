import { motion } from 'framer-motion';
import { ResponsiveMoney } from '../ui';
import { kilos as fmtKilos } from '../../lib/format';

interface ModernKpiGridProps {
  k: any;
  role: string | null;
  saldoCaja: number;
  config: any;
  monthFilter: string;
  nav: (path: string) => void;
  contrarecibosVencidosCount?: number;
}

export function ModernKpiGrid({ k, role, saldoCaja, monthFilter, nav, contrarecibosVencidosCount }: ModernKpiGridProps) {
  const isViewer = role === 'viewer';
  const vencidos = contrarecibosVencidosCount ?? k.overdue?.length ?? 0;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {/* 1. Ventas del Mes */}
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
            Ventas {monthFilter === 'ALL' ? 'Totales' : 'del Mes'}
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            📈
          </div>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.6px', margin: '2px 0 8px' }}>
          <ResponsiveMoney value={k.ventasTotal || 0} />
        </div>
        <div className="tabular-nums kilo-val" style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{fmtKilos(k.kilosTotal || k.totalKilos || k.kilos || 0)} kg amparados</span>
        </div>
      </motion.div>

      {/* 2. Dinero en la calle (Por Cobrar) */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => nav('/cobranza')}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #d97706, #fbbf24)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Cartera por Cobrar
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(217, 119, 6, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            🏦
          </div>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 26, fontWeight: 900, color: (k.porCobrar || k.dineroRealARecibir) > 0 ? '#d97706' : 'var(--ink)', letterSpacing: '-0.6px', margin: '2px 0 8px' }}>
          <ResponsiveMoney value={k.porCobrar || k.dineroRealARecibir || 0} />
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d97706' }} />
          <span>{k.porCobrarSinCR > 0 ? 'Facturas + Contrarecibos' : 'Saldo activo'}</span>
        </div>
      </motion.div>

      {/* 3. Efectivo en Caja */}
      {!isViewer && (
        <motion.div
          whileHover={{ y: -3, scale: 1.01 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={() => nav('/caja-chica')}
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line-soft)',
            borderRadius: 16,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #059669, #34d399)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Efectivo en Caja
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(5, 150, 105, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
              💵
            </div>
          </div>
          <div className="tabular-nums money-val" style={{ fontSize: 26, fontWeight: 900, color: 'var(--ok)', letterSpacing: '-0.6px', margin: '2px 0 8px' }}>
            <ResponsiveMoney value={saldoCaja} />
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--ok)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok)' }} />
            <span>Disponible en Tesorería</span>
          </div>
        </motion.div>
      )}

      {/* 4. Urgencias / Vencido */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => vencidos > 0 && nav('/cobranza')}
        style={{
          background: vencidos > 0 ? 'rgba(239, 68, 68, 0.06)' : 'var(--paper-raised)',
          border: `1px solid ${vencidos > 0 ? 'rgba(239, 68, 68, 0.35)' : 'var(--line-soft)'}`,
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          cursor: vencidos > 0 ? 'pointer' : 'default',
          boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: vencidos > 0 ? 'linear-gradient(90deg, #ef4444, #f87171)' : 'linear-gradient(90deg, #10b981, #34d399)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            {vencidos > 0 ? 'Mora / Urgente' : 'Estado de Cartera'}
          </span>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: vencidos > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
            {vencidos > 0 ? '🚨' : '✨'}
          </div>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 26, fontWeight: 900, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink)', letterSpacing: '-0.6px', margin: '2px 0 8px' }}>
          <ResponsiveMoney value={k.vencido || 0} />
        </div>
        <div style={{ fontSize: 12.5, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: vencidos > 0 ? 'var(--bad)' : '#10b981' }} />
          <span>{vencidos > 0 ? `${vencidos} CRs vencidos` : 'Al corriente sin atrasos'}</span>
        </div>
      </motion.div>
    </div>
  );
}
