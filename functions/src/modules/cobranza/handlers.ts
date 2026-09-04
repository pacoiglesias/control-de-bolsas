import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import { FieldValue, Timestamp, getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { validateSchema } from "../../middleware/validation";
import { contrareciboSchema, type ContrareciboInput } from "./validators";

const COL_ORDERS = "purchaseOrders";

// ────────────────────────────────────────────────────────────────────────────
// validateContrarecibo — helper de validación para uso desde HTTP/callable
// ────────────────────────────────────────────────────────────────────────────
export function validateContrarecibo(rawCr: unknown): ContrareciboInput {
  return validateSchema(contrareciboSchema, rawCr);
}

// ────────────────────────────────────────────────────────────────────────────
// checkOverdueInvoices — scheduled daily at midnight (Mexico City)
//
// REGLA DE NEGOCIO: una factura SIN contrarecibo no puede estar vencida.
// El plazo de crédito arranca cuando Providencia emite el CR, no cuando
// se envía la factura a revisión. Sin esto, las facturas en revisión se
// marcaban "overdue" al día siguiente de su emisión e inflaban "Vencido"
// del panel por su monto completo (ver Ciclo 33 en AUDIT_NOTEBOOK.md).
// ────────────────────────────────────────────────────────────────────────────
export const checkOverdueInvoices = onSchedule(
  { schedule: "every day 00:00", timeZone: "America/Mexico_City" },
  async () => {
    const db = getFirestore();
    const ahora = Timestamp.now();

    // Se filtra por el arreglo desnormalizado para no recorrer toda la base.
    const snapshot = await db
      .collection(COL_ORDERS)
      .where("invoiceStatuses", "array-contains", "pending")
      .get();

    // Los expedientes creados ANTES de que existiera invoiceStatuses no tienen
    // ese campo y la consulta de arriba los deja fuera. La forma barata de
    // detectarlos es comparar totales con un count de la colección completa.
    const [totalExpedientes, conCampo] = await Promise.all([
      db
        .collection(COL_ORDERS)
        .count()
        .get()
        .then((r) => r.data().count)
        .catch(() => -1),
      db
        .collection(COL_ORDERS)
        .where("invoiceStatuses", "!=", null)
        .count()
        .get()
        .then((r) => r.data().count)
        .catch(() => -1),
    ]);
    if (totalExpedientes >= 0 && conCampo >= 0 && totalExpedientes > conCampo) {
      logger.warn(
        `${totalExpedientes - conCampo} expediente(s) sin invoiceStatuses ` +
          `quedan fuera de la revisión de vencidos. Se reparan solos al abrirlos ` +
          `y guardarlos una vez desde la interfaz.`,
      );
    }

    if (snapshot.empty) {
      logger.info("No hay expedientes que revisar.");
      return;
    }

    const yaVencio = (
      cc?: { status?: string; dueDate?: Timestamp | null },
      tieneCr?: boolean,
    ) =>
      !!cc &&
      cc.status === "pending" &&
      !!cc.dueDate &&
      !!tieneCr &&
      cc.dueDate.toMillis() < ahora.toMillis();

    const cambios: { ref: FirebaseFirestore.DocumentReference; datos: Record<string, unknown> }[] =
      [];

    snapshot.docs.forEach((d: QueryDocumentSnapshot) => {
      const data = d.data();
      const datos: Record<string, unknown> = {};
      const crDelExpediente = !!data.collection?.contrareciboNumber;

      // a) Expedientes viejos: el ciclo vive en la raíz del documento.
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

    // REPARACIÓN de datos corrompidos por el bug anterior: facturas que
    // quedaron marcadas "overdue" sin tener contrarecibo.
    const snapshotVencidas = await db
      .collection(COL_ORDERS)
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
            invoiceStatuses: reparadas.map(
              (inv) =>
                (inv.creditCycle as { status?: string } | undefined)?.status ?? "pending",
            ),
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

    // Aviso de vencimiento: renglon en system_logs, buscable desde /logs.
    const folios = snapshot.docs
      .filter((d) => cambios.some((c) => c.ref.id === d.id))
      .map((d) => d.data().folio || d.id)
      .slice(0, 50);
    await db.collection("system_logs").add({
      user: "sistema (checkOverdueInvoices)",
      action: "Facturas Vencidas (automático)",
      details: { cantidad: cambios.length, folios },
      timestamp: FieldValue.serverTimestamp(),
    });

    logger.info(`${cambios.length} expedientes con facturas vencidas actualizados.`);
  },
);
