import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import { getStorage } from "firebase-admin/storage";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { XMLParser } from "fast-xml-parser";
import { createHash } from "crypto";
import { extractDocumentData, geminiApiKey } from "../ai/extractor";
import { COL_ORDERS } from "./shared";
import {
  parseComplementPayments,
  applyComplementPayment,
  receiptKeyForComplement,
  refreshOrderPaymentTotals,
} from "./complementPayments";

// FIX (v8.9.10, split de functions/src/index.ts): todo el procesamiento
// de archivos subidos (PDF/XML -> expediente, vía OCR/XML determinista o
// el Lector Inteligente con Gemini) se extrae tal cual. `reprocessOrder`
// se queda en el mismo archivo porque solo hace una cosa: revalidar rol y
// volver a llamar a `processStorageFile`, la función privada de aquí
// mismo -- separarlo hubiera obligado a exportar processStorageFile solo
// para este uso.

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

/** Un ID estable por archivo: reintentos y reprocesos no duplican órdenes. */
const docIdFor = (filePath: string) =>
  createHash("sha1").update(filePath).digest("hex").slice(0, 20);

/** Convierte una fecha ISO del XML a Timestamp; si no se puede, ahora. */
const toTimestamp = (iso?: string): Timestamp => {
  const d = iso ? new Date(iso) : new Date(NaN);
  return Number.isNaN(d.getTime()) ? Timestamp.now() : Timestamp.fromDate(d);
};

/**
 * Deja una factura procesada por la lógica pura de complementPayments
 * lista para Firestore: convierte sus fechas ISO a Timestamp y elimina
 * claves indefinidas (Firestore las rechaza dentro de un arreglo).
 */
