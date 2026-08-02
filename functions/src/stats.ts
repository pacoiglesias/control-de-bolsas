import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { round2 } from "./shared/finance.core";

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

/**
 * El estatus "overdue" que se guarda en cada factura solo lo escribe
 * checkOverdueInvoices, un job programado que corre UNA VEZ AL DIA
 * ("every day 00:00"). Entre una corrida y la siguiente, una factura ya
 * vencida por fecha sigue guardada como "pending" — y las estadisticas
 * (incluida la tarjeta "Vencido" del panel) solo contaban el estatus
 * guardado, nunca la fecha real.
 *
 * REGLA DE NEGOCIO: una factura SIN contrarecibo no puede estar vencida.
 * El plazo de credito arranca cuando Providencia emite el contrarecibo, no
 * cuando se envia la factura a revision. Sin esta condicion, las "facturas
 * en revision" (que la migracion guardaba con dueDate igual a su fecha de
 * emision) aparecian como vencidas al dia siguiente, inflando "Vencido"
 * por el monto completo de las facturas aun sin contrarecibo.
 */
function estaVencidaEnVivo(
  inv: { creditCycle?: { status?: string; dueDate?: any }; collection?: { contrareciboNumber?: string } } | undefined,
  fallbackCr: string | undefined,
  ahora: number,
): boolean {
  const cc = inv?.creditCycle;
  if (!cc || cc.status !== 'pending' || !cc.dueDate) return false;
  const tieneCr = !!(inv?.collection?.contrareciboNumber || fallbackCr);
  if (!tieneCr) return false;
  const due = toDate(cc.dueDate);
  return !!due && due.getTime() < ahora;
}

