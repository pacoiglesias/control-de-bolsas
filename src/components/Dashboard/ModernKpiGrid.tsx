import { motion } from 'framer-motion';
import { ResponsiveMoney } from '../ui';
import { money } from '../../lib/format';

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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
      
      {/* 1. Ventas del Mes */}
      <motion.div 
        whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
        transition={{ type: 'spring', stiffness: 300 }}
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.05, filter: 'grayscale(1)' }}>📈</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Ventas {monthFilter === 'ALL' ? 'Totales' : 'del Mes'}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink)', margin: '8px 0', letterSpacing: '-1px' }}>
          <ResponsiveMoney value={k.ventasTotal || 0} />
        </div>
        {!isViewer && (
          <div style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} />
            Utilidad Bruta: {money(k.margenTotal || 0)}
          </div>
        )}
      </motion.div>

      {/* 2. Dinero en la calle (Por Cobrar) */}
      <motion.div 
        whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)' }}
        transition={{ type: 'spring', stiffness: 300 }}
        onClick={() => nav('/cobranza')}
        style={{
          background: 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          cursor: 'pointer'
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.05, filter: 'grayscale(1)' }}>🏦</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Dinero en la Calle
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: k.porCobrar > 0 ? 'var(--warn)' : 'var(--ink)', margin: '8px 0', letterSpacing: '-1px' }}>
          <ResponsiveMoney value={k.dineroRealARecibir || k.porCobrar || 0} />
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
          {k.porCobrarSinCR > 0 ? `Facturas + CR + Por Facturar` : 'Saldo neto esperado'}
        </div>
      </motion.div>

      {/* 3. Caja Chica */}
      {!isViewer && (
        <motion.div 
          whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(16,185,129,0.2)' }}
          transition={{ type: 'spring', stiffness: 300 }}
          onClick={() => nav('/caja-chica')}
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(4,120,87,0.15) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 20,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.1, filter: 'grayscale(1)' }}>💵</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#047857', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Caja Chica (Líquido)
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#064e3b', margin: '8px 0', letterSpacing: '-1px' }}>
            <ResponsiveMoney value={saldoCaja} />
          </div>
          <div style={{ fontSize: 13, color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            Efectivo real en mano
          </div>
        </motion.div>
      )}

      {/* 4. Urgencias / Vencido */}
      <motion.div 
        whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(239,68,68,0.2)' }}
        transition={{ type: 'spring', stiffness: 300 }}
        onClick={() => vencidos > 0 && nav('/cobranza')}
        style={{
          background: vencidos > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.15) 100%)' : 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${vencidos > 0 ? 'rgba(239,68,68,0.3)' : 'var(--glass-border)'}`,
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          cursor: vencidos > 0 ? 'pointer' : 'default'
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.1, filter: vencidos === 0 ? 'grayscale(1)' : 'none' }}>⚠️</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: vencidos > 0 ? '#b91c1c' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Urgencias (Vencido)
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: vencidos > 0 ? '#7f1d1d' : 'var(--ink)', margin: '8px 0', letterSpacing: '-1px' }}>
          <ResponsiveMoney value={k.vencido || 0} />
        </div>
        <div style={{ fontSize: 13, color: vencidos > 0 ? '#b91c1c' : 'var(--ink-soft)', fontWeight: 600 }}>
          {vencidos} factura{vencidos === 1 ? '' : 's'} fuera de fecha
        </div>
      </motion.div>
      
    </div>
  );
}
