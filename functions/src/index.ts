import { setGlobalOptions } from "firebase-functions/v2";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";
import {
  computeFinancials,
  configEfectiva,
  round2,
  type FinanceConfigCore,
} from "./shared/finance.core";
import { parseDocumentData } from "./ai/extractor";

export { parseDocumentData };

initializeApp();

// Configuración global apuntando a us-east1 para que coincida con tu Storage
setGlobalOptions({ region: "us-east1", maxInstances: 10 });

const UPLOAD_PREFIX = "uploads/";

/**
 * Tamano maximo real que procesa la IA. Este es el limite que manda:
 * el PDF viaja a Gemini en base64 dentro del prompt.
 * Debe coincidir con MAX_UPLOAD_MB en src/pages/Upload.tsx y con el limite
 * de storage.rules. Antes habia cuatro cifras distintas (20 en la interfaz,
 * 20 en las reglas, 5 aqui, 25 en SECURITY.md) y los archivos entre 5 y 20 MB
 * se descartaban en silencio: toast verde y nunca aparecia el expediente.
 */
const MAX_UPLOAD_MB = 5;
const COL_ORDERS = "purchaseOrders";

const DEFAULTS = {
  salePricePerKg: 47,
  costPricePerKg: 42,
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

// Force deploy to fix CORS/IAM policy
export const getActiveMaquilaOrders = onCall({ invoker: "public", cors: true }, async (request) => {

  const { action, pin } = request.data || {};
  const db = getFirestore();

  // El PIN se exige para CUALQUIER accion de esta funcion, no solo
  // "ledger". Antes el camino por defecto (listar/registrar entregas) no
  // pedia PIN en absoluto en el servidor — el "candado" solo vivia en el
  // navegador, y cualquiera con la URL de la funcion podia llamarla
  // directo sin PIN. Ademas, el PIN real ahora se lee de un documento que
  // Firestore nunca deja leer al cliente (system_settings_private), no del
  // documento publico donde vivia antes.
  if (!pin) throw new HttpsError('invalid-argument', 'PIN requerido');
  const pinSnap = await db.collection('system_settings_private').doc('maquila').get();
  const realPin = pinSnap.data()?.pin || '2468';
  if (pin !== realPin) {
    throw new HttpsError('permission-denied', 'PIN incorrecto');
  }

  if (action === 'ledger') {
    const configSnap = await db.collection('config').doc('financials').get();
    const costPricePerKg = configSnap.data()?.costPricePerKg || 42;
    const historicalDebtAndres = configSnap.data()?.historicalDebtAndres || 0;

    const purchasesSnap = await db.collection('purchases').get();
    const provPurchases = purchasesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((p: any) => p.provider && p.provider.toLowerCase() === 'andres');

    const orderIds = provPurchases.map(p => p.id);
    const orderById = new Map();
    if (orderIds.length > 0) {
      const ordersSnap = await db.collection('purchaseOrders').get();
      ordersSnap.docs.forEach(d => {
        orderById.set(d.id, d.data());
      });
    }

    const expensesSnap = await db.collection('expenses').get();
    const provExpenses = expensesSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((e: any) => e.provider && e.provider.toLowerCase() === 'andres');

    const totalReceivedKilos = provPurchases.reduce((acc, p: any) => acc + (p.receivedKilos ?? 0), 0);
    const totalPurchasesCost = provPurchases.reduce((acc, p: any) => acc + ((p.receivedKilos ?? 0) * (p.pricePerKg || costPricePerKg)), 0);
    
    const totalPagado = provExpenses.reduce((acc, e: any) => {
      if (e.type === 'egreso') return acc + (e.amount || 0);
      if (e.type === 'ingreso') return acc - (e.amount || 0);
      return acc;
    }, 0);
    
    const saldoProveedor = totalPagado - totalPurchasesCost + historicalDebtAndres;

    const ledger: any[] = [
      ...provPurchases.map((p: any) => ({
        id: p.id,
        date: p.date, 
        concept: `Entrega (Amortización) OC-${orderById.get(p.id)?.folio || 'S/F'}`,
        cargo: ((p.receivedKilos ?? 0) * (p.pricePerKg || costPricePerKg)),
        abono: 0,
        balance: 0,
        source: 'purchase'
      })).filter((x: any) => x.cargo > 0),
      ...provExpenses.map((e: any) => ({
        id: e.id,
        date: e.date,
        concept: e.concept || '',
        cargo: e.type === 'ingreso' ? (e.amount || 0) : 0, 
        abono: e.type === 'egreso' ? (e.amount || 0) : 0, 
        balance: 0,
        source: 'expense'
      }))
    ];

    const getMillis = (dateObj: any) => {
      if (!dateObj) return 0;
      if (dateObj.toMillis) return dateObj.toMillis();
      if (dateObj._seconds) return dateObj._seconds * 1000;
      return 0;
    };

    ledger.sort((a, b) => getMillis(a.date) - getMillis(b.date));

    let running = -historicalDebtAndres;
    for (const row of ledger) {
      running += row.cargo;
      running -= row.abono;
      row.balance = running;
      
      row.dateMillis = getMillis(row.date);
      delete row.date;
    }
    ledger.reverse();

    return {
      totalReceivedKilos,
      totalPurchasesCost,
      totalPagado,
      saldoProveedor,
      ledger
    };
  }

  // Original getActiveMaquilaOrders logic
  const snapshot = await db.collection(COL_ORDERS).get();

  const activeOrders: any[] = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    if (data.isArchived) return;
    const status = data.creditCycle?.status || "pedido";
    if (status === "pedido" || status === "pending" || status === "overdue") {
      const deliveries = data.deliveries || [];
      const totalDelivered = deliveries.reduce((acc: number, d: any) => acc + (d.kilos || 0), 0);
      const totalKilos = data.totalKilograms || 0;
      const pendingKilos = totalKilos - totalDelivered;

      if (pendingKilos > 0) {
        activeOrders.push({
          orderId: doc.id,
          folio: data.folio || "Sin Folio",
          productDescription: data.productDescription || "Producto",
          totalKilos,
          pendingKilos,
        });
      }
    }
  });

  return activeOrders;
});



