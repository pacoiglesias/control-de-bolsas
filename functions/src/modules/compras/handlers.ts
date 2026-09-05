import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  computeFinancials,
  configEfectiva,
  round2,
  type FinanceConfigCore,
} from "../../shared/finance.core";
import { validateSchema } from "../../middleware/validation";
import { compraSchema, type CompraInput } from "./validators";

const COL_ORDERS = "purchaseOrders";

// ── Defaults de configuración financiera ─────────────────────────────────────
// Los valores en DEFAULT_CONFIG deben coincidir con src/lib/types.ts.
const DEFAULTS = {
  salePricePerKg: 43,    // 2026-08-10: bajó de 47 a 43 (confirmado por el usuario)
  costPricePerKg: 38,
  commissionRate: 0.08,  // 8% sobre el SUBTOTAL (verificado contra cobros reales)
  creditDays: 30,
  ivaRate: 0.16,
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

// ────────────────────────────────────────────────────────────────────────────
// processPurchaseOrder — helper de validación para uso desde HTTP/callable
// ────────────────────────────────────────────────────────────────────────────
export function processPurchaseOrder(rawOrder: unknown): CompraInput {
  return validateSchema(compraSchema, rawOrder);
}

// ────────────────────────────────────────────────────────────────────────────
// sanitizePurchaseOrder — trigger de saneamiento y recálculo server-side.
//
// Impide que importes alterados desde las herramientas del navegador queden
// persistidos, PERO respeta dos cosas que sí son datos legítimos:
//   - los costos y comisiones propios del expediente (Costos variables)
//   - el total real de una factura timbrada (viene del CFDI, no de la fórmula)
// ────────────────────────────────────────────────────────────────────────────
export const sanitizePurchaseOrder = onDocumentWritten(
  { document: `${COL_ORDERS}/{orderId}` },
  async (event) => {
    if (!event.data?.after.exists) return;
    const data = event.data.after.data();
    if (!data) return;

    // Salida temprana: si el arreglo de facturas no cambió, no hay nada que
    // sanear. Sin esto, el trigger se dispara en cascada sobre sus propias
    // escrituras y sobre los lotes de checkOverdueInvoices (hasta 400 docs).
    const antes = event.data.before?.data();
    if (
      antes &&
      JSON.stringify(antes.invoices ?? null) === JSON.stringify(data.invoices ?? null)
    ) {
      return;
    }

    const invoices = Array.isArray(data.invoices) ? data.invoices : [];
    if (invoices.length === 0) return;

    const base = data.historicalConfig ?? (await readConfigCacheada());
    // Los costos y comisiones propios del expediente son configuración válida,
    // no manipulación: entran en la fórmula de referencia.
    const cfg = configEfectiva(base, data);

    let modified = false;

    const sanitizedInvoices = invoices.map((inv: any) => {
      const kilos = Number(inv.kilos) || 0;
      const baseFin = computeFinancials(kilos, cfg);

      // El total de una factura con UUID o Folio viene del CFDI timbrado o
      // captura real, no de la fórmula. Sobrescribirlo destruye el importe
      // fiscal real, que es el dato que no se puede recalcular.
      const hasId = inv.uuid || (inv.folio && inv.folio.length > 2);
      const invoiceTotal =
        hasId && Number(inv.financials?.invoiceTotal) > 0
          ? Number(inv.financials.invoiceTotal)
          : baseFin.invoiceTotal;

      const esperado = {
        ...baseFin,
        invoiceTotal,
        netCashFlow: round2(invoiceTotal - baseFin.costTotal - baseFin.commission),
      };

      const f = inv.financials;
      const igual =
        !!f &&
        f.saleTotal === esperado.saleTotal &&
        f.costTotal === esperado.costTotal &&
        f.commission === esperado.commission &&
        f.invoiceTotal === esperado.invoiceTotal &&
        f.netCashFlow === esperado.netCashFlow;

      if (igual) return inv;
      modified = true;
      return { ...inv, financials: esperado };
    });

    if (modified) {
      logger.info(
        `Importes recalculados en la orden ${event.params.orderId} ` +
          `(costo ${cfg.costPricePerKg}, comisión ${cfg.commissionRate}).`,
      );
      await event.data.after.ref.update({
        invoices: sanitizedInvoices,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  },
);

// ────────────────────────────────────────────────────────────────────────────
// getOrdersWithDeadline — Recupera OCs que vencen en los próximos 3 días
// ────────────────────────────────────────────────────────────────────────────
export interface OrderDeadlineInfo {
  id: string;
  userId: string;
  folio: string;
  dueDate: Date;
  daysRemaining: number;
}

export async function getOrdersWithDeadline(now: Date = new Date()): Promise<OrderDeadlineInfo[]> {
  const db = getFirestore();
  const snapshot = await db.collection(COL_ORDERS).get();
  const results: OrderDeadlineInfo[] = [];
  const nowMs = now.getTime();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.status === 'collected' || data.status === 'paid') continue;

    let targetDueDate: Date | null = null;
    if (data.creditCycle?.dueDate) {
      targetDueDate = typeof data.creditCycle.dueDate.toDate === 'function'
        ? data.creditCycle.dueDate.toDate()
        : new Date(data.creditCycle.dueDate);
    } else if (Array.isArray(data.invoices)) {
      for (const inv of data.invoices) {
        if (inv.creditCycle?.dueDate && inv.creditCycle.status !== 'collected' && inv.creditCycle.status !== 'paid') {
          targetDueDate = typeof inv.creditCycle.dueDate.toDate === 'function'
            ? inv.creditCycle.dueDate.toDate()
            : new Date(inv.creditCycle.dueDate);
          break;
        }
      }
    }

    if (targetDueDate) {
      const diffMs = targetDueDate.getTime() - nowMs;
      // Vence dentro de 3 días o venció recientemente
      if (diffMs <= threeDaysMs && diffMs >= -24 * 60 * 60 * 1000) {
        const daysRemaining = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
        results.push({
          id: docSnap.id,
          userId: data.userId || data.createdBy || 'todos',
          folio: data.folio || docSnap.id,
          dueDate: targetDueDate,
          daysRemaining,
        });
      }
    }
  }

  return results;
}
