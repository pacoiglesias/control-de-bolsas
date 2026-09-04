import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { loggerPro } from "../../utils/logging";
import { validateSchema } from "../../middleware/validation";
import { ensureAuthenticated } from "../../middleware/auth";
import { facturaSchema, type FacturaInput } from "./validators";

// ────────────────────────────────────────────────────────────────────────────
// validateInvoiceData — helper de validación pura (sin efecto secundario).
// Usado internamente y desde tests unitarios.
// ────────────────────────────────────────────────────────────────────────────
export function validateInvoiceData(rawInvoice: unknown): FacturaInput {
  loggerPro.info("Validando factura CFDI...", { rawInvoice });
  const validated = validateSchema(facturaSchema, rawInvoice);
  loggerPro.info(`Factura ${validated.invoiceNumber} validada exitosamente.`);
  return validated;
}

// ────────────────────────────────────────────────────────────────────────────
// validateInvoiceCFDI — Cloud Function callable.
//
// Recibe los datos de una factura desde el cliente, los valida con Zod
// y los persiste en la sub-colección invoices del expediente correspondiente.
// Requiere usuario autenticado.
//
// Payload esperado: FacturaInput (ver validators.ts)
// Respuesta: { invoiceId: string, invoiceNumber: string }
// ────────────────────────────────────────────────────────────────────────────
export const validateInvoiceCFDI = onCall(
  { region: "us-east1" },
  async (request) => {
    ensureAuthenticated(request);

    let validated: FacturaInput;
    try {
      validated = validateInvoiceData(request.data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Datos de factura inválidos";
      throw new HttpsError("invalid-argument", msg);
    }

    const db = getFirestore();

    // Verificar que el expediente (purchaseOrder) existe.
    const ordersSnap = await db
      .collection("purchaseOrders")
      .where("folio", "==", validated.orderFolio)
      .limit(1)
      .get();

    if (ordersSnap.empty) {
      throw new HttpsError(
        "not-found",
        `No se encontró el expediente con folio "${validated.orderFolio}".`,
      );
    }

    const orderRef = ordersSnap.docs[0].ref;

    // Persistir la factura en la sub-colección del expediente.
    const invoiceRef = await orderRef.collection("invoices").add({
      ...validated,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: request.auth!.uid,
    });

    loggerPro.info(
      `Factura ${validated.invoiceNumber} registrada en expediente ${validated.orderFolio} (docId: ${invoiceRef.id}).`,
    );

    return { invoiceId: invoiceRef.id, invoiceNumber: validated.invoiceNumber };
  },
);

// ────────────────────────────────────────────────────────────────────────────
// getInvoicesByOrder — Cloud Function callable.
//
// Devuelve todas las facturas de un expediente dado su folio.
// Requiere usuario autenticado.
// ────────────────────────────────────────────────────────────────────────────
export const getInvoicesByOrder = onCall(
  { region: "us-east1" },
  async (request) => {
    ensureAuthenticated(request);

    const folio = request.data?.folio as string | undefined;
    if (!folio) {
      throw new HttpsError("invalid-argument", "El campo 'folio' es obligatorio.");
    }

    const db = getFirestore();

    const ordersSnap = await db
      .collection("purchaseOrders")
      .where("folio", "==", folio)
      .limit(1)
      .get();

    if (ordersSnap.empty) {
      throw new HttpsError("not-found", `No se encontró el expediente con folio "${folio}".`);
    }

    const invoicesSnap = await ordersSnap.docs[0].ref
      .collection("invoices")
      .orderBy("createdAt", "desc")
      .get();

    return {
      folio,
      invoices: invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  },
);
