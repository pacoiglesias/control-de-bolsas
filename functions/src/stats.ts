import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";

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

export function extractStats(data: any): Record<string, any> {
  let kilos = 0, vendido = 0, neto = 0, porCobrar = 0, vencido = 0, cobrado = 0, netoCobrado = 0, porRecibir = 0;
  let margen = 0, gananciaRealizada = 0;
  const meses: Record<string, { venta: number; cobrado: number; ganancia: number; margen: number; gananciaRealizada: number }> = {};
  
  if (!data) return { kilos, vendido, neto, porCobrar, vencido, cobrado, netoCobrado, porRecibir, margen, gananciaRealizada, meses, isPending: 0, isOverdue: 0, isManual: 0 };

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
      
      const hasCustomCost = data.customCostPrice !== undefined && data.customCostPrice !== null && data.customCostPrice !== '';
      const invMargin = hasCustomCost ? Number(inv.financials?.tradeMargin || 0) : 0;
      const invCommission = Number(inv.financials?.commission || 0);
      
      margen += invMargin;
      
      let invRealized = 0;
      if (invTotal > 0 && paidAmt > 0) {
         invRealized = (paidAmt / invTotal) * (hasCustomCost ? (invMargin - invCommission) : 0);
      }
      gananciaRealizada += invRealized;
      
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
        if (!meses[key]) meses[key] = { venta: 0, cobrado: 0, ganancia: 0, margen: 0, gananciaRealizada: 0 };
        meses[key].venta += invTotal;
        meses[key].ganancia += invNet;
        meses[key].margen += invMargin;
        meses[key].gananciaRealizada += invRealized;
        if (s === 'paid') meses[key].cobrado += invTotal;
      }
    }
  }

  return {
    kilos, vendido, neto, porCobrar, vencido, cobrado, netoCobrado, porRecibir,
    margen, gananciaRealizada,
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
    addDelta("margenTotal", before.margen || 0, after.margen || 0);
    addDelta("gananciaRealizadaTotal", before.gananciaRealizada || 0, after.gananciaRealizada || 0);
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
      const b = before.meses[m] || { venta: 0, cobrado: 0, ganancia: 0, margen: 0, gananciaRealizada: 0 };
      const a = after.meses[m] || { venta: 0, cobrado: 0, ganancia: 0, margen: 0, gananciaRealizada: 0 };
      
      const dVenta = a.venta - b.venta;
      const dCobrado = a.cobrado - b.cobrado;
      const dGanancia = a.ganancia - b.ganancia;
      const dMargen = (a.margen || 0) - (b.margen || 0);
      const dRealizada = (a.gananciaRealizada || 0) - (b.gananciaRealizada || 0);
      
      if (Math.abs(dVenta) > 0.001) updates[`histograms.${m}.venta`] = FieldValue.increment(dVenta);
      if (Math.abs(dCobrado) > 0.001) updates[`histograms.${m}.cobrado`] = FieldValue.increment(dCobrado);
      if (Math.abs(dGanancia) > 0.001) updates[`histograms.${m}.ganancia`] = FieldValue.increment(dGanancia);
      if (Math.abs(dMargen) > 0.001) updates[`histograms.${m}.margen`] = FieldValue.increment(dMargen);
      if (Math.abs(dRealizada) > 0.001) updates[`histograms.${m}.gananciaRealizada`] = FieldValue.increment(dRealizada);
    });

    if (Object.keys(updates).length > 0) {
      updates["lastUpdated"] = FieldValue.serverTimestamp();
      
      // Upsert: si no existe, set con merge
      await getFirestore().doc(STATS_DOC).set(updates, { merge: true });
      logger.info(`Dashboard stats updated for order ${event.params.orderId}`, { updates });
    }
  }
);

/**
 * Reconstruye stats/dashboard desde cero recorriendo TODOS los expedientes.
 *
 * syncDashboardStats es incremental: aplica FieldValue.increment sobre la
 * diferencia cada vez que se escribe un expediente. Eso funciona a partir del
 * momento en que el trigger existe, pero los expedientes anteriores a su
 * despliegue nunca dispararon ningun evento, asi que el documento arrancaba
 * vacio y el Dashboard mostraba ceros para siempre. Faltaba justamente esta
 * pieza: la siembra inicial.
 *
 * Sirve tambien como boton de reconciliacion: si alguna vez los contadores se
 * desfasan (un error a medias, una escritura fuera de banda), esto los deja
 * cuadrados otra vez sin tocar los expedientes.
 *
 * Reutiliza extractStats(), la MISMA funcion que usa el trigger incremental.
 * Si se duplicara la formula aqui, las dos copias divergirian tarde o
 * temprano y el recalculo empezaria a "corregir" hacia un valor equivocado.
 */
