/**
 * useAnalytics — Hook de BI centralizado (Sprint 3 v9.3.0 → v10.0.0)
 *
 * Deriva KPIs analíticos de las orders existentes sin llamadas extra a
 * Firestore. Los datos ya llegan via OrdersContext (onSnapshot), por lo que
 * este hook es puramente computacional y tiene coste de lectura 0.
 *
 * Métricas expuestas:
 *  - ventasPorMes:       array {mes, ventas, ganancia, kilos} para recharts
 *  - rentabilidadCliente: top clientes por ganancia y margen
 *  - agingReport:        distribución de cartera por días de antigüedad
 *  - kpiGlobal:          totales del período visible
 */
import { useMemo } from 'react';
import { PurchaseOrder } from '../../lib/types';
import { getOrderSummary } from '../../lib/finance';
import { toDate } from '../../lib/format';

export interface MonthlyStat {
  mes: string;       // 'Ene 24', 'Feb 24', ...
  ventas: number;
  ganancia: number;
  kilos: number;
  ordenes: number;
}

export interface ClientStat {
  client: string;
  facturado: number;
  ganancia: number;
  margen: number;     // porcentaje 0-1
  ordenes: number;
  kilos: number;
}

export interface AgingBucket {
  rango: string;
  monto: number;
  count: number;
}

export interface AnalyticsKpi {
  totalVentas: number;
  totalGanancia: number;
  totalKilos: number;
  margenPromedio: number;
  ordenesActivas: number;
  ordenesCobradas: number;
  diasAtrasoPromedio: number;
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export interface AnalyticsData {
  ventasPorMes: MonthlyStat[];
  rentabilidadCliente: ClientStat[];
  agingReport: AgingBucket[];
  kpiGlobal: AnalyticsKpi;
}

export function computeAnalytics(orders: PurchaseOrder[] = []): AnalyticsData {
  const validOrders = (orders || []).filter(o => o && !(o as any).isDeleted);

  // ── 1. Tendencias por mes ─────────────────────────────────────────────
  const monthMap = new Map<string, MonthlyStat>();

    for (const o of validOrders) {
      const summary = getOrderSummary(o);
      const date = toDate(o.createdAt || o.processedAt || o.audit?.createdAt);
      if (!date) continue;
      const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, '0')}`;
      const label = `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(2)}`;

      const existing = monthMap.get(key) ?? { mes: label, ventas: 0, ganancia: 0, kilos: 0, ordenes: 0 };
      existing.ventas    += summary.invoiceTotal   || 0;
      existing.ganancia  += summary.realizedProfit || 0;
      existing.kilos     += summary.kilosDelivered || 0;
      existing.ordenes   += 1;
      monthMap.set(key, existing);
    }

    const ventasPorMes: MonthlyStat[] = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v)
      .slice(-12); // últimos 12 meses

    // ── 2. Rentabilidad por cliente ───────────────────────────────────────
    const clientMap = new Map<string, ClientStat>();

    for (const o of validOrders) {
      const summary = getOrderSummary(o);
      const client = o.client || 'Sin Cliente';
      const existing = clientMap.get(client) ?? {
        client, facturado: 0, ganancia: 0, margen: 0, ordenes: 0, kilos: 0
      };
      existing.facturado += summary.invoiceTotal   || 0;
      existing.ganancia  += summary.realizedProfit > 0 ? summary.realizedProfit : (summary.tradeMargin || 0);
      existing.kilos     += summary.kilosDelivered || 0;
      existing.ordenes   += 1;
      clientMap.set(client, existing);
    }

    const rentabilidadCliente: ClientStat[] = [...clientMap.values()]
      .map(c => ({
        ...c,
        margen: c.facturado > 0 ? c.ganancia / c.facturado : 0
      }))
      .sort((a, b) => b.ganancia - a.ganancia)
      .slice(0, 15);

    // ── 3. Aging Report (cartera por antigüedad) ──────────────────────────
    const now = Date.now();
    const buckets: Record<string, { monto: number; count: number }> = {
      'Al día (0-15 días)':      { monto: 0, count: 0 },
      'Próximos a vencer (16-30)': { monto: 0, count: 0 },
      'Vencido 31-60 días':      { monto: 0, count: 0 },
      'Vencido 61-90 días':      { monto: 0, count: 0 },
      'Vencido +90 días':        { monto: 0, count: 0 },
    };

    for (const o of validOrders) {
      const summary = getOrderSummary(o);
      const pending = (summary.invoiceTotal || 0) - (summary.paidAmount || 0);
      if (pending <= 0) continue;

      const invDue = o.invoices?.find(i => i.creditCycle?.dueDate)?.creditCycle?.dueDate;
      const dueDate = toDate(o.creditCycle?.dueDate ?? invDue ?? (o.createdAt || o.processedAt || o.audit?.createdAt));
      if (!dueDate) continue;
      const dias = Math.floor((now - dueDate.getTime()) / 86_400_000);

      let bucket: string;
      if (dias <= 15)       bucket = 'Al día (0-15 días)';
      else if (dias <= 30)  bucket = 'Próximos a vencer (16-30)';
      else if (dias <= 60)  bucket = 'Vencido 31-60 días';
      else if (dias <= 90)  bucket = 'Vencido 61-90 días';
      else                  bucket = 'Vencido +90 días';

      buckets[bucket].monto += pending;
      buckets[bucket].count += 1;
    }

    const agingReport: AgingBucket[] = Object.entries(buckets).map(([rango, v]) => ({
      rango, ...v
    }));

    // ── 4. KPI Global ─────────────────────────────────────────────────────
    let totalVentas = 0, totalGanancia = 0, totalKilos = 0;
    let totalDiasAtraso = 0, ordenesConAtraso = 0;
    let ordenesActivas = 0, ordenesCobradas = 0;

    for (const o of validOrders) {
      const summary = getOrderSummary(o);
      totalVentas   += summary.invoiceTotal   || 0;
      totalGanancia += summary.realizedProfit || 0;
      totalKilos    += summary.kilosDelivered || 0;
      if (summary.status === 'collected') ordenesCobradas++;
      else ordenesActivas++;
      if ((summary.maxDaysLate || 0) > 0) {
        totalDiasAtraso += summary.maxDaysLate || 0;
        ordenesConAtraso++;
      }
    }

    const kpiGlobal: AnalyticsKpi = {
      totalVentas,
      totalGanancia,
      totalKilos,
      margenPromedio: totalVentas > 0 ? totalGanancia / totalVentas : 0,
      ordenesActivas,
      ordenesCobradas,
      diasAtrasoPromedio: ordenesConAtraso > 0 ? Math.round(totalDiasAtraso / ordenesConAtraso) : 0,
    };

    return { ventasPorMes, rentabilidadCliente, agingReport, kpiGlobal };
}

export function useAnalytics(orders: PurchaseOrder[] = []): AnalyticsData {
  return useMemo(() => computeAnalytics(orders), [orders]);
}
