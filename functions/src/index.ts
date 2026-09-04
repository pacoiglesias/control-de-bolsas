import { setGlobalOptions } from "firebase-functions/v2";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import {
  computeFinancials,
  configEfectiva,
  round2,
  type FinanceConfigCore,
} from "./shared/finance.core";
export { parseDocumentData } from "./ai/extractor";
export {
  getActiveMaquilaOrders,
  registrarEntregaMaquila,
  importarEntregaMaquilaPendiente,
} from "./handlers/maquilaPortal";
export {
  enviarRecordatoriosVencimiento,
} from "./handlers/notifications";
export {
  parseUploadedPDF,
  reprocessOrder,
} from "./handlers/uploadProcessing";

// Módulos desacoplados y middlewares del sistema ERP
export * as ComprasModule from "./modules/compras";
export * as FacturacionModule from "./modules/facturacion";
export * as MaquilaModule from "./modules/maquila";
export * as CobranzaModule from "./modules/cobranza";
export * from "./middleware/errorHandler";
export * from "./middleware/validation";
export * from "./utils/logging";

initializeApp();

// Configuración global apuntando a us-east1 para que coincida con tu Storage
setGlobalOptions({ region: "us-east1", maxInstances: 10 });

const COL_ORDERS = "purchaseOrders";

const DEFAULTS = {
  // 2026-08-10: bajó de 47 a 43 (confirmado por el usuario). Debe
  // coincidir con DEFAULT_CONFIG.salePricePerKg en src/lib/types.ts.
  salePricePerKg: 43,
  costPricePerKg: 38,
  commissionRate: 0.08,
  creditDays: 30,
  ivaRate: 0.16,
  // 8% sobre el SUBTOTAL. Verificado contra tres cobros reales (el de
  // 153,381.00 cuadra al centavo: 132,225.00 x 0.08 = 10,578.00).
  // Debe coincidir con DEFAULT_CONFIG en src/lib/types.ts.
  commissionBase: "subtotal" as "subtotal" | "total",
};

async function readConfig(): Promise<FinanceConfigCore> {
  const snap = await getFirestore().collection("config").doc("financials").get();
  const c = snap.exists ? (snap.data() as Partial<typeof DEFAULTS>) : {};
  return {
    salePricePerKg: Number(c.salePricePerKg ?? DEFAULTS.salePricePerKg),
    costPricePerKg: Number(c.costPricePerKg ?? DEFAULTS.costPricePerKg),
    commissionRate: Number(c.commissionRate ?? DEFAULTS.commissionRate),
    creditDays: Number(c.creditDays ?? DEFAULTS.creditDays),
    ivaRate: Number(c.ivaRate ?? DEFAULTS.ivaRate),
    commissionBase: (c.commissionBase ?? DEFAULTS.commissionBase) as "subtotal" | "total",
  };
}
let configCache: { value: FinanceConfigCore; exp: number } | null = null;
async function readConfigCacheada(): Promise<FinanceConfigCore> {
  const ahora = Date.now();
  if (configCache && configCache.exp > ahora) return configCache.value;
  const cfg = await readConfig();
  configCache = { value: cfg, exp: ahora + 60000 };
  return cfg;
}

