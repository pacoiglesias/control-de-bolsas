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
        gap: 14,
        marginBottom: 20,
      }}
    >
      {/* 1. Ventas del Mes */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Ventas {monthFilter === 'ALL' ? 'Totales' : 'del Mes'}
          </span>
          <span style={{ fontSize: 14, opacity: 0.8 }}>📈</span>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 24, fontWeight: 900, color: 'var(--ink)', letterSpacing: '-0.5px', margin: '2px 0 6px' }}>
          <ResponsiveMoney value={k.ventasTotal || 0} />
        </div>
        <div className="tabular-nums kilo-val" style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{fmtKilos(k.kilosTotal || k.totalKilos || k.kilos || 0)} kg amparados</span>
        </div>
      </motion.div>

      {/* 2. Dinero en la calle (Por Cobrar) */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        onClick={() => nav('/cobranza')}
        style={{
          background: 'var(--paper-raised)',
          border: '1px solid var(--line-soft)',
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Cartera por Cobrar
          </span>
          <span style={{ fontSize: 14, opacity: 0.8 }}>🏦</span>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 24, fontWeight: 900, color: (k.porCobrar || k.dineroRealARecibir) > 0 ? '#d97706' : 'var(--ink)', letterSpacing: '-0.5px', margin: '2px 0 6px' }}>
          <ResponsiveMoney value={k.porCobrar || k.dineroRealARecibir || 0} />
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} />
          <span>{k.porCobrarSinCR > 0 ? 'Facturas + Contrarecibos' : 'Saldo activo'}</span>
        </div>
      </motion.div>

      {/* 3. Efectivo en Caja */}
      {!isViewer && (
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.15 }}
          onClick={() => nav('/caja-chica')}
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Efectivo en Caja
            </span>
            <span style={{ fontSize: 14, opacity: 0.8 }}>💵</span>
          </div>
          <div className="tabular-nums money-val" style={{ fontSize: 24, fontWeight: 900, color: 'var(--ok)', letterSpacing: '-0.5px', margin: '2px 0 6px' }}>
            <ResponsiveMoney value={saldoCaja} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ok)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />
            <span>Disponible en Tesorería</span>
          </div>
        </motion.div>
      )}

      {/* 4. Urgencias / Vencido */}
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        onClick={() => vencidos > 0 && nav('/cobranza')}
        style={{
          background: vencidos > 0 ? 'rgba(239, 68, 68, 0.06)' : 'var(--paper-raised)',
          border: `1px solid ${vencidos > 0 ? 'rgba(239, 68, 68, 0.3)' : 'var(--line-soft)'}`,
          borderRadius: 14,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          cursor: vencidos > 0 ? 'pointer' : 'default',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {vencidos > 0 ? 'Mora / Urgente' : 'Estado de Cartera'}
          </span>
          <span style={{ fontSize: 14, opacity: 0.8 }}>{vencidos > 0 ? '🚨' : '✨'}</span>
        </div>
        <div className="tabular-nums money-val" style={{ fontSize: 24, fontWeight: 900, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink)', letterSpacing: '-0.5px', margin: '2px 0 6px' }}>
          <ResponsiveMoney value={k.vencido || 0} />
        </div>
        <div style={{ fontSize: 12, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: vencidos > 0 ? 'var(--bad)' : '#10b981' }} />
          <span>{vencidos > 0 ? `${vencidos} CRs vencidos` : 'Al corriente sin atrasos'}</span>
        </div>
      </motion.div>
    </div>
  );
}
