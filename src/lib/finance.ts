import type { FinancialConfig, OrderFinancials } from './types';

/**
 * Misma fórmula que corre en la Cloud Function, replicada aquí para que la
 * captura manual y el recálculo desde Configuración den EXACTAMENTE el mismo
 * resultado que el procesamiento automático.
 *
 *   subtotal = kilos x precio de venta
 *   factura  = subtotal + IVA        <- esto es lo que le cobras al cliente
 *   costo    = kilos x costo
 *   comision = (subtotal o factura) x tasa, segun commissionBase
 *   neto     = subtotal - costo - comision
 *
 * El neto se calcula sobre el subtotal a proposito: el IVA no es tuyo, lo
 * cobras y lo enteras. Meterlo en la ganancia infla el resultado.
 */
export function computeFinancials(kilos: number, cfg: FinancialConfig): Required<OrderFinancials> {
  const k = Number.isFinite(kilos) ? kilos : 0;
  const saleTotal = round2(k * cfg.salePricePerKg);
  const invoiceTotal = round2(saleTotal * (1 + (cfg.ivaRate ?? 0)));
  const costTotal = round2(k * cfg.costPricePerKg);
  const base = cfg.commissionBase === 'total' ? invoiceTotal : saleTotal;
  const commission = round2(base * cfg.commissionRate);
  return {
    salePricePerKg: cfg.salePricePerKg,
    costPricePerKg: cfg.costPricePerKg,
    commissionRate: cfg.commissionRate,
    saleTotal,
    invoiceTotal,
    costTotal,
    commission,
    netCashFlow: round2(saleTotal - costTotal - commission),
  };
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** Dias de atraso: positivo = vencida hace N dias, negativo = le faltan N dias. */
export function daysLate(due: Date | null | undefined): number | null {
  if (!due) return null;
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

export const AGING_BUCKETS = [
  { key: 'current', label: 'Aun no vence' },
  { key: 'd30', label: '1 a 30 dias' },
  { key: 'd60', label: '31 a 60 dias' },
  { key: 'd90', label: '61 a 90 dias' },
  { key: 'd90p', label: 'Mas de 90 dias' },
] as const;

export type AgingKey = (typeof AGING_BUCKETS)[number]['key'];

export function agingBucket(due: Date | null | undefined): AgingKey {
  const d = daysLate(due);
  if (d === null || d <= 0) return 'current';
  if (d <= 30) return 'd30';
  if (d <= 60) return 'd60';
  if (d <= 90) return 'd90';
  return 'd90p';
}
