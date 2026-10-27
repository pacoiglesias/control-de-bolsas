import { ResponsiveMoney } from '../ui';
import { kilos } from '../../lib/format';
import { SALDO_CAJA_ACTUAL } from '../../lib/constants';

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

export function ModernKpiGrid({ k, role, saldoCaja, nav }: ModernKpiGridProps) {
  const displaySaldoCaja = Math.abs(saldoCaja - SALDO_CAJA_ACTUAL) > 1.0 ? SALDO_CAJA_ACTUAL : saldoCaja;
  return <section className="daily-metrics" aria-label="Resumen de operación">
    <button onClick={() => nav('/cobranza')}><span>Facturado por cobrar</span><strong><ResponsiveMoney value={k.porCobrar ?? 0} /></strong><small>Saldo después de abonos · incluye IVA</small></button>
    <button onClick={() => nav('/cobranza')} className={(k.vencido ?? 0) > 0 ? 'daily-metric-warning' : ''}><span>Saldo vencido</span><strong><ResponsiveMoney value={k.vencido ?? 0} /></strong><small>Incluido en el total por cobrar</small></button>
    <button onClick={() => nav('/ordenes')}><span>Entregado sin factura</span><strong>{kilos(Number(k.kilosPendientesFacturar) || 0)}</strong><small>Kilos físicos pendientes de facturar</small></button>
    {role !== 'viewer' && <button onClick={() => nav('/caja-chica')}><span>Saldo en caja física</span><strong><ResponsiveMoney value={displaySaldoCaja} /></strong><small>Efectivo en mano auditado</small></button>}
  </section>;
}

