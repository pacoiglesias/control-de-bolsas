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
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineSecret } from "firebase-functions/params";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";

initializeApp();

// Configuración global apuntando a us-east1 para que coincida con tu Storage
setGlobalOptions({ region: "us-east1", maxInstances: 10 });

const apiKeySecret = defineSecret("GOOGLE_GENAI_API_KEY");

/** Cámbialo si Google retira el modelo; el resto del código no se toca. */
const MODEL = "googleai/gemini-2.0-flash";

const UPLOAD_PREFIX = "uploads/";
const COL_ORDERS = "purchaseOrders";

const DEFAULTS = {
  salePricePerKg: 47,
  costPricePerKg: 42,
  commissionRate: 0.069,
  creditDays: 30,
  ivaRate: 0.16,
  commissionBase: "subtotal" as "subtotal" | "total",
};

const DocumentSchema = z.object({
  docType: z.enum(["orden_compra", "factura", "contrarecibo"]).describe("Determina si el documento es Orden de Compra, Factura, o Contra Recibo."),
  folio: z.string().describe("Número de folio del documento"),
  uuid: z.string().optional().describe("Si es factura, el UUID (Folio Fiscal) de 36 caracteres."),
  ocReference: z.string().optional().describe("Si es factura, el número de la OC a la que hace referencia."),
  paymentDate: z.string().optional().describe("Si es contrarecibo, la fecha programada de pago (YYYY-MM-DD)"),
  crInvoices: z.array(z.string()).optional().describe("Si es contrarecibo, lista de facturas que agrupa (solo los números)"),
  totalKilograms: z.number().describe("Suma de Kilogramos totales del documento"),
  totalAmount: z.number().optional().describe("Si es factura, el monto total (con IVA)."),
  client: z.string().optional().describe("Nombre o clave del cliente"),
  items: z.array(z.object({
    quantity: z.number().describe("Cantidad numérica"),
    unit: z.string().describe("Unidad de medida (ej. Kilos, Bulto, Millar, Pza)"),
    description: z.string().describe("Descripción del artículo o concepto"),
    unitPrice: z.number().describe("Precio unitario"),
    amount: z.number().describe("Importe total de esta partida")
  })).optional().describe("Lista detallada de artículos (partidas) del documento"),
});

/** Un ID estable por archivo: reintentos y reprocesos no duplican órdenes. */
const docIdFor = (filePath: string) =>
  createHash("sha1").update(filePath).digest("hex").slice(0, 20);

