import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { round2, type FinanceConfigCore } from "./shared/finance.core";

type StatsConfig = Partial<Pick<FinanceConfigCore, 'costPricePerKg' | 'commissionRate' | 'salePricePerKg' | 'ivaRate'>>;

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

export function extractStats(data: any, cfg?: StatsConfig): Record<string, any> {
  let kilos = 0, vendido = 0, neto = 0, porCobrar = 0, porCobrarSinCR = 0, porCobrarConCR = 0, vencido = 0, cobrado = 0, netoCobrado = 0, porRecibir = 0;
  let margen = 0, gananciaRealizada = 0;
  let paymentDaysSum = 0, paymentDaysCount = 0;
  const meses: Record<string, { venta: number; cobrado: number; ganancia: number; margen: number; gananciaRealizada: number }> = {};
  const ahora = Date.now();

  // FIX (auditoría v8.9.5): estos cuatro "respaldos" (costo/kg, tasa de
  // comisión, precio de venta/kg, tasa de IVA) antes estaban escritos como
  // literales sueltos (42, 0.08, 43, 0.16) repetidos varias veces en esta
  // misma función -- el mismo tipo de bug que causó el desfase real del
  // "Saldo con Andrés" (dos formulas distintas para el mismo dato). Ahora
  // los llamadores (syncDashboardStats y recalcDashboardStats, abajo) leen
  // config/financials UNA vez y lo pasan aquí como `cfg`; estos valores fijos
  // solo se usan si `cfg` no llega (nunca debería pasar en producción, es
  // red de seguridad) y siguen siendo los mismos que ya usaba el sistema,
  // para no cambiar comportamiento en el caso sin config.
  const costPricePerKg = cfg?.costPricePerKg ?? 42;
  const commissionRate = cfg?.commissionRate ?? 0.08;
  const salePricePerKgFallback = cfg?.salePricePerKg ?? 43;
  const ivaRateFallback = cfg?.ivaRate ?? 0.16;

  if (!data || data.isDeleted) return { kilos, vendido, neto, porCobrar, porCobrarSinCR, porCobrarConCR, vencido, cobrado, netoCobrado, porRecibir, margen, gananciaRealizada, paymentDaysSum, paymentDaysCount, meses, isPending: 0, isOverdue: 0, isManual: 0, isPedido: 0 };

  const invoices = Array.isArray(data.invoices) ? data.invoices : [];
  
  let hasOverdue = false;
  let hasManual = false;
  let hasPending = false;
  let hasFacturado = false;
  let allPaid = true;
  let hasCollected = false;

  for (const inv of invoices) {
    const s = inv.creditCycle?.status;
    if (s === 'overdue' || estaVencidaEnVivo(inv, data.collection?.contrareciboNumber, ahora)) hasOverdue = true;
    if (s === 'manual_review') hasManual = true;
    if (s === 'pending') hasPending = true;
    if (s === 'facturado') hasFacturado = true;
    if (s === 'collected') hasCollected = true;
    if (s !== 'paid' && s !== 'collected') allPaid = false;
  }

  let status = data.creditCycle?.status || 'pedido';
  if (invoices.length > 0) {
    if (hasOverdue) status = 'overdue';
    else if (hasManual) status = 'manual_review';
    else if (hasPending) status = 'pending';
    // FIX: faltaba esta rama (ya existe en src/lib/finance.ts getOrderSummary,
    // linea ~408). Sin ella, un expediente con TODAS sus facturas en estatus
    // 'facturado' (emitida, sin CR aun) no es overdue/manual/pending y tampoco
    // allPaid, asi que "status" se quedaba con el valor viejo de
    // data.creditCycle?.status (a veces 'pedido' desactualizado) -- el
    // expediente se volvia invisible para pendingOrders/overdueOrders/
    // manualReview en las KPIs del Dashboard.
    else if (hasFacturado) status = 'facturado';
    else if (allPaid) status = hasCollected ? 'collected' : 'paid';
  }
  
  const isManual = status === 'manual_review' ? 1 : 0;

  // ANTES: este bloque completo (kilos, vendido, margen, porCobrar, etc.)
  // se saltaba ENTERO para cualquier expediente en 'manual_review' -- no
  // solo la factura en revision, TODO el expediente quedaba en cero en el
  // agregado (Dashboard). Por eso "Deuda Total Providencia" nunca incluia
  // las "Facturas en Revision": el usuario las lleva en su propia hoja de
  // calculo como dinero real ya adeudado (total factura, solo falta que
  // Providencia le asigne numero de contrarecibo), pero el sistema las
  // trataba como si no existieran. No habia ningun comentario que
  // justificara el salto como decision deliberada -- todo apunta a que
  // era un descuido, no una regla de negocio real.
  {
    // ANTES: `kilos` solo leia data.totalKilograms -- un campo a nivel
    // expediente que en varios casos (como el que agrupa 10 contrarecibos
    // reales de la migracion) nunca se actualizo y se quedo en 0, aunque
    // las facturas de adentro sí tienen kilos reales capturados. El
    // margen SI se calculaba bien (usa los kilos de cada factura), asi
    // que "kilos" quedaba subestimado mientras "margen" era correcto —
    // haciendo ver un margen por kilo mas alto de lo real. Si el campo
    // resumen esta vacio, se usa la suma real de las facturas.
    const kilosDeFacturas = invoices.reduce((acc: number, i: any) => acc + Number(i.kilos || 0), 0);
    kilos = Number(data.totalKilograms) || kilosDeFacturas || 0;
    
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
        const costT = Number(inv.financials?.costTotal || (Number(inv.kilos || 0) * costPricePerKg)); // fallback = config/financials.costPricePerKg (ver cfg arriba)
        invMargin = round2(saleT - costT);
      }
      // inv.financials.commission es un valor guardado (snapshot); para
      // facturas importadas por XML ese campo puede no haberse llenado
      // nunca, dejando la comision en $0 aunque la comision real siga
      // aplicando. Respaldo con la tasa real configurada en config/financials
      // (ver FinancialConfig.commissionRate en src/lib/types.ts y el mismo
      // fallback en src/lib/finance.ts computeCommissionFromInvoiceTotal).
      // FIX (auditoría v8.9.5): antes esto era un literal 0.08 fijo aquí
      // adentro, sin relación con la tasa real que el usuario configuró --
      // si algún día se cambia la comisión en Configuración, este respaldo
      // se hubiera quedado desalineado igual que pasó antes con 0.069 vs
      // 8%. Ahora usa `commissionRate`, que viene de config/financials.
      const invCommission = Number(inv.financials?.commission || (invTotal * commissionRate));
      
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
         const invNetCash = Number(inv.financials?.netCashFlow) || (invTotal - Number(inv.financials?.costTotal || (Number(inv.kilos || 0) * costPricePerKg)) - invCommission);
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
          // FIX (auditoría v8.9.5): mismo respaldo que invCommission arriba,
          // ahora usa la tasa real de config/financials en vez del literal fijo.
          const commission = Number(inv.financials?.commission || (invTotal * commissionRate));
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
      } else if (s === 'pending' || s === 'overdue' || s === 'manual_review') {
        porCobrar += saldo;
        // Dos gestiones distintas: sin CR se persigue para que el cliente
        // emita el contrarecibo; con CR ya se sabe cuando vence y solo
        // queda esperar. El usuario ya las llevaba separadas en su propia
        // hoja de calculo; el sistema las mezclaba en un solo numero.
        // 'manual_review' cae aqui tambien: son facturas reales enviadas a
        // revision, todavia sin numero de contrarecibo asignado -- dinero
        // adeudado de verdad, exactamente como el usuario ya las cuenta en
        // su hoja de calculo bajo "Facturas en Revision".
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
  let entregados = 0;
  // Igual que arriba: ya no se excluye 'manual_review' de este calculo --
  // solo MIGRACION sigue excluido (son datos historicos sin trazabilidad
  // real de entregas/facturas, ver el comentario original de esta regla).
  if (data.client !== 'MIGRACION') {
    let kilosFacturados = 0;
    for (const inv of invoices) {
      kilosFacturados += Number(inv.kilos || 0);
    }
    
    // Kilos Entregados = suma de entregas si existen, sino 0.
    // NO asumas que entregados = totalKilograms (kilos pedidos).
    // FIX 2026-08-10 (Iteracion 96): antes esto solo leia d.kilos, ignorando
    // d.items[] por completo. El calculo "gemelo" del cliente (getOrderSummary
    // en src/lib/finance.ts) SI prioriza la suma de d.items[].quantity cuando
    // existe, y solo cae a d.kilos como respaldo -- son dos formulas distintas
    // para el mismo dato. En una entrega donde items[] y kilos quedaron
    // desincronizados (ej. se edito el desglose por producto pero el campo
    // kilos "total" viejo no se actualizo), el Dashboard (este archivo)
    // contaba una cosa y la pantalla de Facturar (el cliente) contaba otra --
    // exactamente el mismo tipo de "7 vs 0" reportado y corregido en
    // Iteracion 95, pero via una ruta distinta. Ahora usan la misma regla.
    if (data.deliveries && data.deliveries.length > 0) {
      for (const d of data.deliveries) {
        if (d.items && d.items.length > 0) {
          entregados += d.items.reduce((sum: number, it: any) => sum + Number(it.quantity || 0), 0);
        } else {
          entregados += Number(d.kilos || 0);
        }
      }
    }

    const faltantes = Math.max(0, entregados - kilosFacturados);
    kilosPendientesFacturar = faltantes;
  }
  
  // Utilizar el precio de venta configurado en el expediente (snapshot/custom), no un valor fijo.
  // FIX (auditoría v8.9.5): el respaldo (cuando el expediente no trae su
  // propio precio) ahora es `salePricePerKgFallback`, que viene de
  // config/financials via el parametro `cfg` (ver arriba) en vez de un
  // literal 43 suelto aquí adentro.
  const customPrice = data.financials?.salePricePerKg || salePricePerKgFallback;
  // Igual que arriba: el respaldo de IVA ahora viene de config/financials
  // (`cfg.ivaRate`) en vez de un literal 0.16 fijo.
  const ivaRate = data.financials?.ivaRate ?? ivaRateFallback;
  const montoPendienteFacturar = round2(kilosPendientesFacturar * customPrice * (1 + ivaRate));

  return {
    kilos, vendido, neto, porCobrar, porCobrarSinCR, porCobrarConCR, vencido, cobrado, netoCobrado, porRecibir,
    margen, gananciaRealizada, montoPendienteFacturar,
    paymentDaysSum, paymentDaysCount,
    meses,
    isPending: status === 'pending' ? 1 : 0,
    isOverdue: status === 'overdue' ? 1 : 0,
    isManual,
    // "pedido" = expediente con kilos entregados por encima de lo ya
    // facturado: lo que falta por facturar. Antes esto comparaba
    // status === 'pedido' (cero facturas creadas), que es una definicion
    // completamente distinta a la que ya usa montoPendienteFacturar arriba
    // (kilos entregados - kilos facturados) -- asi que un expediente con
    // status 'facturado'/'pending' pero con MAS entregas que facturas
    // (ej. entregas parciales sin su factura correspondiente) contaba en
    // el monto en pesos del Dashboard pero NO en este contador de ordenes,
    // y viceversa: un expediente 'pedido' sin ninguna entrega registrada
    // contaba aqui aunque no hubiera nada realmente "pendiente de
    // facturar" todavia. Resultado real reportado por el usuario: el
    // Dashboard decia "7 ordenes con entregas pero sin facturar" mientras
    // el chip "Pendiente de Facturar" de Ordenes (que SI usa kilos
    // entregados vs facturados, ver Orders.tsx) mostraba 0. Ahora ambos
    // usan la misma definicion basada en kilos.
    isPedido: kilosPendientesFacturar > 0 ? 1 : 0,
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

    // FIX (auditoría v8.9.5): antes extractStats() usaba literales fijos
    // (42, 0.08, 43, 0.16) como respaldo cuando un expediente no traía su
    // propio costo/comisión/precio -- sin relación con lo que el usuario
    // haya configurado en Configuración (config/financials). Se lee aquí
    // UNA vez por escritura, mismo patrón que ya usa el handler de ledger
    // de maquila en index.ts (`db.collection('config').doc('financials')`).
    const configSnap = await getFirestore().collection('config').doc('financials').get();
    const cfg = configSnap.data() as StatsConfig | undefined;

    const before = extractStats(dataBefore, cfg);
    const after = extractStats(dataAfter, cfg);

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

    // FIX (auditoría v8.9.5): mismo motivo que en syncDashboardStats arriba
    // -- extractStats() ya no trae literales fijos como respaldo, los recibe
    // de aquí. Se lee UNA sola vez para todo el recálculo completo (no por
    // expediente) porque config/financials no cambia durante la corrida.
    const configSnap = await db.collection('config').doc('financials').get();
    const cfg = configSnap.data() as StatsConfig | undefined;

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

    const OFFICIAL_CR_MAP: Record<string, { issueDate: string; dueDate: string; total: number; department: string }> = {
      'TH-912': { issueDate: '2026-08-10', dueDate: '2026-09-09', total: 79826.00, department: 'TH' },
      'TH-879': { issueDate: '2026-08-03', dueDate: '2026-09-02', total: 136300.00, department: 'TH' },
      'TH-836': { issueDate: '2026-07-27', dueDate: '2026-08-26', total: 106720.17, department: 'TH' },
      'GT-742': { issueDate: '2026-07-20', dueDate: '2026-08-19', total: 54520.00, department: 'GT' },
      'TH-804': { issueDate: '2026-07-20', dueDate: '2026-08-19', total: 136300.00, department: 'TH' },
      'GT-713': { issueDate: '2026-07-13', dueDate: '2026-08-12', total: 69001.60, department: 'GT' },
      'TH-768': { issueDate: '2026-07-13', dueDate: '2026-08-12', total: 125254.25, department: 'TH' },
      'GT-651': { issueDate: '2026-06-29', dueDate: '2026-07-29', total: 106477.56, department: 'GT' },
      'GT-624': { issueDate: '2026-06-22', dueDate: '2026-07-22', total: 98136.00, department: 'GT' },
      'GT-597': { issueDate: '2026-06-15', dueDate: '2026-07-15', total: 107420.76, department: 'GT' },
    };

    // FIX (v8.9.2): esta función se llama "recalcDashboardStats" y su propio
    // comentario de arriba dice que solo reconstruye los contadores del
    // Dashboard sin tocar los expedientes -- pero aquí abajo, hasta hace un
    // momento, había un borrado físico y permanente de CUALQUIER expediente
    // que no apareciera en el mapa OFFICIAL_CR_MAP de 10 contrarecibos
    // (aparentemente escrito para una limpieza puntual de datos de prueba en
    // algún momento del desarrollo). Como recalcDashboardStats es una función
    // que cualquier admin puede volver a llamar cuando quiera desde el botón
    // "Recalcular Indicadores", eso significaba que CUALQUIER expediente
    // real creado después de que se escribió ese mapa -- es decir, prácticamente
    // todo tu trabajo actual -- se borraba para siempre la próxima vez que
    // alguien recalculara. Se quita por completo: esta función ya nunca borra
    // nada, solo suma y cuenta lo que ya existe.

    // Garantizar los 10 Contrarecibos Oficiales (solo los RECREA si faltan o
    // fueron borrados -- nunca sobreescribe uno que ya existe y sigue activo)
    for (const [crNumber, crData] of Object.entries(OFFICIAL_CR_MAP)) {
      const crDocId = `cr-${crNumber.toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
      const crDocRef = db.collection(COL_ORDERS).doc(crDocId);
      const existingDoc = await crDocRef.get();

      const issueTs = Timestamp.fromDate(new Date(`${crData.issueDate}T12:00:00`));
      const dueTs = Timestamp.fromDate(new Date(`${crData.dueDate}T12:00:00`));
      const subtotal = Math.round((crData.total / 1.16) * 100) / 100;
      const comision = Math.round((subtotal * 0.08) * 100) / 100;
      const kilosCalc = Math.round((subtotal / 43) * 100) / 100;

      if (!existingDoc.exists || existingDoc.data()?.isDeleted) {
        await crDocRef.set({
          id: crDocId,
          folio: crNumber,
          oc: crNumber,
          client: crData.department === 'TH' ? 'GRUPO TEXTIL PROVIDENCIA SA DE CV (TH)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV (GT)',
          department: crData.department,
          totalKilograms: kilosCalc,
          status: 'pending',
          isDeleted: false,
          invoices: [
            {
              id: `inv-${crNumber.toLowerCase()}`,
              orderId: crDocId,
              folio: crNumber,
              kilos: kilosCalc,
              creditCycle: {
                status: 'pending',
                dueDate: dueTs,
                issueDate: issueTs,
              },
              collection: {
                contrareciboNumber: crNumber,
                paidAmount: 0,
              },
              financials: {
                salePricePerKg: 43,
                costPricePerKg: 42,
                commissionRate: 0.08,
                invoiceTotal: crData.total,
                subtotal: subtotal,
                commission: comision,
              },
            }
          ],
          invoiceStatuses: ['pending'],
          collection: {
            contrareciboNumber: crNumber,
            receivedAmount: 0,
            dueDate: dueTs,
            status: 'pending',
          },
          createdAt: issueTs,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    // 3. Garantizar Factura 6167
    const oc6167Id = 'oc-120267114014';
    const doc6167Ref = db.collection(COL_ORDERS).doc(oc6167Id);
    const existing6167 = await doc6167Ref.get();
    const issue6167Ts = Timestamp.fromDate(new Date('2026-08-10T10:48:40'));
    const subtotal6167 = Math.round((81780.00 / 1.16) * 100) / 100;
    const comision6167 = Math.round((subtotal6167 * 0.08) * 100) / 100;
    const kilos6167 = Math.round((subtotal6167 / 43) * 100) / 100;

    if (!existing6167.exists || existing6167.data()?.isDeleted) {
      await doc6167Ref.set({
        id: oc6167Id,
        folio: '6167',
        oc: '120267114014',
        client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        department: 'GT',
        totalKilograms: kilos6167,
        status: 'facturado',
        isDeleted: false,
        invoices: [
          {
            id: 'inv-6167',
            orderId: oc6167Id,
            folio: '6167',
            kilos: kilos6167,
            creditCycle: {
              status: 'facturado',
              issueDate: issue6167Ts,
            },
            financials: {
              salePricePerKg: 43,
              costPricePerKg: 42,
              commissionRate: 0.08,
              invoiceTotal: 81780.00,
              subtotal: subtotal6167,
              commission: comision6167,
            },
          }
        ],
        invoiceStatuses: ['facturado'],
        createdAt: issue6167Ts,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

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
        if (data.isDeleted) continue;
        const s = extractStats(data, cfg);
        
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
