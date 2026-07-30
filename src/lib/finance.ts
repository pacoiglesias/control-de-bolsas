import type { PurchaseOrder, Invoice, Delivery, OrderStatus } from './types';

/**
 * La formula vive en un solo lugar: functions/src/shared/finance.core.ts, que
 * importan tanto el frontend como las Cloud Functions. Antes estaba duplicada
 * en ambos lados con el comentario "si cambias una, cambia la otra", y la
 * duplicacion ya habia empezado a divergir.
 *
 * Se reexporta desde aqui para que nada del frontend tenga que conocer esa
 * ruta y todos los imports existentes sigan funcionando igual.
 */
import { round2 } from '../../functions/src/shared/finance.core';

export {
  computeFinancials,
  configEfectiva,
  round2,
} from '../../functions/src/shared/finance.core';
export type {
  FinanceConfigCore,
  FinanceResultCore,
} from '../../functions/src/shared/finance.core';

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
  let hasCollected = false;
  let maxDaysLate: number | null = null;

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
    if (s === 'collected') hasCollected = true;
    if (s !== 'paid' && s !== 'collected') allPaid = false;
    if (s !== 'pedido') allPedido = false;

    if (s === 'pending' || s === 'overdue') {
      let dDate: Date | null = null;
      if (i.creditCycle.dueDate) {
        dDate = (i.creditCycle.dueDate as any).toDate ? (i.creditCycle.dueDate as any).toDate() : new Date(i.creditCycle.dueDate as any);
      }
      const d = daysLate(dDate);
      if (d !== null) {
        if (maxDaysLate === null || d > maxDaysLate) {
          maxDaysLate = d;
        }
      }
    }
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
      if (kilosInvoiced < (o.totalKilograms || 0)) status = 'pending';
      else status = hasCollected ? 'collected' : 'paid';
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
    status,
    maxDaysLate
  };
}