async function readConfig() {
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

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Idéntica a src/lib/finance.ts en el frontend. Si cambias una, cambia la otra. */
function computeFinancials(kilos: number, cfg: typeof DEFAULTS) {
  const saleTotal = round2(kilos * cfg.salePricePerKg);
  const invoiceTotal = round2(saleTotal * (1 + cfg.ivaRate));
  const costTotal = round2(kilos * cfg.costPricePerKg);
  const base = cfg.commissionBase === "total" ? invoiceTotal : saleTotal;
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
        
        let uuids: string[] = [];
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
            let ordersSnapshot = await db.collection(COL_ORDERS).where('invoiceUuids', 'array-contains-any', chunk).get();
            
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
      } else {
        logger.info(`XML ignorado por ahora. Tipo de comprobante: ${tipo}`);
      }
      return;
    }

    // Módulo PDF: Inteligencia Artificial
    const pdfBuffer = fileBuffer;
    const ai = genkit({ plugins: [googleAI({ apiKey: apiKeySecret.value() })] });
    const aiResponse = await ai.generate({
      model: MODEL,
      prompt: [
        {
          text:
            "Eres un auditor contable experto. Clasifica este documento como 'orden_compra', 'factura' o 'contrarecibo'. " +
            "Extrae el folio, cliente, y el total de kilogramos. " +
            "Si es una factura, extrae también el UUID (Folio Fiscal), el monto total con IVA, y el número de la OC a la que hace referencia. " +
            "Si es un contrarecibo, extrae la fecha de pago programada (paymentDate en YYYY-MM-DD) y TODOS los números de factura (crInvoices) que están siendo pagados o agrupados. " +
            "MUY IMPORTANTE: En OC o Facturas, extrae el detalle de todos los artículos (partidas) en la tabla central " +
            "con su cantidad, unidad de medida, descripción, precio unitario e importe total. " +
            "Todos los números deben ir sin comas.",
        },
        {
          media: {
            contentType: "application/pdf",
            url: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
          },
        },
      ],
      output: { schema: DocumentSchema },
    });

    const data = aiResponse.output;
    if (!data) {
      throw new Error("La IA no devolvió datos estructurados");
    }
    
    // Si no es contrarecibo, esperamos que tenga kilos válidos.
    if (data.docType !== 'contrarecibo' && (!Number.isFinite(data.totalKilograms) || data.totalKilograms <= 0)) {
      throw new Error("La IA no devolvió kilos válidos");
    }

    const cfg = await readConfig();
    const issueDate = new Date();
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + cfg.creditDays);

    if (data.docType === 'factura') {
      const ocRefMatch = String(data.ocReference).replace(/\D/g, '');
      let ocQuery = await db.collection(COL_ORDERS).where('folio', '==', data.ocReference).limit(1).get();
      if (ocQuery.empty && ocRefMatch) {
        // Fallback searching just by the digits
        ocQuery = await db.collection(COL_ORDERS).where('folio', '==', ocRefMatch).limit(1).get();
      }

      if (ocQuery.empty) {
        throw new Error(`Es factura pero no se encontró la OC original: ${data.ocReference}`);
      }

      const ocDoc = ocQuery.docs[0];
      const ocData = ocDoc.data();
      const invoices: any[] = Array.isArray(ocData.invoices) ? ocData.invoices : [];
      const exists = invoices.some(inv => inv.folio === data.folio || (data.uuid && inv.uuid === data.uuid));

      if (exists) {
        logger.info(`Factura ${data.folio} ya existe en OC ${ocData.folio}. Se ignora.`);
      } else {
        const fin = computeFinancials(data.totalKilograms, cfg);
        const newInvoice = {
          id: docIdFor(filePath),
          folio: data.folio,
          uuid: data.uuid ?? "",
          kilos: data.totalKilograms,
          financials: {
            ...fin,
            invoiceTotal: data.totalAmount ?? fin.invoiceTotal
          },
          creditCycle: {
            issueDate: Timestamp.fromDate(issueDate),
            dueDate: Timestamp.fromDate(dueDate),
            status: "pending",
          }
        };
        await ocDoc.ref.update({
          invoices: FieldValue.arrayUnion(newInvoice),
          invoiceStatuses: FieldValue.arrayUnion("pending"),
          ...(data.uuid ? { invoiceUuids: FieldValue.arrayUnion(data.uuid.toUpperCase()) } : {}),
          updatedAt: FieldValue.serverTimestamp()
        });
        logger.info(`Factura ${data.folio} agregada a OC ${ocData.folio}`);
      }
    } else if (data.docType === 'contrarecibo') {
      if (!data.crInvoices || data.crInvoices.length === 0) {
        throw new Error("El contrarecibo no contiene números de factura identificables.");
      }
      
      let encontradas = 0;
      let dueDate: Date | null = null;
      if (data.paymentDate) {
        const parts = data.paymentDate.split("-");
        if (parts.length === 3) {
          // Asumimos YYYY-MM-DD
          dueDate = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
        }
      }

      // Buscar en los pedidos activos (pending/overdue) las facturas agrupadas
      const snapshot = await db.collection(COL_ORDERS)
        .where("invoiceStatuses", "array-contains-any", ["pending", "overdue"])
        .get();
      
      const targetFolios = data.crInvoices.map(f => String(f).replace(/\D/g, ''));

      for (const doc of snapshot.docs) {
        const oData = doc.data();
        const invoices = oData.invoices || [];
        let modified = false;

        for (const inv of invoices) {
          const invFolio = String(inv.folio).replace(/\D/g, '');
          if (invFolio && targetFolios.includes(invFolio)) {
            if (!inv.collection) inv.collection = {};
            inv.collection.contrareciboNumber = data.folio;
            if (dueDate && !Number.isNaN(dueDate.getTime())) {
              inv.creditCycle.dueDate = Timestamp.fromDate(dueDate);
            }
            modified = true;
            encontradas++;
          }
        }

        if (modified) {
          await doc.ref.update({ invoices, updatedAt: FieldValue.serverTimestamp() });
        }
      }

      if (encontradas === 0) {
        throw new Error(`Es el contrarecibo ${data.folio} pero no se halló en BD ninguna de estas facturas: ${data.crInvoices.join(', ')}`);
      }
      
      logger.info(`Contrarecibo ${data.folio} procesado. Se vincularon ${encontradas} facturas.`);
      
      // Registrar el archivo procesado para evitar reprocesamiento y no ensuciar la base de órdenes con OCs falsas
      await ref.set({
        fileName: filePath,
        folio: data.folio,
        client: data.client ?? "",
        docType: "contrarecibo",
        aiError: FieldValue.delete(),
        processedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      // Es Orden de Compra
      await ref.set(
        {
          fileName: filePath,
          folio: data.folio,
          client: data.client ?? "",
          totalKilograms: data.totalKilograms,
          items: (data.items || []).map((it: any, i: number) => ({
            id: Date.now().toString() + "-" + i,
            quantity: it.quantity,
            unit: it.unit,
            description: it.description,
            unitPrice: it.unitPrice,
            amount: it.amount
          })),
          financials: computeFinancials(data.totalKilograms, cfg),
          creditCycle: {
            issueDate: Timestamp.fromDate(issueDate),
            dueDate: Timestamp.fromDate(dueDate),
            status: "pending",
          },
          invoiceStatuses: ["pending"],
          processedAt: FieldValue.serverTimestamp(),
          aiError: FieldValue.delete(),
        },
        { merge: true },
      );
      logger.info(`OK ${filePath} → OC folio ${data.folio}, ${data.totalKilograms} kg`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Fallo de lectura en ${filePath}: ${message}`);
    await ref.set(
      {
        fileName: filePath,
        creditCycle: { status: "manual_review" },
        aiError: message.slice(0, 500),
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    throw error;
  }
}


export const parseUploadedPDF = onObjectFinalized(
  { secrets: [apiKeySecret], memory: "1GiB", timeoutSeconds: 300 },
  async (event) => {
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
      .where("invoiceStatuses", "array-contains-any", ["pending", "overdue"])
      .get();

    // OJO: los expedientes creados ANTES de que existiera invoiceStatuses no
    // tienen ese campo, y array-contains-any los deja fuera: quedarian sin
    // vigilancia y sin dar error. Se cuentan aparte y se avisa en el log.
    // migrarInvoiceStatuses() los repara de una pasada.
    const sinCampo = await db.collection(COL_ORDERS)
      .where("invoiceStatuses", "==", null)
      .count()
      .get()
      .then((r) => r.data().count)
      .catch(() => 0);
    if (sinCampo > 0) {
      logger.warn(
        `${sinCampo} expediente(s) sin invoiceStatuses quedan fuera de la ` +
        `revision de vencidos. Ejecuta migrarInvoiceStatuses para repararlos.`,
      );
    }

    if (snapshot.empty) {
      logger.info("No hay expedientes que revisar.");
      return;
    }

    const yaVencio = (cc?: { status?: string; dueDate?: Timestamp | null }) =>
      !!cc && cc.status === "pending" && !!cc.dueDate &&
      cc.dueDate.toMillis() < ahora.toMillis();

    const cambios: { ref: FirebaseFirestore.DocumentReference; datos: Record<string, unknown> }[] = [];

    snapshot.docs.forEach((d: QueryDocumentSnapshot) => {
      const data = d.data();
      const datos: Record<string, unknown> = {};

      // a) Expedientes viejos: el ciclo vive en la raiz del documento.
      if (yaVencio(data.creditCycle)) datos["creditCycle.status"] = "overdue";

      // b) Modelo nuevo: cada factura trae su ciclo dentro del arreglo.
      const invoices: Record<string, unknown>[] = Array.isArray(data.invoices) ? data.invoices : [];
      let tocado = false;
      const actualizadas = invoices.map((inv) => {
        const cc = inv.creditCycle as { status?: string; dueDate?: Timestamp | null } | undefined;
        if (yaVencio(cc)) {
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

    if (cambios.length === 0) {
      logger.info("Sin facturas vencidas hoy.");
      return;
    }
    for (let i = 0; i < cambios.length; i += 400) {
      const batch = db.batch();
      cambios.slice(i, i + 400).forEach((c) => batch.update(c.ref, c.datos));
      await batch.commit();
    }
    logger.info(`${cambios.length} expedientes con facturas vencidas actualizados.`);
  },
);

// migrarInvoiceStatuses eliminada para evitar conflicto IAM

/** Reprocesa a mano un PDF que quedó en revisión manual, desde la interfaz. */
export const reprocessOrder = onCall({ secrets: [apiKeySecret] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
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
});



