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
  computeDynamicFinancials,
  computeCommissionFromInvoiceTotal,
  configEfectiva,
  round2,
} from '../../functions/src/shared/finance.core';
export type {
  FinanceConfigCore,
  FinanceResultCore,
  DynamicFinancialsInput,
  DynamicFinancialsResult,
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
  let tradeMargin = 0, realizedProfit = 0;
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
    
    // El margen se calcula SIEMPRE. Antes estaba condicionado a que la orden
    // tuviera un costo capturado a mano (`customCostPrice`), asi que cualquier
    // expediente que usara el costo de la configuracion reportaba margen CERO.
    // Resultado: "Ganancia Comercial" salia en $0.00 salvo que se escribiera
    // el costo manualmente en cada orden. computeFinancials ya resuelve el
    // costo efectivo (override si existe, configuracion si no), asi que
    // tradeMargin siempre trae un valor correcto.
    const invMargin = i.financials?.tradeMargin ?? 0;
    tradeMargin += invMargin;

    // Ganancia por cobros: si pagaron algo, la proporcion pagada de (Margen - Comision).
    const invTotal = i.financials?.invoiceTotal || 0;
    const invPaid = i.collection?.paidAmount || 0;
    if (invTotal > 0 && invPaid > 0) {
      const invCommission = i.financials?.commission || 0;
      realizedProfit += (invPaid / invTotal) * (invMargin - invCommission);
    }

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
  tradeMargin = round2(tradeMargin);
  realizedProfit = round2(realizedProfit);

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
    tradeMargin,
    realizedProfit,
    paidAmount,
    status,
    maxDaysLate
  };
}

export interface PorRecibirItem {
  orderId: string;
  invoiceId: string;
  folio: string;
  cr: string;
  invoiceTotal: number;
  commission: number;
  net: number;
}

export function extractDashboardAlerts(activeOrders: PurchaseOrder[], avgDSO: number = 0) {
  const vencidas: { o: PurchaseOrder; inv: Invoice; d: number }[] = [];
  const proximas: { o: PurchaseOrder; inv: Invoice; d: number }[] = [];
  const porRecibir: PorRecibirItem[] = [];
  let criticos30 = 0;
  let urgentes15 = 0;
  let recientes1 = 0;
  let proyeccion7d = 0;
  let proyeccion15d = 0;

  activeOrders.forEach(o => {
    const invoices = o.invoices || [];
    invoices.forEach(inv => {
      const s = inv.creditCycle.status;
      if (s === 'pending' || s === 'overdue') {
        let dDate: Date | null = null;
        if (inv.creditCycle.dueDate) {
          dDate = (inv.creditCycle.dueDate as any).toDate ? (inv.creditCycle.dueDate as any).toDate() : new Date(inv.creditCycle.dueDate as any);
        }
        const late = daysLate(dDate);
        if (late !== null) {
          if (late > 0) vencidas.push({ o, inv, d: late });
          else if (late >= -7) proximas.push({ o, inv, d: late });
        }
        if (late !== null && late > 30) criticos30++;
        else if (late !== null && late > 15) urgentes15++;
        else if (late !== null && late > 0) recientes1++;

        let predictiveLate = late;
        if (avgDSO > 0 && inv.collection?.contrareciboDate) {
          const crDate = (inv.collection.contrareciboDate as any).toDate ? (inv.collection.contrareciboDate as any).toDate() : new Date(inv.collection.contrareciboDate as any);
          const expectedPayDate = addDays(crDate, avgDSO);
          predictiveLate = daysLate(expectedPayDate);
        }

        if (predictiveLate !== null) {
          const saldo = (inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0);
          // Si ya venció o vence en próximos 7 días
          if (predictiveLate >= -7) proyeccion7d += saldo;
          // Si ya venció o vence en próximos 15 días
          if (predictiveLate >= -15) proyeccion15d += saldo;
        }
      }
      if (s === 'paid') {
        const invoiceTotal = Number(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0);
        const commission = Number(inv.financials?.commission ?? 0);
        porRecibir.push({
          orderId: o.id,
          invoiceId: inv.id,
          folio: inv.folio ?? '—',
          cr: inv.collection?.contrareciboNumber || '—',
          invoiceTotal,
          commission,
          net: round2(invoiceTotal - commission),
        });
      }
    });
  });

  return { vencidas, proximas, criticos30, urgentes15, recientes1, porRecibir, proyeccion7d, proyeccion15d };
}

export function calculateLiveMargenTotal(activeOrders: PurchaseOrder[], defaultCostPricePerKg: number): number {
  let liveMargenTotal = 0;
  activeOrders.forEach(o => {
    (o.invoices || []).forEach(inv => {
      const invTotal = Number(inv.financials?.saleTotal ?? inv.financials?.invoiceTotal ?? 0);
      const comm = Number(inv.financials?.commission ?? 0);
      const matCost = Number(inv.financials?.costTotal ?? (inv.kilos * defaultCostPricePerKg));
      liveMargenTotal += invTotal - matCost - comm;
    });
  });
  return round2(liveMargenTotal);
}

