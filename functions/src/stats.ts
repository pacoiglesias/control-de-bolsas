import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

const COL_ORDERS = "purchaseOrders";
const STATS_DOC = "stats/dashboard";

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
  if (ts instanceof Date) return ts;
  return new Date(ts);
}

function monthKey(d: Date): string {
  const m = d.getMonth() + 1;
  return `${d.getFullYear()}-${m < 10 ? '0' : ''}${m}`;
}

function extractStats(data: any): Record<string, any> {
  let kilos = 0, vendido = 0, neto = 0, porCobrar = 0, vencido = 0, cobrado = 0, netoCobrado = 0, porRecibir = 0;
  const meses: Record<string, { venta: number; cobrado: number; ganancia: number }> = {};
  
  if (!data) return { kilos, vendido, neto, porCobrar, vencido, cobrado, netoCobrado, porRecibir, meses, isPending: 0, isOverdue: 0, isManual: 0 };

  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  
  let hasOverdue = false;
  let hasManual = false;
  let hasPending = false;
  let allPaid = true;
  let hasCollected = false;

  for (const inv of invoices) {
    const s = inv.creditCycle?.status;
    if (s === 'overdue') hasOverdue = true;
    if (s === 'manual_review') hasManual = true;
    if (s === 'pending') hasPending = true;
    if (s === 'collected') hasCollected = true;
    if (s !== 'paid' && s !== 'collected') allPaid = false;
  }

  let status = data.creditCycle?.status || 'pedido';
  if (invoices.length > 0) {
    if (hasOverdue) status = 'overdue';
    else if (hasManual) status = 'manual_review';
    else if (hasPending) status = 'pending';
    else if (allPaid) status = hasCollected ? 'collected' : 'paid';
  }
  
  const isManual = status === 'manual_review' ? 1 : 0;
  
  if (status !== 'manual_review') {
    kilos = Number(data.totalKilograms) || 0;
    
    for (const inv of invoices) {
      const invTotal = Number(inv.financials?.invoiceTotal || inv.financials?.saleTotal || 0);
      const invNet = Number(inv.financials?.netCashFlow || 0);
      const paidAmt = Number(inv.collection?.paidAmount || 0);
      const saldo = Math.max(invTotal - paidAmt, 0);
      
      vendido += invTotal;
      neto += invNet;
      
      const s = inv.creditCycle?.status;
      if (s === 'paid') {
        cobrado += paidAmt > 0 ? paidAmt : invTotal;
        netoCobrado += invNet;
        const commission = Number(inv.financials?.commission || 0);
        porRecibir += (invTotal - commission);
      } else if (s === 'pending' || s === 'overdue') {
        porCobrar += saldo;
        if (s === 'overdue') vencido += saldo;
      }
      
      const d = toDate(inv.creditCycle?.issueDate) ?? toDate(data.processedAt);
      if (d) {
        const key = monthKey(d);
        if (!meses[key]) meses[key] = { venta: 0, cobrado: 0, ganancia: 0 };
        meses[key].venta += invTotal;
        meses[key].ganancia += invNet;
        if (s === 'paid') meses[key].cobrado += invTotal;
      }
    }
  }

  return {
    kilos, vendido, neto, porCobrar, vencido, cobrado, netoCobrado, porRecibir,
    meses,
    isPending: status === 'pending' ? 1 : 0,
    isOverdue: status === 'overdue' ? 1 : 0,
    isManual
  };
}

export const syncDashboardStats = onDocumentWritten(
  { document: `${COL_ORDERS}/{orderId}` },
  async (event) => {
    const before = extractStats(event.data?.before?.data());
    const after = extractStats(event.data?.after?.data());

    const updates: Record<string, any> = {};
    const addDelta = (key: string, oldVal: number, newVal: number) => {
      const diff = newVal - oldVal;
      if (Math.abs(diff) > 0.001) {
        updates[`kpis.${key}`] = FieldValue.increment(diff);
      }
    };
    const addCounterDelta = (key: string, oldVal: number, newVal: number) => {
      const diff = newVal - oldVal;
      if (diff !== 0) {
        updates[`counters.${key}`] = FieldValue.increment(diff);
      }
    };

    addDelta("totalKilos", before.kilos, after.kilos);
    addDelta("totalVendido", before.vendido, after.vendido);
    addDelta("netoTotal", before.neto, after.neto);
    addDelta("porCobrar", before.porCobrar, after.porCobrar);
    addDelta("vencido", before.vencido, after.vencido);
    addDelta("cobrado", before.cobrado, after.cobrado);
    addDelta("netoCobrado", before.netoCobrado, after.netoCobrado);
    addDelta("porRecibir", before.porRecibir, after.porRecibir);

    addCounterDelta("pendingOrders", before.isPending, after.isPending);
    addCounterDelta("overdueOrders", before.isOverdue, after.isOverdue);
    addCounterDelta("manualReview", before.isManual, after.isManual);

    // Meses
    const allMonths = new Set([...Object.keys(before.meses), ...Object.keys(after.meses)]);
    allMonths.forEach(m => {
      const b = before.meses[m] || { venta: 0, cobrado: 0, ganancia: 0 };
      const a = after.meses[m] || { venta: 0, cobrado: 0, ganancia: 0 };
      
      const dVenta = a.venta - b.venta;
      const dCobrado = a.cobrado - b.cobrado;
      const dGanancia = a.ganancia - b.ganancia;
      
      if (Math.abs(dVenta) > 0.001) updates[`histograms.${m}.venta`] = FieldValue.increment(dVenta);
      if (Math.abs(dCobrado) > 0.001) updates[`histograms.${m}.cobrado`] = FieldValue.increment(dCobrado);
      if (Math.abs(dGanancia) > 0.001) updates[`histograms.${m}.ganancia`] = FieldValue.increment(dGanancia);
    });

    if (Object.keys(updates).length > 0) {
      updates["lastUpdated"] = FieldValue.serverTimestamp();
      
      // Upsert: si no existe, set con merge
      await getFirestore().doc(STATS_DOC).set(updates, { merge: true });
      logger.info(`Dashboard stats updated for order ${event.params.orderId}`, { updates });
    }
  }
);
