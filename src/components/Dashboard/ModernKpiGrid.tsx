import { motion } from 'framer-motion';
import { ResponsiveMoney } from '../ui';
import { kilos as fmtKilos } from '../../lib/format';

// =========================================================================
// Tipo estricto del objeto de estadísticas (derivado de useDashboardStatsV2)
// Elimina el anti-patrón `k: any`
// =========================================================================
export interface DashboardStatsResult {
  ventasTotal?: number;
  netoTotal?: number;
  totalVendido?: number;
  totalKilos?: number;
  kilosTotal?: number;
  kilos?: number;
  porCobrar?: number;
  dineroRealARecibir?: number;
  porCobrarSinCR?: number;
  porCobrarConCR?: number;
  vencido?: number;
  cobrado?: number;
  overdue?: { length: number };
  pending?: { length: number };
  [key: string]: unknown;
}

interface ModernKpiGridProps {
  k: DashboardStatsResult;
  role: string | null;
  saldoCaja: number;
  config: { salePricePerKg?: number };
  monthFilter: string;
  nav: (path: string) => void;
  contrarecibosVencidosCount?: number;
}

// =========================================================================
// Sub-componente KPI Card — Aplica tokens CSS, no inline styles hardcoded
// =========================================================================
function KpiCard({
  accentGradient,
  icon,
  label,
  children,
  subContent,
  onClick,
  variant,
}: {
  accentGradient: string;
  icon: string;
  label: string;
  children: React.ReactNode;
  subContent: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'danger' | 'ok';
}) {
  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      onClick={onClick}
      className={`kpi-card${variant === 'danger' ? ' bad' : variant === 'ok' ? ' ok' : ''}${onClick ? ' clickable' : ''}`}
      style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Barra de acento superior */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accentGradient,
        }}
      />

      {/* Cabecera: Etiqueta + Ícono */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="kpi-label" style={{ minHeight: 'auto', marginBottom: 0 }}>{label}</span>
        <div className="kpi-icon-badge">{icon}</div>
      </div>

      {/* Valor principal */}
      <div className="kpi-value tabular-nums money-val">{children}</div>

      {/* Sub-contenido */}
      <div className="kpi-sub" style={{ marginTop: 'auto', paddingTop: 6 }}>
        {subContent}
      </div>
    </motion.div>
  );
}

// Punto indicador inline reutilizable
function Dot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        marginRight: 5,
        flexShrink: 0,
      }}
    />
  );
}

// =========================================================================
// ModernKpiGrid — Grid principal de 4 KPIs del Dashboard
// =========================================================================
export function ModernKpiGrid({
  k,
  role,
  saldoCaja,
  monthFilter,
  nav,
  contrarecibosVencidosCount,
}: ModernKpiGridProps) {
  const isViewer = role === 'viewer';
  const vencidos = contrarecibosVencidosCount ?? (k.overdue?.length ?? 0);

  return (
    <div className="kpi-grid">

      {/* 1 — Ventas del Mes */}
      <KpiCard
        accentGradient="linear-gradient(90deg, #3b82f6, #60a5fa)"
        icon="📈"
        label={`Ventas ${monthFilter === 'ALL' ? 'Totales' : 'del Mes'}`}
        subContent={
          <span>
            <Dot color="var(--accent)" />
            {fmtKilos(k.kilosTotal ?? k.totalKilos ?? 0)} kg amparados
          </span>
        }
      >
        <ResponsiveMoney value={k.ventasTotal ?? k.netoTotal ?? 0} />
      </KpiCard>

      {/* 2 — Cartera por Cobrar */}
      <KpiCard
        accentGradient="linear-gradient(90deg, #d97706, #fbbf24)"
        icon="🏦"
        label="Cartera por Cobrar"
        onClick={() => nav('/cobranza')}
        subContent={
          <span>
            <Dot color="#d97706" />
            {(k.porCobrarSinCR ?? 0) > 0 ? 'Facturas + Contrarecibos' : 'Saldo activo'}
          </span>
        }
      >
        <ResponsiveMoney value={k.porCobrar ?? k.dineroRealARecibir ?? 0} />
      </KpiCard>

      {/* 3 — Efectivo en Caja (oculto para viewer) */}
      {!isViewer && (
        <KpiCard
          accentGradient="linear-gradient(90deg, #059669, #34d399)"
          icon="💵"
          label="Efectivo en Caja"
          onClick={() => nav('/caja-chica')}
          variant="ok"
          subContent={
            <span>
              <Dot color="var(--ok)" />
              Disponible en Tesorería
            </span>
          }
        >
          <ResponsiveMoney value={saldoCaja} />
        </KpiCard>
      )}

      {/* 4 — Urgencias / Vencido */}
      <KpiCard
        accentGradient={
          vencidos > 0
            ? 'linear-gradient(90deg, #ef4444, #f87171)'
            : 'linear-gradient(90deg, #10b981, #34d399)'
        }
        icon={vencidos > 0 ? '🚨' : '✨'}
        label={vencidos > 0 ? 'Mora / Urgente' : 'Estado de Cartera'}
        onClick={vencidos > 0 ? () => nav('/cobranza') : undefined}
        variant={vencidos > 0 ? 'danger' : undefined}
        subContent={
          <span>
            <Dot color={vencidos > 0 ? 'var(--bad)' : '#10b981'} />
            {vencidos > 0 ? `${vencidos} CRs vencidos` : 'Al corriente sin atrasos'}
          </span>
        }
      >
        <ResponsiveMoney value={k.vencido ?? 0} />
      </KpiCard>

    </div>
  );
}
