import type { PurchaseOrder, Delivery, PurchaseOrderItem } from './types';

export interface ClientReportMetrics {
  totalKg: number;
  deliveredKg: number;
  invoicedKg: number;
  pendingInvoiceKg: number;
  remainingKg: number;
  fulfillPct: number;
  salePrice: number;
  deliveredAmountIva: number;
  pendingAmount: number;
  nextDate?: any;
  deliveries: Delivery[];
  items: PurchaseOrderItem[];
}

export function pct(a: number, b: number): number {
  if (!b || !isFinite(b)) return 0;
  return Math.min(100, Math.round((a / b) * 1000) / 10);
}

export function computeClientReportMetrics(order: PurchaseOrder): ClientReportMetrics {
  const totalKg = Number(order.totalKilograms) || 0;
  const deliveries = order.deliveries || [];
  const invoices = order.invoices || [];

  const deliveredKg = deliveries.reduce((s, d) => s + (Number(d.kilos) || 0), 0);
  const invoicedKg = invoices.reduce((s, i) => s + (Number(i.kilos) || 0), 0);
  const pendingInvoiceKg = Math.max(0, deliveredKg - invoicedKg);
  const remainingKg = Math.max(0, totalKg - deliveredKg);

  const fulfillPct = pct(deliveredKg, totalKg);

  const salePrice = order.financials?.salePricePerKg ?? order.customSellPrice ?? null;
  const effectivePrice = salePrice ?? 0;
  const deliveredAmount = deliveredKg * effectivePrice;
  const deliveredAmountIva = deliveredAmount * 1.16;
  const pendingAmount = remainingKg * effectivePrice * 1.16;

  const nextDate = order.estimatedDeliveryDate;
  const items = order.items || [];

  return {
    totalKg,
    deliveredKg,
    invoicedKg,
    pendingInvoiceKg,
    remainingKg,
    fulfillPct,
    salePrice: effectivePrice,
    deliveredAmountIva,
    pendingAmount,
    nextDate,
    deliveries,
    items,
  };
}
