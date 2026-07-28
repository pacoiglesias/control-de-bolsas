import type { FinancialConfig, OrderFinancials, PurchaseOrder, Invoice, Delivery, OrderStatus } from './types';

/**
 * Misma fórmula que corre en la Cloud Function, replicada aquí para que la
 * captura manual y el recálculo desde Configuración den EXACTAMENTE el mismo
 * resultado que el procesamiento automático.
 *
 *   subtotal = kilos x precio de venta
 *   factura  = subtotal + IVA        <- esto es lo que le cobras al cliente
 *   costo    = kilos x costo
 *   comision = (subtotal o factura) x tasa, segun commissionBase
 *   neto     = factura - costo - comision
 *
 * El neto se calcula sobre la factura (con IVA) porque el usuario indicó que el IVA es parte íntegra de su ganancia.
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
    netCashFlow: round2(invoiceTotal - costTotal - commission),
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

export function getOrderSummary(o: PurchaseOrder) {
  const invoices: Invoice[] = o.invoices && o.invoices.length > 0 ? o.invoices : [];
  if (invoices.length === 0 && (o.folio || (o.financials && o.financials.saleTotal && o.financials.saleTotal > 0))) {
    invoices.push({
      id: o.id + '-inv0',
      folio: o.folio,
      kilos: o.totalKilograms || 0,
      financials: o.financials,
      creditCycle: o.creditCycle || { status: 'pedido' },
      collection: o.collection
    });
  }

  const deliveries: Delivery[] = o.deliveries && o.deliveries.length > 0 ? o.deliveries : [];
  if (deliveries.length === 0 && o.totalKilograms && o.totalKilograms > 0 && invoices.length > 0) {
    deliveries.push({
      id: o.id + '-del0',
      date: o.processedAt || null,
      kilos: o.totalKilograms
    });
  }

  const kilosDelivered = round2(deliveries.reduce((a, d) => a + d.kilos, 0));
  
  let kilosInvoiced = 0, invoiceTotal = 0, saleTotal = 0, commission = 0, netCashFlow = 0, paidAmount = 0;
  let hasOverdue = false, hasManual = false, hasPending = false, hasFacturado = false, allPaid = true, allPedido = true;

  for (const i of invoices) {
    kilosInvoiced += i.kilos;
    invoiceTotal += i.financials?.invoiceTotal || 0;
    saleTotal += i.financials?.saleTotal || 0;
    commission += i.financials?.commission || 0;
    netCashFlow += i.financials?.netCashFlow || 0;
    paidAmount += i.collection?.paidAmount || 0;

    const s = i.creditCycle.status;
    if (s === 'overdue') hasOverdue = true;
    if (s === 'manual_review') hasManual = true;
    if (s === 'pending') hasPending = true;
    if (s === 'facturado') hasFacturado = true;
    if (s !== 'paid') allPaid = false;
    if (s !== 'pedido') allPedido = false;
  }

  kilosInvoiced = round2(kilosInvoiced);
  invoiceTotal = round2(invoiceTotal);
  saleTotal = round2(saleTotal);
  commission = round2(commission);
  netCashFlow = round2(netCashFlow);
  paidAmount = round2(paidAmount);

  let status: OrderStatus = o.creditCycle?.status ?? 'pedido';
  if (invoices.length > 0) {
    if (hasOverdue) status = 'overdue';
    else if (hasManual) status = 'manual_review';
    else if (hasPending) status = 'pending';
    else if (hasFacturado) status = 'facturado';
    else if (allPaid) {
      status = kilosInvoiced >= (o.totalKilograms || 0) ? 'paid' : 'pending';
    } else if (allPedido) {
      status = 'pedido';
    }
  }

  return {
    invoices,
    deliveries,
    kilosDelivered,
    kilosInvoiced,
    invoiceTotal,
    saleTotal,
    commission,
    netCashFlow,
    paidAmount,
    status
  };
}
