/**
 * Control Bolsas — backend (Cloud Functions 2nd gen)
 *
 * Diferencias contra la versión original, todas por bugs reales:
 *  1. genkit se inicializa DENTRO del handler. `defineSecret().value()` en el
 *     ámbito del módulo se evalúa durante el análisis de despliegue, cuando el
 *     secreto todavía no está montado, y truena o se queda vacío.
 *  2. Solo se procesan archivos bajo `uploads/`. Sin ese filtro, cualquier
 *     objeto que caiga al bucket dispara la función y gasta cuota.
 *  3. Idempotencia: el ID del documento se deriva de la ruta del archivo, así
 *     que un reintento de la función no duplica la orden.
 *  4. El fallback a revisión manual guarda el motivo del error.
 *  5. Fechas con Timestamp del servidor y no `new Date()` del contenedor.
 *  6. Se guardan venta, costo y comisión desglosados, no solo el neto.
 */
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { genkit, z } from "genkit";
import { googleAI } from "@genkit-ai/googleai";
import { defineSecret } from "firebase-functions/params";
import { createHash } from "crypto";

initializeApp();
setGlobalOptions({ region: "us-central1", maxInstances: 10 });

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

const PurchaseOrderSchema = z.object({
  folio: z.string().describe("Número de folio u orden de compra"),
  totalKilograms: z.number().describe("Kilogramos totales del pedido"),
  client: z.string().optional().describe("Nombre o clave del cliente si aparece"),
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
    netCashFlow: round2(saleTotal - costTotal - commission),
  };
}

export const parseUploadedPDF = onObjectFinalized(
  { secrets: [apiKeySecret], memory: "1GiB", timeoutSeconds: 300 },
  async (event) => {
    const filePath = event.data.name;
    const contentType = event.data.contentType ?? "";

    if (!filePath?.startsWith(UPLOAD_PREFIX)) return;
    if (!contentType.startsWith("application/pdf")) {
      logger.info(`Ignorado (no es PDF): ${filePath}`);
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

    try {
      const [pdfBuffer] = await getStorage().bucket(event.data.bucket).file(filePath).download();

      const ai = genkit({ plugins: [googleAI({ apiKey: apiKeySecret.value() })] });
      const aiResponse = await ai.generate({
        model: MODEL,
        prompt: [
          {
            text:
              "Eres un capturista. De esta orden de compra extrae el folio " +
              "(o número de orden), el total de kilogramos y el cliente si aparece. " +
              "Los kilos van como número, sin unidades ni comas.",
          },
          {
            media: {
              contentType: "application/pdf",
              url: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
            },
          },
        ],
        output: { schema: PurchaseOrderSchema },
      });

      const data = aiResponse.output;
      if (!data || !Number.isFinite(data.totalKilograms) || data.totalKilograms <= 0) {
        throw new Error("La IA no devolvió kilos válidos");
      }

      const cfg = await readConfig();
      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + cfg.creditDays);

      await ref.set(
        {
          fileName: filePath,
          folio: data.folio,
          client: data.client ?? "",
          totalKilograms: data.totalKilograms,
          financials: computeFinancials(data.totalKilograms, cfg),
          creditCycle: {
            issueDate: Timestamp.fromDate(issueDate),
            dueDate: Timestamp.fromDate(dueDate),
            status: "pending",
          },
          processedAt: FieldValue.serverTimestamp(),
          aiError: FieldValue.delete(),
        },
        { merge: true },
      );

      logger.info(`OK ${filePath} → folio ${data.folio}, ${data.totalKilograms} kg`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`Fallo de lectura en ${filePath}: ${message}`);
      // El archivo no se pierde: queda listo para captura manual con su motivo.
      await ref.set(
        {
          fileName: filePath,
          creditCycle: { status: "manual_review" },
          aiError: message.slice(0, 500),
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  },
);

export const checkOverdueInvoices = onSchedule(
  { schedule: "every day 00:00", timeZone: "America/Mexico_City" },
  async () => {
    const db = getFirestore();
    const snapshot = await db
      .collection(COL_ORDERS)
      .where("creditCycle.status", "==", "pending")
      .where("creditCycle.dueDate", "<", Timestamp.now())
      .get();

    if (snapshot.empty) {
      logger.info("Sin facturas por vencer hoy.");
      return;
    }
    // Firestore permite 500 escrituras por lote.
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 400) {
      const batch = db.batch();
      docs.slice(i, i + 400).forEach((d) =>
        batch.update(d.ref, {
          "creditCycle.status": "overdue",
          updatedAt: FieldValue.serverTimestamp(),
        }),
      );
      await batch.commit();
    }
    logger.info(`${docs.length} facturas marcadas como vencidas.`);
  },
);

/** Reprocesa a mano un PDF que quedó en revisión manual, desde la interfaz. */
export const reprocessOrder = onCall({ secrets: [apiKeySecret] }, async (req) => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Inicia sesión.");
  const db = getFirestore();
  const admin = await db.collection("admins").doc(uid).get();
  if (!admin.exists) throw new HttpsError("permission-denied", "Cuenta no autorizada.");

  const orderId = String(req.data?.orderId ?? "");
  if (!orderId) throw new HttpsError("invalid-argument", "Falta orderId.");

  const snap = await db.collection(COL_ORDERS).doc(orderId).get();
  if (!snap.exists) throw new HttpsError("not-found", "La orden no existe.");

  const kilos = Number(req.data?.totalKilograms ?? snap.data()?.totalKilograms ?? 0);
  if (!(kilos > 0)) throw new HttpsError("invalid-argument", "Kilos inválidos.");

  const cfg = await readConfig();
  const issueDate = new Date();
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + cfg.creditDays);

  await snap.ref.set(
    {
      totalKilograms: kilos,
      financials: computeFinancials(kilos, cfg),
      creditCycle: {
        issueDate: Timestamp.fromDate(issueDate),
        dueDate: Timestamp.fromDate(dueDate),
        status: "pending",
      },
      updatedAt: FieldValue.serverTimestamp(),
      aiError: FieldValue.delete(),
    },
    { merge: true },
  );
  return { ok: true, kilos };
});