const toFirestoreInvoice = (inv: any): any => {
  const collection = { ...(inv.collection || {}) };
  if (typeof collection.paidAt === "string") {
    collection.paidAt = toTimestamp(collection.paidAt);
  }
  if (Array.isArray(collection.paymentsHistory)) {
    collection.paymentsHistory = collection.paymentsHistory.map((p: any) =>
      typeof p.date === "string" ? { ...p, date: toTimestamp(p.date) } : p
    );
  }
  for (const key of Object.keys(collection)) {
    if (collection[key] === undefined) delete collection[key];
  }
  return { ...inv, collection };
};

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
        // Complemento de Pago: liquida las facturas (parcial o total) con
        // el criterio de la vía portal, no solo las marca como 'issued'.
        // Idempotente por recibo CFDI_<uuidComplemento>_<invoiceId> en
        // payment_receipts: reprocesar el mismo complemento no duplica.
        const complementoDoc = parseComplementPayments(comprobante);
        const allocations = complementoDoc.payments;
        if (allocations.length === 0) {
          logger.warn(`Complemento de Pago sin documentos relacionados: ${filePath}`);
        } else {
          const uuids = [...new Set(allocations.map((a) => a.uuid))];
          logger.info(`Buscando facturas para los UUIDs del complemento: ${uuids.join(", ")}`);
          let aplicadas = 0;
          let duplicadas = 0;
          let omitidas = 0;
          const chunkSize = 30; // Firestore limit for array-contains-any
          for (let i = 0; i < uuids.length; i += chunkSize) {
            const chunk = uuids.slice(i, i + chunkSize);
            const ordersSnapshot = await db
              .collection(COL_ORDERS)
              .where("invoiceUuids", "array-contains-any", chunk)
              .get();
            for (const orderDoc of ordersSnapshot.docs) {
              const counts = await db.runTransaction(async (txn) => {
                const snap = await txn.get(orderDoc.ref);
                if (!snap.exists) return { aplicadas: 0, duplicadas: 0, omitidas: 0 };
                const oData = snap.data() as any;
                const invoices = [...(oData.invoices || [])];
                let modified = false;
                let cAplicadas = 0;
                let cDuplicadas = 0;
                let cOmitidas = 0;
                for (let idx = 0; idx < invoices.length; idx++) {
                  const inv = invoices[idx];
                  if (!inv.uuid) continue;
                  const matching = allocations.filter(
                    (a) => a.uuid === inv.uuid.toUpperCase()
                  );
                  if (matching.length === 0) continue;
                  for (const allocation of matching) {
                    const receiptKey = receiptKeyForComplement(complementoDoc.uuid, inv.id);
                    const receiptRef = db.collection("payment_receipts").doc(receiptKey);
                    const receiptSnap = await txn.get(receiptRef);
                    const historyKeys = new Set<string>(
                      (invoices[idx].collection?.paymentsHistory || [])
                        .map((p: any) => p.receiptId)
                        .filter(Boolean)
                    );
                    const result = applyComplementPayment(
                      invoices[idx],
                      allocation,
                      complementoDoc.uuid,
                      complementoDoc.fechaPago,
                      receiptSnap.exists ? new Set([receiptKey]) : historyKeys
                    );
                    if (result.applied) {
                      invoices[idx] = toFirestoreInvoice(result.invoice);
                      if (!receiptSnap.exists) {
                        txn.set(receiptRef, {
                          receiptKey,
                          orderId: orderDoc.id,
                          invoiceId: inv.id,
                          invoiceFolio: inv.folio || "",
                          invoiceUuid: allocation.uuid,
                          complementUuid: complementoDoc.uuid || "",
                          amount: allocation.impPagado,
                          paymentDate: toTimestamp(complementoDoc.fechaPago),
                          status: "applied",
                          appliedBy: "sistema-cfdi",
                          source: "complemento_pago",
                          appliedAt: FieldValue.serverTimestamp(),
                        });
                      }
                      cAplicadas++;
                      modified = true;
                    } else if (result.skippedReason === "duplicate") {
                      cDuplicadas++;
                      if (invoices[idx].collection?.complementStatus !== "issued") {
                        invoices[idx] = {
                          ...invoices[idx],
                          collection: { ...invoices[idx].collection, complementStatus: "issued" },
                        };
                        modified = true;
                      }
                    } else {
                      cOmitidas++;
                      logger.warn(
                        `Complemento no aplicado a factura ${inv.folio || inv.id}: ${result.skippedReason}`
                      );
                      if (invoices[idx].collection?.complementStatus !== "issued") {
                        invoices[idx] = {
                          ...invoices[idx],
                          collection: { ...invoices[idx].collection, complementStatus: "issued" },
                        };
                        modified = true;
                      }
                    }
                  }
                }
                if (modified) {
                  const totals = refreshOrderPaymentTotals(invoices);
                  const invoiceUuids = [
                    ...new Set([
                      ...(oData.invoiceUuids || []),
                      ...invoices
                        .map((v: any) => String(v.uuid || "").toUpperCase())
                        .filter(Boolean),
                    ]),
                  ];
                  txn.update(orderDoc.ref, {
                    invoices,
                    invoiceStatuses: invoices.map(
                      (v: any) => v.creditCycle?.status || "manual_review"
                    ),
                    invoiceUuids,
                    "collection.paidAmount": totals.paidAmount,
                    ...(totals.allSettled
                      ? { "creditCycle.status": "paid", status: "paid" }
                      : {}),
                    updatedAt: FieldValue.serverTimestamp(),
                  });
                }
                return { aplicadas: cAplicadas, duplicadas: cDuplicadas, omitidas: cOmitidas };
              });
              aplicadas += counts.aplicadas;
              duplicadas += counts.duplicadas;
              omitidas += counts.omitidas;
            }
          }
          logger.info(
            `Complemento procesado: ${aplicadas} abonos aplicados, ${duplicadas} duplicados omitidos, ${omitidas} omitidos.`
          );
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
          // Sin este índice, un complemento posterior no encontraría esta
          // factura (la búsqueda es por invoiceUuids, array-contains-any).
          invoiceUuids: uuid ? [uuid.toUpperCase()] : [],
          invoiceStatuses: [newInvoice.creditCycle.status || "manual_review"],
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
    
    // Módulo PDF: Lector Inteligente Universal.
    //
    // FIX (v8.9.8, MEJORAS_FUTURAS.txt #6 "Lector Inteligente Universal"):
    // antes este camino SIEMPRE creaba un expediente completamente en
    // blanco -- el Lector Inteligente (Gemini) ya existía y funcionaba
    // (parseDocumentData / GenAIReader.tsx), pero solo estaba conectado al
    // autocompletado manual de Captura Rápida, nunca a la subida
    // automática de PDFs (`/subir`), que es donde el roadmap decía
    // explícitamente que debía vivir. Ahora se intenta extraer folio,
    // entidad, kilos, conceptos y (si es una factura) los importes con la
    // misma función compartida `extractDocumentData()`. Si Gemini falla,
    // tarda demasiado o no trae nada usable, cae exactamente al mismo
    // expediente en blanco de antes -- la IA nunca bloquea la subida ni
    // inventa datos financieros como si fueran reales: todo queda en
    // "manual_review" para que un humano lo confirme antes de facturar o
    // cobrar nada, igual que ya pasaba con el XML.
    const [metadata] = await bucket.file(filePath).getMetadata();
    const fileHash = metadata?.metadata?.fileHash;

    const newOrder: Record<string, unknown> = {
      id: docIdFor(filePath),
      fileName: filePath,
      fileHash: fileHash ?? "",
      creditCycle: { status: "manual_review" },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      processedAt: FieldValue.serverTimestamp(),
    };

    let extracted: Awaited<ReturnType<typeof extractDocumentData>> | null = null;
    try {
      extracted = await extractDocumentData(fileBuffer.toString("base64"), "application/pdf");
    } catch (aiError: any) {
      logger.warn(`Lector Inteligente no pudo leer ${filePath} -- se deja en revisión manual sin datos precargados: ${aiError?.message || aiError}`);
    }

    if (extracted) {
      if (extracted.entidad) newOrder.client = extracted.entidad;
      if (extracted.folio) newOrder.folio = extracted.folio;
      if (extracted.kilosTotales) newOrder.totalKilograms = extracted.kilosTotales;
      if (Array.isArray(extracted.conceptos) && extracted.conceptos.length > 0) {
        newOrder.items = extracted.conceptos.map((c: any, i: number) => ({
          id: `ai-${i}`,
          quantity: c.cantidad || 0,
          unit: "kg",
          description: c.descripcion || "",
          unitPrice: c.precioUnitario || 0,
          amount: c.importe || 0,
        }));
      }
      if (extracted.tipoDocumento === "factura" && (extracted.total || extracted.subtotal)) {
        const invoiceId = db.collection(COL_ORDERS).doc().id;
        const newInvoice = {
          id: invoiceId,
          folio: extracted.folio || "",
          kilos: extracted.kilosTotales || 0,
          creditCycle: { status: "manual_review" },
          financials: {
            invoiceTotal: extracted.total || 0,
            saleTotal: extracted.subtotal || 0,
          },
        };
        newOrder.invoices = [newInvoice];
        newOrder.invoiceStatuses = ["manual_review"];
      }
      logger.info(`Lector Inteligente extrajo datos de ${filePath}: folio=${extracted.folio || "?"}, entidad=${extracted.entidad || "?"}, tipo=${extracted.tipoDocumento || "?"}.`);
    } else {
      logger.info(`Creado expediente vacío en revisión manual para PDF: ${filePath}`);
    }

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
export const parseUploadedPDF = onObjectFinalized({ bucket: "control-de-bolsas-89c88.firebasestorage.app", secrets: [geminiApiKey], memory: "512MiB", timeoutSeconds: 120 }, async (event) => {
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

export const reprocessOrder = onCall(
  { secrets: [geminiApiKey], memory: "512MiB", timeoutSeconds: 120 },
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
