import { motion } from 'framer-motion';
import { ResponsiveMoney } from '../ui';
import { kilos as fmtKilos } from '../../lib/format';
import { Sparkline } from './Sparkline';

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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1 }}>
          Ventas {monthFilter === 'ALL' ? 'Totales' : 'del Mes'}
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink)', margin: '8px 0', letterSpacing: '-1px', zIndex: 1 }}>
          <ResponsiveMoney value={k.ventasTotal || 0} />
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 20, right: 20, opacity: 0.3, zIndex: 0 }}>
          <Sparkline data={[120, 150, 130, 180, 140, 200, 170]} width={240} height={40} color="var(--accent)" />
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
          📦 Kilos amparados: {fmtKilos(k.kilosTotal || k.totalKilos || k.kilos || 0)} kg
        </div>
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
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1 }}>
          Dinero en la Calle
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: (k.porCobrar || k.dineroRealARecibir) > 0 ? 'var(--warn)' : 'var(--ink)', margin: '8px 0', letterSpacing: '-1px', zIndex: 1 }}>
          <ResponsiveMoney value={k.porCobrar || k.dineroRealARecibir || 0} />
        </div>
        <div style={{ position: 'absolute', bottom: 10, left: 20, right: 20, opacity: 0.2, zIndex: 0 }}>
          <Sparkline data={[200, 180, 190, 150, 160, 130, 120]} width={240} height={40} color="var(--warn)" />
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500, zIndex: 1 }}>
          {k.porCobrarSinCR > 0 ? `Facturas + CR + Por Facturar` : 'Saldo neto esperado'}
        </div>
      </motion.div>

      {/* 3. Efectivo en Caja */}
      {!isViewer && (
        <motion.div 
          whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(16,185,129,0.25)' }}
          transition={{ type: 'spring', stiffness: 300 }}
          onClick={() => nav('/caja-chica')}
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(5,150,105,0.2) 100%)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(16,185,129,0.35)',
            borderRadius: 20,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden',
            cursor: 'pointer'
          }}
        >
          <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08, filter: 'grayscale(1)' }}>💵</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ok)', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1 }}>
            Efectivo en Caja
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--ok)', margin: '8px 0', letterSpacing: '-1px', zIndex: 1 }}>
            <ResponsiveMoney value={saldoCaja} />
          </div>
          <div style={{ position: 'absolute', bottom: 10, left: 20, right: 20, opacity: 0.35, zIndex: 0 }}>
            <Sparkline data={[50, 60, 55, 70, 80, 75, 90]} width={240} height={40} color="var(--ok)" />
          </div>
          <div style={{ fontSize: 13, color: 'var(--ok)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, zIndex: 1 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--ok)' }} />
            Efectivo disponible en mano
          </div>
        </motion.div>
      )}

      {/* 4. Urgencias / Vencido */}
      <motion.div 
        whileHover={{ y: -4, boxShadow: '0 20px 40px -10px rgba(239,68,68,0.25)' }}
        transition={{ type: 'spring', stiffness: 300 }}
        onClick={() => vencidos > 0 && nav('/cobranza')}
        style={{
          background: vencidos > 0 ? 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(220,38,38,0.18) 100%)' : 'var(--glass-bg)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${vencidos > 0 ? 'rgba(239,68,68,0.35)' : 'var(--glass-border)'}`,
          borderRadius: 20,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          cursor: vencidos > 0 ? 'pointer' : 'default'
        }}
      >
        <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 80, opacity: 0.08, filter: vencidos === 0 ? 'grayscale(1)' : 'none' }}>⚠️</div>
        <div style={{ fontSize: 12, fontWeight: 800, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '1px', zIndex: 1 }}>
          Urgencias (Vencido)
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink)', margin: '8px 0', letterSpacing: '-1px', zIndex: 1 }}>
          <ResponsiveMoney value={k.vencido || 0} />
        </div>
        <div style={{ fontSize: 13, color: vencidos > 0 ? 'var(--bad)' : 'var(--ink-soft)', fontWeight: 700, zIndex: 1 }}>
          {vencidos} factura{vencidos === 1 ? '' : 's'} fuera de fecha
        </div>
      </motion.div>
      
    </div>
  );
}