export const checkOverdueInvoices = onSchedule(
  { schedule: "every day 00:00", timeZone: "America/Mexico_City" },
  async () => {
    const db = getFirestore();
    const ahora = Timestamp.now();

    // Se filtra por el arreglo desnormalizado para no recorrer toda la base.
    const snapshot = await db.collection(COL_ORDERS)
      .where("invoiceStatuses", "array-contains", "pending")
      .get();

    // Los expedientes creados ANTES de que existiera invoiceStatuses no tienen
    // ese campo y la consulta de arriba los deja fuera: quedan sin vigilancia y
    // sin dar error. No se pueden contar con where(campo, "==", null): en
    // Firestore esa consulta solo encuentra documentos con el campo presente y
    // valor null EXPLICITO. Un campo ausente no aparece en ninguna consulta
    // sobre ese campo, asi que el contador anterior devolvia siempre cero.
    // La forma barata de detectarlos es comparar totales.
    const [totalExpedientes, conCampo] = await Promise.all([
      db.collection(COL_ORDERS).count().get()
        .then((r) => r.data().count).catch(() => -1),
      db.collection(COL_ORDERS).where("invoiceStatuses", "!=", null).count().get()
        .then((r) => r.data().count).catch(() => -1),
    ]);
    if (totalExpedientes >= 0 && conCampo >= 0 && totalExpedientes > conCampo) {
      logger.warn(
        `${totalExpedientes - conCampo} expediente(s) sin invoiceStatuses ` +
        `quedan fuera de la revision de vencidos. Se reparan solos al abrirlos ` +
        `y guardarlos una vez desde la interfaz.`,
      );
    }

    if (snapshot.empty) {
      logger.info("No hay expedientes que revisar.");
      return;
    }

    // REGLA DE NEGOCIO: una factura SIN contrarecibo no puede estar vencida.
    // El plazo de credito arranca cuando Providencia emite el CR, no cuando
    // se envia la factura a revision. Sin esto, las facturas en revision se
    // marcaban "overdue" al dia siguiente de su emision e inflaban "Vencido"
    // del panel por su monto completo (ver Ciclo 33 en AUDIT_NOTEBOOK.md).
    // Este era el bug que quedo señalado como pendiente y no se habia
    // corregido todavia ni en esta rama ni en GitHub.
    const yaVencio = (
      cc?: { status?: string; dueDate?: Timestamp | null },
      tieneCr?: boolean,
    ) =>
      !!cc && cc.status === "pending" && !!cc.dueDate && !!tieneCr &&
      cc.dueDate.toMillis() < ahora.toMillis();

    const cambios: { ref: FirebaseFirestore.DocumentReference; datos: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((d: QueryDocumentSnapshot) => {
      const data = d.data();
      const datos: Record<string, unknown> = {};
      const crDelExpediente = !!data.collection?.contrareciboNumber;

      // a) Expedientes viejos: el ciclo vive en la raiz del documento.
      if (yaVencio(data.creditCycle, crDelExpediente)) datos["creditCycle.status"] = "overdue";

      // b) Modelo nuevo: cada factura trae su ciclo dentro del arreglo.
      const invoices: Record<string, unknown>[] = Array.isArray(data.invoices) ? data.invoices : [];
      let tocado = false;
      const actualizadas = invoices.map((inv) => {
        const cc = inv.creditCycle as { status?: string; dueDate?: Timestamp | null } | undefined;
        const collection = inv.collection as { contrareciboNumber?: string } | undefined;
        const tieneCr = !!(collection?.contrareciboNumber || crDelExpediente);
        if (yaVencio(cc, tieneCr)) {
          tocado = true;
          return { ...inv, creditCycle: { ...cc, status: "overdue" } };
        }
        return inv;
      });
      if (tocado) {
        datos.invoices = actualizadas;
        // El arreglo desnormalizado DEBE reescribirse junto con las facturas.
        // Si no, sigue diciendo ["pending"] y la consulta del dia siguiente
        // vuelve a traer el mismo expediente una y otra vez, sin fin.
        datos.invoiceStatuses = actualizadas.map((inv) => {
          const cc = inv.creditCycle as { status?: string } | undefined;
          return cc?.status ?? "pending";
        });
      }

      if (Object.keys(datos).length > 0) {
        datos.updatedAt = FieldValue.serverTimestamp();
        cambios.push({ ref: d.ref, datos });
      }
    });

    // REPARACION de datos ya corrompidos por el bug anterior: facturas que
    // quedaron marcadas "overdue" sin tener contrarecibo, de antes de que
    // esta regla existiera. Necesitan su propia consulta porque, al estar ya
    // en "overdue", invoiceStatuses ya no las trae la busqueda de arriba
    // (que solo busca "pending").
    const snapshotVencidas = await db.collection(COL_ORDERS)
      .where("invoiceStatuses", "array-contains", "overdue")
      .get();
    snapshotVencidas.docs.forEach((d) => {
      const data = d.data();
      const crDelExpediente = !!data.collection?.contrareciboNumber;
      const invoices: Record<string, unknown>[] = Array.isArray(data.invoices) ? data.invoices : [];
      let reparado = false;
      const reparadas = invoices.map((inv) => {
        const cc = inv.creditCycle as { status?: string; dueDate?: Timestamp | null } | undefined;
        const collection = inv.collection as { contrareciboNumber?: string } | undefined;
        const tieneCr = !!(collection?.contrareciboNumber || crDelExpediente);
        if (cc?.status === "overdue" && !tieneCr) {
          reparado = true;
          return { ...inv, creditCycle: { ...cc, status: "pending" } };
        }
        return inv;
      });
      if (reparado) {
        cambios.push({
          ref: d.ref,
          datos: {
            invoices: reparadas,
            invoiceStatuses: reparadas.map((inv) => (inv.creditCycle as { status?: string } | undefined)?.status ?? "pending"),
            updatedAt: FieldValue.serverTimestamp(),
          },
        });
      }
    });

    if (cambios.length === 0) {
      logger.info("Sin facturas vencidas hoy.");
      return;
    }
    for (let i = 0; i < cambios.length; i += 400) {
      const batch = db.batch();
      cambios.slice(i, i + 400).forEach((c) => batch.update(c.ref, c.datos));
      await batch.commit();
    }

    // Aviso de vencimiento: NO es un correo (no hay servicio de mail
    // conectado). Es un renglon en system_logs, buscable y filtrable desde
    // /logs, con los folios que cruzaron a vencido hoy. El semaforo del panel
    // (Dashboard.tsx) ya muestra el conteo visual; esto deja el detalle.
    const folios = snapshot.docs
      .filter((d) => cambios.some((c) => c.ref.id === d.id))
      .map((d) => d.data().folio || d.id)
      .slice(0, 50); // tope razonable para no inflar el registro
    await db.collection("system_logs").add({
      user: "sistema (checkOverdueInvoices)",
      action: "Facturas Vencidas (automático)",
      details: { cantidad: cambios.length, folios },
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`${cambios.length} expedientes con facturas vencidas actualizados.`);
  },
);

import { onDocumentWritten } from "firebase-functions/v2/firestore";

/**
 * Trigger de saneamiento y recalculo server-side.
 *
 * Impide que importes alterados desde las herramientas del navegador queden
 * persistidos, PERO respeta dos cosas que si son datos legitimos:
 *   - los costos y comisiones propios del expediente (Costos variables)
 *   - el total real de una factura timbrada (viene del CFDI, no de la formula)
 */
export const sanitizePurchaseOrder = onDocumentWritten(
  { document: `${COL_ORDERS}/{orderId}` },
  async (event) => {
    if (!event.data?.after.exists) return;
    const data = event.data.after.data();
    if (!data) return;

    // Salida temprana: si el arreglo de facturas no cambio, no hay nada que
    // sanear. Sin esto, el trigger se dispara en cascada sobre sus propias
    // escrituras y sobre los lotes de checkOverdueInvoices (hasta 400 docs).
    const antes = event.data.before?.data();
    if (antes && JSON.stringify(antes.invoices ?? null) === JSON.stringify(data.invoices ?? null)) {
      return;
    }

    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    if (invoices.length === 0) return;

    const base = data.historicalConfig ?? await readConfigCacheada();
    // Los costos y comisiones propios del expediente son configuracion valida,
    // no manipulacion: entran en la formula de referencia.
    const cfg = configEfectiva(base, data);

    let modified = false;

    const sanitizedInvoices = invoices.map((inv: any) => {
      const kilos = Number(inv.kilos) || 0;
      const baseFin = computeFinancials(kilos, cfg);

      // El total de una factura con UUID o Folio viene del CFDI timbrado o captura real, no de la
      // formula. Sobrescribirlo con kilos x precio x IVA destruye el importe
      // fiscal real, que es justo el dato que no se puede recalcular.
      const hasId = inv.uuid || (inv.folio && inv.folio.length > 2);
      const invoiceTotal = hasId && Number(inv.financials?.invoiceTotal) > 0
        ? Number(inv.financials.invoiceTotal)
        : baseFin.invoiceTotal;

      const esperado = {
        ...baseFin,
        invoiceTotal,
        netCashFlow: round2(invoiceTotal - baseFin.costTotal - baseFin.commission),
      };

      const f = inv.financials;
      const igual = !!f
        && f.saleTotal === esperado.saleTotal
        && f.costTotal === esperado.costTotal
        && f.commission === esperado.commission
        && f.invoiceTotal === esperado.invoiceTotal
        && f.netCashFlow === esperado.netCashFlow;

      if (igual) return inv;
      modified = true;
      return { ...inv, financials: esperado };
    });

    if (modified) {
      logger.info(
        `Importes recalculados en la orden ${event.params.orderId} ` +
        `(costo ${cfg.costPricePerKg}, comision ${cfg.commissionRate}).`,
      );
      await event.data.after.ref.update({
        invoices: sanitizedInvoices,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

export { syncDashboardStats, recalcDashboardStats } from "./stats";

export const updateCajaChicaBalance = onDocumentWritten(
  { document: `expenses/{expenseId}` },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    
    // Si no cambió ni se creó ni borró
    if (!before && !after) return;

    // Calcular la diferencia en monto (ingreso positivo, egreso negativo)
    let amountBefore = 0;
    if (before) {
      amountBefore = before.type === 'ingreso' ? (before.amount || 0) : -(before.amount || 0);
    }
    
    let amountAfter = 0;
    if (after) {
      amountAfter = after.type === 'ingreso' ? (after.amount || 0) : -(after.amount || 0);
    }

    const delta = amountAfter - amountBefore;

    if (delta !== 0) {
      // FIX (auditoría v8.9.5): antes escribía en 'system_settings/global',
      // el mismo documento que Login lee con `allow read: if true` (sin
      // sesión) para el logo/nombre de la empresa -- eso dejaba el saldo
      // real de Caja Chica legible por cualquiera. Ahora vive en un
      // documento privado, mismo patrón que ya usa el PIN del Portal
      // Maquilador (`system_settings_private/maquila`).
      const ref = getFirestore().doc('system_settings_private/finanzas');
      await ref.set({
        cajaChicaBalance: FieldValue.increment(delta)
      }, { merge: true });
      logger.info(`Caja Chica updated by ${delta}`);
    }
  }
);

/**
 * Respaldo Automático a Medianoche.
 * Corre todos los días a las 00:00 (America/Mexico_City).
 * Respalda las colecciones críticas (purchaseOrders, purchases, expenses, products, config)
 * en la colección 'snapshots' conservando historial completo.
 */
export const scheduledMidnightBackup = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "America/Mexico_City",
    memory: "512MiB",
    timeoutSeconds: 300,
  },
  async () => {
    const db = getFirestore();
    logger.info("Iniciando Respaldo Automático de Medianoche...");

    const collectionsToBackup = ["purchaseOrders", "purchases", "expenses", "products", "config"];
    const backupData: Record<string, any[]> = {};
    let totalDocs = 0;

    for (const colName of collectionsToBackup) {
      const snap = await db.collection(colName).get();
      backupData[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      totalDocs += snap.size;
    }

    const timestamp = Date.now();
    const snapId = `snap_auto_${timestamp}`;
    const payload = JSON.stringify(backupData);
    const pesoKB = Math.round(payload.length / 1024);

    await db.collection("snapshots").doc(snapId).set({
      id: snapId,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "sistema (Respaldo Automático Medianoche)",
      totalOrders: backupData["purchaseOrders"]?.length || 0,
      totalPurchases: backupData["purchases"]?.length || 0,
      totalExpenses: backupData["expenses"]?.length || 0,
      facturasCount: (backupData["purchaseOrders"] || []).reduce((a, o) => a + (o.invoices?.length || 0), 0),
      payloadKB: pesoKB,
      type: "auto_midnight",
    });

    await db.collection("snapshots").doc(snapId).collection("blob").doc("data").set({ payload });

    // Actualizar puntero latest
    await db.collection("snapshots").doc("latest").set({
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "sistema (Respaldo Automático Medianoche)",
      totalOrders: backupData["purchaseOrders"]?.length || 0,
      lastSnapshotId: snapId,
      payloadKB: pesoKB,
    }, { merge: true });

    logger.info(`Respaldo automático de medianoche completado: ${snapId} (${totalDocs} documentos, ${pesoKB} KB).`);
  }
);

