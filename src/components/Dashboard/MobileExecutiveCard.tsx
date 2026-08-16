import { motion } from 'framer-motion';
import { kilos as fmtKilos } from '../../lib/format';
import { ResponsiveMoney } from '../ui';

interface MobileExecutiveCardProps {
  saldoCaja: number;
  porCobrarTotal: number;
  contrarecibosVencidos: number;
  kilosMesTotal: number;
  kilosMeta?: number;
  activeUrgentCount: number;
  onSelectTab: (tab: string) => void;
}

export function MobileExecutiveCard({
  saldoCaja,
  porCobrarTotal,
  contrarecibosVencidos,
  kilosMesTotal,
  kilosMeta = 40000,
  activeUrgentCount,
  onSelectTab,
}: MobileExecutiveCardProps) {
  const pctMeta = kilosMeta > 0 ? Math.min(100, Math.round((kilosMesTotal / kilosMeta) * 100)) : 0;

  return (
    <div
      role="region"
      aria-label="Resumen Ejecutivo Móvil"
      style={{
        background: 'linear-gradient(145deg, var(--paper-raised, #ffffff) 0%, var(--paper, #f8fafc) 100%)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        padding: '16px 18px',
        marginBottom: 16,
        boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.06))',
      }}
    >
      {/* Cabecera con estado general */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>💼</span>
          <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>Resumen Ejecutivo</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {activeUrgentCount > 0 ? (
            <button
              type="button"
              onClick={() => onSelectTab('radar')}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
                cursor: 'pointer',
              }}
            >
              ⚡ {activeUrgentCount} Urgentes
            </button>
          ) : (
            <span
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 800,
                padding: '2px 8px',
              }}
            >
              ✅ Al Día
            </span>
          )}
        </div>
      </div>

      {/* Grid de 3 Métricas Vitales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        {/* 1. Saldo en Caja */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectTab('flujo')}
          style={{
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line-soft, var(--line))',
            borderRadius: 14,
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>💵 Caja Líquida</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: saldoCaja >= 0 ? 'var(--ok)' : 'var(--bad)', margin: '2px 0' }}>
            <ResponsiveMoney value={saldoCaja} />
          </div>
          <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>Disponible para reparto</div>
        </motion.div>

        {/* 2. Por Cobrar en la Calle */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelectTab('cobranza')}
          style={{
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line-soft, var(--line))',
            borderRadius: 14,
            padding: '10px 12px',
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>⏳ Por Cobrar</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent, #3b82f6)', margin: '2px 0' }}>
            <ResponsiveMoney value={porCobrarTotal} />
          </div>
          <div style={{ fontSize: 10, color: contrarecibosVencidos > 0 ? '#ef4444' : 'var(--ink-soft)', fontWeight: contrarecibosVencidos > 0 ? 700 : 400 }}>
            {contrarecibosVencidos > 0 ? `🚨 ${contrarecibosVencidos} vencidos` : 'Contrarecibos activos'}
          </div>
        </motion.div>
      </div>

      {/* 3. Kilos del Mes con Barra de Meta */}
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelectTab('kilos')}
        style={{
          background: 'var(--paper-sunk)',
          border: '1px solid var(--line-soft, var(--line))',
          borderRadius: 14,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, marginBottom: 4 }}>
          <span style={{ fontWeight: 700, color: 'var(--ink-soft)' }}>🚚 Kilos Entregados este Mes</span>
          <span style={{ fontWeight: 800, color: 'var(--ink)' }}>{fmtKilos(kilosMesTotal)} kg ({pctMeta}%)</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: `${pctMeta}%`,
              height: '100%',
              background: pctMeta >= 100 ? 'var(--ok)' : 'linear-gradient(90deg, var(--accent) 0%, #10b981 100%)',
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </motion.div>
    </div>
  );
}