export function extractStats(data: any): Record<string, any> {
  let kilos = 0, vendido = 0, neto = 0, porCobrar = 0, porCobrarSinCR = 0, porCobrarConCR = 0, vencido = 0, cobrado = 0, netoCobrado = 0, porRecibir = 0;
  let margen = 0, gananciaRealizada = 0;
  let paymentDaysSum = 0, paymentDaysCount = 0;
  const meses: Record<string, { venta: number; cobrado: number; ganancia: number; margen: number; gananciaRealizada: number }> = {};
  const ahora = Date.now();
  
  if (!data) return { kilos, vendido, neto, porCobrar, porCobrarSinCR, porCobrarConCR, vencido, cobrado, netoCobrado, porRecibir, margen, gananciaRealizada, paymentDaysSum, paymentDaysCount, meses, isPending: 0, isOverdue: 0, isManual: 0, isPedido: 0 };

  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  
  let hasOverdue = false;
  let hasManual = false;
  let hasPending = false;
  let allPaid = true;
  let hasCollected = false;

  for (const inv of invoices) {
    const s = inv.creditCycle?.status;
    if (s === 'overdue' || estaVencidaEnVivo(inv, data.collection?.contrareciboNumber, ahora)) hasOverdue = true;
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
      
      // Margen SIEMPRE, no solo cuando hay costo capturado a mano.
      // Si falta en la BD (expedientes viejos), se calcula al vuelo.
      let invMargin = Number(inv.financials?.tradeMargin);
      if (isNaN(invMargin) || invMargin === 0) {
        const saleT = Number(inv.financials?.saleTotal || (invTotal / 1.16));
        const costT = Number(inv.financials?.costTotal || (Number(inv.kilos || 0) * 42)); // fallback a $42
        invMargin = round2(saleT - costT);
      }
      const invCommission = Number(inv.financials?.commission || 0);
      
      margen += invMargin;
      
      let invRealized = 0;
      if (invTotal > 0 && paidAmt > 0) {
         // Ganancia realizada = (Porcentaje cobrado) * (Margen - Comision)
         // Ojo: Si el IVA es ganancia, el usuario espera ver el flujo neto real.
         // Segun el comentario de finance.core.ts, el IVA es ganancia. 
         // Pero para mantener la consistencia con "Venta - Costo", usamos el margen comercial (sin IVA) 
         // o netCashFlow (con IVA). Como Dashboard usa "margenTotal", seguimos sumando invMargin.
         // Sin embargo, para gananciaRealizada, el flujo neto real incluye el IVA cobrado.
         // Calcularemos la proporcion del netCashFlow.
         const invNetCash = Number(inv.financials?.netCashFlow) || (invTotal - Number(inv.financials?.costTotal || (Number(inv.kilos || 0) * 42)) - invCommission);
         invRealized = (paidAmt / invTotal) * invNetCash;
      }
      gananciaRealizada += invRealized;
      
      vendido += invTotal;
      neto += invNet;
      
      const s = inv.creditCycle?.status;
      if (s === 'paid' || s === 'collected') {
        // Para ganancia cobrada, solo usamos 'paid' para no doble-contar o si 'collected' ya está
        if (s === 'paid') {
          cobrado += paidAmt > 0 ? paidAmt : invTotal;
          netoCobrado += invNet;
          const commission = Number(inv.financials?.commission || 0);
          porRecibir += (invTotal - commission);
        }
        
        // Métrica de DSO predictivo (desde CR hasta Pago)
        const pAt = toDate(inv.collection?.paidAt);
        const crAt = toDate(inv.collection?.contrareciboDate);
        if (pAt && crAt) {
          const dias = (pAt.getTime() - crAt.getTime()) / (1000 * 60 * 60 * 24);
          if (dias >= 0) {
            paymentDaysSum += dias;
            paymentDaysCount += 1;
          }
        }
      } else if (s === 'pending' || s === 'overdue') {
        porCobrar += saldo;
        // Dos gestiones distintas: sin CR se persigue para que el cliente
        // emita el contrarecibo; con CR ya se sabe cuando vence y solo
        // queda esperar. El usuario ya las llevaba separadas en su propia
        // hoja de calculo; el sistema las mezclaba en un solo numero.
        const tieneCr = !!(inv.collection?.contrareciboNumber || data.collection?.contrareciboNumber);
        if (tieneCr) porCobrarConCR += saldo; else porCobrarSinCR += saldo;
        // "vencido" cuenta por FECHA, no solo por el estatus guardado: sin
        // esta comprobacion en vivo, un contrarecibo vencido por calendario
        // pero que el job diario ("every day 00:00") aun no habia procesado
        // se quedaba invisible en "Vencido" y mezclado dentro de "Te deben".
        if (s === 'overdue' || estaVencidaEnVivo(inv, data.collection?.contrareciboNumber, ahora)) vencido += saldo;
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

  // Monto pendiente por facturar (kilos entregados - kilos facturados)
  let kilosPendientesFacturar = 0;
  if (status !== 'manual_review' && data.client !== 'MIGRACION') {
    let kilosFacturados = 0;
    for (const inv of invoices) {
      kilosFacturados += Number(inv.kilos || 0);
    }
    const entregados = Number(data.totalKilograms || 0);
    const faltantes = Math.max(0, entregados - kilosFacturados);
    kilosPendientesFacturar = faltantes;
  }
  const montoPendienteFacturar = round2(kilosPendientesFacturar * 47 * 1.16);

  return {
    kilos, vendido, neto, porCobrar, porCobrarSinCR, porCobrarConCR, vencido, cobrado, netoCobrado, porRecibir,
    margen, gananciaRealizada, montoPendienteFacturar,
    paymentDaysSum, paymentDaysCount,
    meses,
    isPending: status === 'pending' ? 1 : 0,
    isOverdue: status === 'overdue' ? 1 : 0,
    isManual,
    // "pedido" = expediente sin ninguna factura creada: lo que falta por
    // facturar. Contador aparte porque no existia ninguno visible en el
    // panel y el usuario perdio de vista donde se ve este pendiente.
    isPedido: status === 'pedido' ? 1 : 0,
  };
}

async function applyStatsDelta(docPath: string, before: any, after: any) {
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
  addDelta("porCobrarSinCR", before.porCobrarSinCR, after.porCobrarSinCR);
  addDelta("porCobrarConCR", before.porCobrarConCR, after.porCobrarConCR);
  addDelta("vencido", before.vencido, after.vencido);
  addDelta("cobrado", before.cobrado, after.cobrado);
  addDelta("netoCobrado", before.netoCobrado, after.netoCobrado);
  addDelta("porRecibir", before.porRecibir, after.porRecibir);
  addDelta("montoPendienteFacturar", before.montoPendienteFacturar || 0, after.montoPendienteFacturar || 0);
  addDelta("paymentDaysSum", before.paymentDaysSum || 0, after.paymentDaysSum || 0);
  addCounterDelta("paymentDaysCount", before.paymentDaysCount || 0, after.paymentDaysCount || 0);

  addCounterDelta("pendingOrders", before.isPending, after.isPending);
  addCounterDelta("pedidoOrders", before.isPedido, after.isPedido);
  addCounterDelta("overdueOrders", before.isOverdue, after.isOverdue);
  addCounterDelta("manualReview", before.isManual, after.isManual);

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
    await getFirestore().doc(docPath).set(updates, { merge: true });
    logger.info(`Stats updated for ${docPath}`, { updates });
  }
}

export const syncDashboardStats = onDocumentWritten(
  { document: `${COL_ORDERS}/{orderId}` },
  async (event) => {
    const dataBefore = event.data?.before?.data();
    const dataAfter = event.data?.after?.data();
    
    const deptBefore = dataBefore?.department || 'UNKNOWN';
    const deptAfter = dataAfter?.department || 'UNKNOWN';

    const before = extractStats(dataBefore);
    const after = extractStats(dataAfter);

    // 1. Update Global
    await applyStatsDelta(STATS_DOC, before, after);

    // 2. Update Department specific stats
    if (deptBefore === deptAfter) {
      if (deptAfter && deptAfter !== 'UNKNOWN') {
        await applyStatsDelta(`${STATS_DOC}_${deptAfter}`, before, after);
      }
    } else {
      // Department changed or is new
      const empty = extractStats(null);
      if (deptBefore && deptBefore !== 'UNKNOWN') {
        await applyStatsDelta(`${STATS_DOC}_${deptBefore}`, before, empty);
      }
      if (deptAfter && deptAfter !== 'UNKNOWN') {
        await applyStatsDelta(`${STATS_DOC}_${deptAfter}`, empty, after);
      }
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

    const initStats = () => ({
      kpis: {
        totalKilos: 0, totalVendido: 0, netoTotal: 0, margenTotal: 0,
        gananciaRealizadaTotal: 0, porCobrar: 0, porCobrarSinCR: 0, porCobrarConCR: 0,
        vencido: 0, cobrado: 0, netoCobrado: 0, porRecibir: 0, montoPendienteFacturar: 0,
        paymentDaysSum: 0
      },
      counters: { pendingOrders: 0, overdueOrders: 0, manualReview: 0, totalOrders: 0, pedidoOrders: 0, paymentDaysCount: 0 },
      histograms: {} as Record<string, Record<string, number>>
    });

    const globalStats = initStats();
    
    // Fetch dynamic departments
    const settingsSnap = await db.collection('system_settings').doc('global').get();
    const depts = settingsSnap.exists ? (settingsSnap.data()?.departments || ['TH', 'GT']) : ['TH', 'GT'];
    
    const deptStats: Record<string, ReturnType<typeof initStats>> = {};
    for (const d of depts) {
      deptStats[d] = initStats();
    }

    const applyData = (target: any, s: any) => {
      target.kpis.totalKilos += s.kilos;
      target.kpis.totalVendido += s.vendido;
      target.kpis.netoTotal += s.neto;
      target.kpis.margenTotal += s.margen || 0;
      target.kpis.gananciaRealizadaTotal += s.gananciaRealizada || 0;
      target.kpis.porCobrar += s.porCobrar;
      target.kpis.porCobrarSinCR += s.porCobrarSinCR;
      target.kpis.porCobrarConCR += s.porCobrarConCR;
      target.kpis.vencido += s.vencido;
      target.kpis.cobrado += s.cobrado;
      target.kpis.netoCobrado += s.netoCobrado;
      target.kpis.porRecibir += s.porRecibir;
      target.kpis.montoPendienteFacturar += s.montoPendienteFacturar || 0;
      target.kpis.paymentDaysSum += s.paymentDaysSum || 0;

      target.counters.pendingOrders += s.isPending;
      target.counters.pedidoOrders += s.isPedido;
      target.counters.overdueOrders += s.isOverdue;
      target.counters.manualReview += s.isManual;
      target.counters.totalOrders += 1;
      target.counters.paymentDaysCount += s.paymentDaysCount || 0;

      for (const [mes, v] of Object.entries(s.meses as Record<string, any>)) {
        if (!target.histograms[mes]) {
          target.histograms[mes] = { venta: 0, cobrado: 0, ganancia: 0, margen: 0, gananciaRealizada: 0 };
        }
        target.histograms[mes].venta += v.venta;
        target.histograms[mes].cobrado += v.cobrado;
        target.histograms[mes].ganancia += v.ganancia;
        target.histograms[mes].margen += v.margen || 0;
        target.histograms[mes].gananciaRealizada += v.gananciaRealizada || 0;
      }
    };

    const LOTE = 300;
    let ultimo: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let procesados = 0;

    for (;;) {
      let q = db.collection(COL_ORDERS).orderBy("__name__").limit(LOTE);
      if (ultimo) q = q.startAfter(ultimo);
      const snap = await q.get();
      if (snap.empty) break;

      for (const doc of snap.docs) {
        const data = doc.data();
        const s = extractStats(data);
        
        applyData(globalStats, s);
        
        const d = data.department;
        if (d && deptStats[d]) {
          applyData(deptStats[d], s);
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
    
    const saveStats = async (docName: string, stats: any) => {
      redondear(stats.kpis);
      Object.values(stats.histograms).forEach((h: any) => redondear(h));
      await db.doc(docName).set({
        ...stats,
        lastUpdated: FieldValue.serverTimestamp(),
        lastFullRecalc: FieldValue.serverTimestamp(),
      });
    };

    await saveStats(STATS_DOC, globalStats);
    for (const d of depts) {
      await saveStats(`${STATS_DOC}_${d}`, deptStats[d]);
    }

    logger.info(`Recálculo completo de stats/dashboard: ${procesados} expedientes.`);
    return { ok: true, procesados, mensaje: `Estadísticas recalculadas sobre ${procesados} expedientes.` };
  },
);