export const recalcDashboardStats = onCall(
  { memory: "1GiB", timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (request.auth.token.email_verified !== true) {
      throw new HttpsError("permission-denied", "Necesitas verificar tu correo.");
    }

    const db = getFirestore();

    // Solo un administrador puede recalcular: el resultado es global y una
    // ejecucion concurrente con escrituras en curso puede dejar los numeros
    // ligeramente corridos hasta el siguiente recalculo.
    const adminSnap = await db.collection("admins").doc(request.auth.uid).get();
    if (!adminSnap.exists || adminSnap.data()?.role !== "admin") {
      throw new HttpsError("permission-denied", "Solo un administrador puede recalcular las estadísticas.");
    }

    const kpis = {
      totalKilos: 0, totalVendido: 0, netoTotal: 0, margenTotal: 0,
      gananciaRealizadaTotal: 0, porCobrar: 0, vencido: 0, cobrado: 0,
      netoCobrado: 0, porRecibir: 0,
    };
    const counters = { pendingOrders: 0, overdueOrders: 0, manualReview: 0, totalOrders: 0 };
    const histograms: Record<string, Record<string, number>> = {};

    // Paginado por documento: traer la coleccion completa de un golpe agota la
    // memoria en cuanto el historico crece. 300 por lote es conservador.
    const LOTE = 300;
    let ultimo: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let procesados = 0;

    for (;;) {
      let q = db.collection(COL_ORDERS).orderBy("__name__").limit(LOTE);
      if (ultimo) q = q.startAfter(ultimo);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const s = extractStats(doc.data());
        kpis.totalKilos += s.kilos;
        kpis.totalVendido += s.vendido;
        kpis.netoTotal += s.neto;
        kpis.margenTotal += s.margen || 0;
        kpis.gananciaRealizadaTotal += s.gananciaRealizada || 0;
        kpis.porCobrar += s.porCobrar;
        kpis.vencido += s.vencido;
        kpis.cobrado += s.cobrado;
        kpis.netoCobrado += s.netoCobrado;
        kpis.porRecibir += s.porRecibir;

        counters.pendingOrders += s.isPending;
        counters.overdueOrders += s.isOverdue;
        counters.manualReview += s.isManual;
        counters.totalOrders += 1;

        for (const [mes, v] of Object.entries(s.meses as Record<string, any>)) {
          if (!histograms[mes]) {
            histograms[mes] = { venta: 0, cobrado: 0, ganancia: 0, margen: 0, gananciaRealizada: 0 };
          }
          histograms[mes].venta += v.venta;
          histograms[mes].cobrado += v.cobrado;
          histograms[mes].ganancia += v.ganancia;
          histograms[mes].margen += v.margen || 0;
          histograms[mes].gananciaRealizada += v.gananciaRealizada || 0;
        }
        procesados++;
      }

      ultimo = snap.docs[snap.docs.length - 1];
      if (snap.size < LOTE) break;
    }

    const redondear = (o: Record<string, number>) => {
      for (const k of Object.keys(o)) o[k] = Math.round(o[k] * 100) / 100;
      return o;
    };
    redondear(kpis);
    Object.values(histograms).forEach(redondear);

    // set SIN merge: es un reemplazo total a proposito. Con merge, cualquier
    // contador viejo que ya no corresponda se quedaria pegado para siempre.
    await db.doc(STATS_DOC).set({
      kpis,
      counters,
      histograms,
      lastUpdated: FieldValue.serverTimestamp(),
      lastFullRecalc: FieldValue.serverTimestamp(),
    });

    logger.info(`Recálculo completo de stats/dashboard: ${procesados} expedientes.`);
    return { ok: true, procesados, mensaje: `Estadísticas recalculadas sobre ${procesados} expedientes.` };
  },
);