/** Cache corto de config/financials: el sanitizador se dispara en cascada
 *  (hasta 400 veces en el lote nocturno) y no tiene sentido releer el mismo
 *  documento en cada invocacion. */
let cacheConfig: { valor: FinanceConfigCore; expira: number } | null = null;
let pendingConfigPromise: Promise<FinanceConfigCore> | null = null;

async function readConfigCacheada(): Promise<FinanceConfigCore> {
  if (cacheConfig && Date.now() < cacheConfig.expira) return cacheConfig.valor;
  if (pendingConfigPromise) return pendingConfigPromise;
  
  pendingConfigPromise = readConfig().then(valor => {
    cacheConfig = { valor, expira: Date.now() + 60_000 };
    pendingConfigPromise = null;
    return valor;
  }).catch(err => {
    pendingConfigPromise = null;
    throw err;
  });
  
  return pendingConfigPromise;
}

/** Un ID estable por archivo: reintentos y reprocesos no duplican órdenes. */
const docIdFor = (filePath: string) =>
  createHash("sha1").update(filePath).digest("hex").slice(0, 20);

async function processStorageFile(filePath: string, bucketName?: string) {
  const db = getFirestore();
  const ref = db.collection(COL_ORDERS).doc(docIdFor(filePath));
  
  const isXML = filePath.toLowerCase().endsWith(".xml");
  
  try {
    const bucket = bucketName ? getStorage().bucket(bucketName) : getStorage().bucket();
    const [fileBuffer] = await bucket.file(filePath).download();

    // Módulo XML: Procesamiento directo sin IA
    if (isXML) {
      const xmlStr = fileBuffer.toString("utf-8");
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
      const parsed = parser.parse(xmlStr);
      
      const comprobante = parsed["cfdi:Comprobante"];
      if (!comprobante) throw new Error("No es un CFDI válido (falta cfdi:Comprobante)");
      
      const tipo = comprobante.TipoDeComprobante;
      
      if (tipo === "P") {
        // Es Complemento de Pago
        const complemento = comprobante["cfdi:Complemento"];
        const pagos = complemento ? (complemento["pago20:Pagos"] || complemento["pago10:Pagos"]) : null;
        let pago = pagos ? (pagos["pago20:Pago"] || pagos["pago10:Pago"]) : null;
        
        if (!pago) throw new Error("Complemento de Pago sin nodo de Pago");
        if (!Array.isArray(pago)) pago = [pago]; // Puede haber multiples nodos de pago
        
        const uuids: string[] = [];
        for (const p of pago) {
          let doctosRelacionados = p["pago20:DoctoRelacionado"] || p["pago10:DoctoRelacionado"] || [];
          if (!Array.isArray(doctosRelacionados)) doctosRelacionados = [doctosRelacionados];
          
          for (const d of doctosRelacionados) {
            if (d.IdDocumento) uuids.push(d.IdDocumento.toUpperCase());
          }
        }
        
        if (uuids.length > 0) {
          logger.info(`Buscando facturas para los UUIDs del complemento: ${uuids.join(", ")}`);
          
          let encontradas = 0;
          const chunkSize = 30; // Firestore limit for array-contains-any
          
          for (let i = 0; i < uuids.length; i += chunkSize) {
            const chunk = uuids.slice(i, i + chunkSize);
            const ordersSnapshot = await db.collection(COL_ORDERS).where('invoiceUuids', 'array-contains-any', chunk).get();
            
            for (const doc of ordersSnapshot.docs) {
              const oData = doc.data();
              const invoices = oData.invoices || [];
              let modified = false;
              
              for (const inv of invoices) {
                if (inv.uuid && chunk.includes(inv.uuid.toUpperCase())) {
                  if (!inv.collection) inv.collection = {};
                  inv.collection.complementStatus = 'issued';
                  modified = true;
                  encontradas++;
                }
              }
              
              if (modified) {
                await doc.ref.update({ invoices, updatedAt: FieldValue.serverTimestamp() });
              }
            }
          }
          logger.info(`Complemento procesado. Se marcaron ${encontradas} facturas como 'issued'.`);
        }
      } else if (tipo === "I" || tipo === "E") {
        logger.info(`Procesando XML Factura - Folio: ${comprobante.Folio}`);
        const [metadata] = await bucket.file(filePath).getMetadata();
        const fileHash = metadata?.metadata?.fileHash;

        const receptor = comprobante["cfdi:Receptor"];
        const conceptos = comprobante["cfdi:Conceptos"];
        const complementoNode = comprobante["cfdi:Complemento"];
        let uuid = "";
        if (complementoNode) {
          const tfd = complementoNode["tfd:TimbreFiscalDigital"];
          if (tfd) uuid = tfd.UUID || "";
        }

        const clientName = receptor?.Nombre || "CLIENTE DESCONOCIDO";
        const folio = (comprobante.Serie || "") + (comprobante.Folio || "");
        
        let totalKilos = 0;
        let cfs = conceptos ? (conceptos["cfdi:Concepto"] || []) : [];
        if (!Array.isArray(cfs)) cfs = [cfs];
        
        for (const c of cfs) {
           const qty = Number(c.Cantidad) || 0;
           totalKilos += qty;
        }

        const subtotal = Number(comprobante.SubTotal) || 0;
        const total = Number(comprobante.Total) || 0;
        // La fecha viene como string, ej. "2026-07-27T10:13:06"
        const fecha = comprobante.Fecha ? new Date(comprobante.Fecha) : new Date();

        const invoiceId = db.collection(COL_ORDERS).doc().id;
        
        const newInvoice = {
           id: invoiceId,
           uuid,
           folio,
           kilos: totalKilos,
           creditCycle: {
              issueDate: Timestamp.fromDate(fecha),
              status: "manual_review"
           },
           financials: {
              invoiceTotal: total,
              saleTotal: subtotal,
           }
        };

        const newOrder = {
          id: docIdFor(filePath),
          fileName: filePath,
          fileHash: fileHash ?? "",
          client: clientName,
          folio: folio,
          department: (comprobante.Serie || "").trim(),
          totalKilograms: totalKilos,
          creditCycle: { status: "manual_review" },
          invoices: [newInvoice],
          invoiceStatuses: ["facturado"],
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          processedAt: FieldValue.serverTimestamp(),
        };

        await ref.set(newOrder, { merge: true });
        logger.info(`Expediente creado automáticamente desde XML Ingreso: ${folio} (${clientName})`);
      } else {
        logger.info(`XML ignorado por ahora. Tipo de comprobante: ${tipo}`);
      }
      return;
    }
    
    // Módulo PDF: Creación de expediente en blanco sin IA
    const [metadata] = await bucket.file(filePath).getMetadata();
    const fileHash = metadata?.metadata?.fileHash;

    const newOrder = {
      id: docIdFor(filePath),
      fileName: filePath,
      fileHash: fileHash ?? "",
      creditCycle: { status: "manual_review" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
    };

    logger.info(`Creado expediente vacío en revisión manual para PDF: ${filePath}`);
    await ref.set(newOrder, { merge: true });
    
  } catch (error) {
    // Antes era un `catch (error) { throw error; }` que no aportaba nada.
    // Ahora al menos deja en Cloud Logging QUE archivo fallo: el reintento
    // de onObjectFinalized vuelve a lanzar esto y sin el nombre del archivo
    // no habia forma de saber cual de todos reviento.
    logger.error(`Fallo al procesar ${filePath}`, error);
    throw error;
  }
}
export const parseUploadedPDF = onObjectFinalized(async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType ?? "";

    if (!filePath?.startsWith(UPLOAD_PREFIX)) return;
    
    const isPDF = contentType.startsWith("application/pdf");
    const isXML = contentType.startsWith("application/xml") || contentType.startsWith("text/xml") || filePath.toLowerCase().endsWith(".xml");

    if (!isPDF && !isXML) {
      logger.info(`Ignorado (no es PDF ni XML): ${filePath}`);
      return;
    }

    const db = getFirestore();
    const ref = db.collection(COL_ORDERS).doc(docIdFor(filePath));

    const size = Number(event.data.size) || 0;
    if (size > MAX_UPLOAD_MB * 1024 * 1024) {
      // Deja constancia visible en la interfaz. Un logger.warn en Cloud no lo
      // ve nunca quien subio el archivo.
      const mb = (size / 1024 / 1024).toFixed(1);
      logger.warn(`Ignorado (${mb} MB > ${MAX_UPLOAD_MB} MB): ${filePath}`);
      await ref.set({
        fileName: filePath,
        creditCycle: { status: "manual_review" },
        aiError: `El archivo pesa ${mb} MB y el maximo que se puede leer es ` +
          `${MAX_UPLOAD_MB} MB. Comprimelo o divide el PDF y vuelve a subirlo.`,
        processedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    // Si ya se procesó este archivo, no lo volvemos a cobrar a la cuota de IA.
    const existing = await ref.get();
    if (existing.exists && existing.data()?.creditCycle?.status !== "manual_review") {
      logger.info(`Ya procesado, se omite: ${filePath}`);
      return;
    }

    await processStorageFile(filePath, event.data.bucket);
  },
);

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

/** Reprocesa a mano un PDF que quedó en revisión manual, desde la interfaz. */
// Mismos recursos que parseUploadedPDF: ejecuta exactamente el mismo trabajo.
export const reprocessOrder = onCall(
  { memory: "256MiB", timeoutSeconds: 60 },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
    if (!req.auth?.token?.email_verified) throw new HttpsError("permission-denied", "Tu correo debe estar verificado.");
  
    const db = getFirestore();
    const admin = await db.collection("admins").doc(uid).get();
    if (!admin.exists) throw new HttpsError("permission-denied", "Cuenta no autorizada.");
    const rol = admin.data()?.role;
    if (rol !== "admin" && rol !== "manager") {
      throw new HttpsError("permission-denied", "Tu rol no permite reprocesar ordenes.");
    }

    const orderId = String(req.data?.orderId ?? "");
    if (!orderId) throw new HttpsError("invalid-argument", "Falta orderId.");

    const snap = await db.collection(COL_ORDERS).doc(orderId).get();
    if (!snap.exists) throw new HttpsError("not-found", "La orden no existe.");

    const fileName = snap.data()?.fileName;
    if (!fileName) throw new HttpsError("failed-precondition", "La orden no tiene archivo asociado.");

    try {
      await processStorageFile(fileName);
      return { ok: true };
    } catch (err: any) {
      throw new HttpsError("internal", "Error al reprocesar: " + err.message);
    }
  },
);

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
      const ref = getFirestore().doc('system_settings/global');
      await ref.set({
        cajaChicaBalance: FieldValue.increment(delta)
      }, { merge: true });
      logger.info(`Caja Chica updated by ${delta}`);
    }
  }
);
// forcedeploy
