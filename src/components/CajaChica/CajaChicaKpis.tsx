import { motion } from 'framer-motion';
import { money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';

interface CajaChicaKpisProps {
  saldo: number;
  dineroEnTransito: number;
  totalBrutoCobrado: number;
  totalComisionContador: number;
  saldoProveedor: number;
  provName: string;
  totalRepartoSocios: number;
  onReceiveMoney: () => void;
  onPayAndres: () => void;
  onSociosDistribution: () => void;
}

export function CajaChicaKpis({
  saldo,
  dineroEnTransito,
  totalBrutoCobrado,
  totalComisionContador,
  saldoProveedor,
  provName,
  totalRepartoSocios,
  onReceiveMoney,
  onPayAndres,
  onSociosDistribution,
}: CajaChicaKpisProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 16,
        marginBottom: 28,
      }}
    >
      {/* 1. Saldo Líquido en Mano */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderTop: saldo < 0 ? '3px solid #ef4444' : '3px solid #10b981',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase' }}>
              💰 Efectivo en Mano
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: saldo < 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)', color: saldo < 0 ? '#ef4444' : '#10b981' }}>
              {saldo < 0 ? 'Déficit' : 'Disponible'}
            </span>
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: saldo < 0 ? 'var(--bad, #ef4444)' : 'var(--ok, #10b981)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {money(saldo)}
          </div>
          <p style={{ marginTop: 10, marginBottom: 0, fontSize: 12.5, color: 'var(--ink-soft, #94a3b8)', lineHeight: 1.4 }}>
            Dinero líquido disponible en caja física actualmente.
          </p>
        </div>
      </motion.div>

      {/* 2. Dinero en Tránsito con Contadores */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderTop: dineroEnTransito > 0 ? '3px solid #f59e0b' : '3px solid var(--border)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase' }}>
              🚚 En Tránsito (Contador)
            </span>
            {dineroEnTransito > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}>
                Pendiente
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: dineroEnTransito > 0 ? '#f59e0b' : 'var(--ink, #f1f5f9)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {money(dineroEnTransito)}
          </div>

          <div
            style={{
              marginTop: 12,
              marginBottom: 16,
              fontSize: 11.5,
              background: 'var(--paper-sunk, rgba(0, 0, 0, 0.25))',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid var(--line-soft, rgba(255, 255, 255, 0.06))',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--ink-soft, #94a3b8)' }}>
              <span>Cobrado Providencia (c/IVA):</span>
              <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(totalBrutoCobrado)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 600 }}>
              <span>Comisión Contador (8%):</span>
              <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>-{money(totalComisionContador)}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: '#10b981',
                fontWeight: 800,
                borderTop: '1px solid var(--line-soft, rgba(255, 255, 255, 0.08))',
                paddingTop: 4,
                marginTop: 2,
              }}
            >
              <span>Neto a Entregar:</span>
              <span className="mono" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(dineroEnTransito)}</span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={dineroEnTransito > 0 ? { scale: 1.02 } : {}}
          whileTap={dineroEnTransito > 0 ? { scale: 0.98 } : {}}
          style={{
            width: '100%',
            minHeight: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: dineroEnTransito > 0 ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'var(--bg-inset, rgba(255,255,255,0.05))',
            border: dineroEnTransito > 0 ? 'none' : '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: 10,
            color: dineroEnTransito > 0 ? '#000' : 'var(--hint, #64748b)',
            fontWeight: 800,
            fontSize: 13,
            cursor: dineroEnTransito > 0 ? 'pointer' : 'not-allowed',
            opacity: dineroEnTransito > 0 ? 1 : 0.6,
            boxShadow: dineroEnTransito > 0 ? '0 4px 14px rgba(245, 158, 11, 0.25)' : 'none',
          }}
          disabled={dineroEnTransito <= 0}
          onClick={() => {
            triggerHaptic('light');
            onReceiveMoney();
          }}
        >
          💵 {dineroEnTransito > 0 ? 'Recibir Efectivo en Mano' : 'Sin efectivo por recibir'}
        </motion.button>
      </motion.div>

      {/* 3. Cuenta con Andrés */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderTop: saldoProveedor < 0 ? '3px solid #ef4444' : saldoProveedor > 0 ? '3px solid #0ea5e9' : '3px solid var(--border)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase' }}>
              🏭 Cuenta con {provName.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '3px 8px',
                borderRadius: 999,
                background: saldoProveedor < 0 ? 'rgba(239,68,68,0.12)' : saldoProveedor > 0 ? 'rgba(14,165,233,0.12)' : 'rgba(255,255,255,0.06)',
                color: saldoProveedor < 0 ? '#ef4444' : saldoProveedor > 0 ? '#0ea5e9' : 'var(--ink-soft)',
              }}
            >
              {saldoProveedor < 0 ? 'Pasivo Empresa' : saldoProveedor > 0 ? 'Saldo a Favor' : 'Al Día'}
            </span>
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: saldoProveedor < 0 ? 'var(--bad, #ef4444)' : saldoProveedor > 0 ? '#0ea5e9' : 'var(--ink, #f1f5f9)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {saldoProveedor < 0 ? '-' : '+'}
            {money(Math.abs(saldoProveedor))}
          </div>
          <p style={{ marginTop: 10, marginBottom: 16, fontSize: 12.5, color: 'var(--ink-soft, #94a3b8)', lineHeight: 1.4 }}>
            {saldoProveedor < 0
              ? `Deuda pendiente de liquidar a ${provName}.`
              : saldoProveedor > 0
              ? `Anticipo amparado / Saldo a favor con ${provName}.`
              : 'Libro mayor perfectamente conciliado.'}
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            minHeight: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: saldoProveedor < 0 ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: saldoProveedor < 0 ? '0 4px 14px rgba(239, 68, 68, 0.25)' : '0 4px 14px rgba(14, 165, 233, 0.25)',
          }}
          onClick={() => {
            triggerHaptic('light');
            onPayAndres();
          }}
        >
          {saldoProveedor < 0 ? '💸 Liquidar Deuda a Andrés' : '💸 Dar Abono / Anticipo a Andrés'}
        </motion.button>
      </motion.div>

      {/* 4. Reparto de Ganancias a Socios */}
      <motion.div
        whileHover={{ y: -3, scale: 1.01 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--surface-raised, rgba(255, 255, 255, 0.03))',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--border, rgba(255, 255, 255, 0.08))',
          borderTop: '3px solid #a855f7',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 8px 24px -6px rgba(0, 0, 0, 0.12)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', color: 'var(--ink-soft, #94a3b8)', textTransform: 'uppercase' }}>
              🤝 Reparto a Socios
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: 'rgba(168,85,247,0.14)', color: '#c084fc' }}>
              Retiros
            </span>
          </div>
          <div
            style={{
              fontSize: 34,
              fontWeight: 800,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--ink, #f1f5f9)',
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
            }}
          >
            {money(totalRepartoSocios)}
          </div>
          <p style={{ marginTop: 10, marginBottom: 16, fontSize: 12.5, color: 'var(--ink-soft, #94a3b8)', lineHeight: 1.4 }}>
            Total retirado acumulado por socios en el ejercicio.
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%',
            minHeight: 46,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #a855f7, #9333ea)',
            border: 'none',
            borderRadius: 10,
            color: '#fff',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.25)',
          }}
          onClick={() => {
            triggerHaptic('light');
            onSociosDistribution();
          }}
        >
          💼 Retirar Utilidad / Socio
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

