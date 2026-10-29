/**
 * Liquidación de facturas con un Complemento de Pago CFDI (REP).
 *
 * Módulo PURO: no importa firebase-admin ni ningún SDK, para que la
 * lógica se pueda probar sin emulador. El cableado a Firestore vive en
 * uploadProcessing.ts, que convierte las fechas ISO a Timestamp antes
 * de escribir.
 *
 * Criterio (el mismo de la vía portal en src/lib/providenciaPaymentApply.ts):
 * - Se acumula `paidAmount` sobre lo ya abonado, nunca se sobrescribe.
 * - Liquidada (`paid`) cuando el saldo insoluto del SAT es <= 0.01 o el
 *   acumulado alcanza el total de la factura (tolerancia 0.01).
 * - Parcial (`in_review`) en cualquier otro caso.
 * - Idempotente: cada abono queda registrado con una llave de recibo
 *   `CFDI_<uuidComplemento>_<invoiceId>`; reprocesar el mismo complemento
 *   no duplica el pago.
 * - Nunca se aplica un abono que exceda el saldo ni sobre una factura ya
 *   liquidada: en esos casos solo se conserva la marca `issued` del
 *   complemento (el SAT dice que el complemento existe) y se reporta el
 *   motivo, sin tocar los montos.
 */

export interface ComplementPaymentAllocation {
  /** UUID de la factura relacionada, en mayúsculas. */
  uuid: string;
  /** ImpPagado del DoctoRelacionado. */
  impPagado: number;
  /** ImpSaldoInsoluto del DoctoRelacionado (null si el nodo no lo trae). */
  impSaldoInsoluto: number | null;
}

export interface ComplementPaymentDoc {
  /** UUID del propio complemento (tfd:TimbreFiscalDigital), '' si no viene. */
  uuid: string;
  /** Fecha del nodo Pago (puede venir vacía). */
  fechaPago: string;
  payments: ComplementPaymentAllocation[];
}

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extrae los pagos de un CFDI tipo P ya parseado con fast-xml-parser.
 * Acepta pago20 y pago10. Lanza si no hay nodo de Pago (igual que antes).
 */
export function parseComplementPayments(comprobante: any): ComplementPaymentDoc {
  const complemento = comprobante?.["cfdi:Complemento"] ?? null;
  const pagos = complemento
    ? complemento["pago20:Pagos"] || complemento["pago10:Pagos"]
    : null;
  const pago = pagos ? pagos["pago20:Pago"] || pagos["pago10:Pago"] : null;
  if (!pago) throw new Error("Complemento de Pago sin nodo de Pago");
  const pagosList = asArray(pago);

  const tfd = complemento?.["tfd:TimbreFiscalDigital"];
  const uuid = String(tfd?.UUID || "").toUpperCase();

  const payments: ComplementPaymentAllocation[] = [];
  let fechaPago = "";
  for (const p of pagosList) {
    if (!fechaPago && p?.FechaPago) fechaPago = String(p.FechaPago);
    const doctos = asArray(
      p?.["pago20:DoctoRelacionado"] || p?.["pago10:DoctoRelacionado"]
    );
    for (const d of doctos) {
      if (!d?.IdDocumento) continue;
      payments.push({
        uuid: String(d.IdDocumento).toUpperCase(),
        impPagado: asNumber(d.ImpPagado),
        impSaldoInsoluto:
          d.ImpSaldoInsoluto == null || d.ImpSaldoInsoluto === ""
            ? null
            : asNumber(d.ImpSaldoInsoluto),
      });
    }
  }
  return { uuid, fechaPago, payments };
}

/** Llave estable del recibo: reprocesar el mismo complemento no duplica. */
export function receiptKeyForComplement(
  complementUuid: string,
  invoiceId: string
): string {
  const base = (complementUuid || "SIN_UUID")
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  return `CFDI_${base}_${invoiceId}`;
}

export interface InvoiceLike {
  id: string;
  uuid?: string;
  folio?: string;
  kilos?: number;
  creditCycle?: { status?: string };
  financials?: { invoiceTotal?: number; saleTotal?: number };
  collection?: {
    complementStatus?: string;
    paidAmount?: number;
    paidAt?: unknown;
    paymentsHistory?: Array<{
      receiptId?: string;
      reference?: string;
      amount?: number;
      date?: unknown;
      notes?: string;
    }>;
  };
}

export type ComplementSkipReason =
  | "duplicate"
  | "already_settled"
  | "overpayment"
  | "no_total"
  | "no_amount";

export interface AppliedComplementPayment {
  /** Factura resultante (siempre con complementStatus='issued'). */
  invoice: InvoiceLike;
  receiptKey: string;
  applied: boolean;
  skippedReason?: ComplementSkipReason;
  paidAmount: number;
  settled: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Aplica UN abono de complemento a UNA factura. No escribe en Firestore:
 * devuelve la factura resultante y si el abono se aplicó o por qué no.
 * La fecha de pago queda como string ISO; el llamador la convierte a
 * Timestamp antes de escribir.
 */
export function applyComplementPayment(
  invoice: InvoiceLike,
  allocation: ComplementPaymentAllocation,
  complementUuid: string,
  fechaPago: string,
  existingReceiptKeys: ReadonlySet<string>
): AppliedComplementPayment {
  const receiptKey = receiptKeyForComplement(complementUuid, invoice.id);
  const base: InvoiceLike = {
    ...invoice,
    collection: { ...invoice.collection, complementStatus: "issued" },
  };
  const prev = Number(invoice.collection?.paidAmount) || 0;

  if (existingReceiptKeys.has(receiptKey)) {
    return { invoice: base, receiptKey, applied: false, skippedReason: "duplicate", paidAmount: prev, settled: false };
  }
  const status = invoice.creditCycle?.status;
  if (status === "paid" || status === "collected") {
    return { invoice: base, receiptKey, applied: false, skippedReason: "already_settled", paidAmount: prev, settled: true };
  }
  const total = invoice.financials?.invoiceTotal;
  if (total == null || !Number.isFinite(total)) {
    return { invoice: base, receiptKey, applied: false, skippedReason: "no_total", paidAmount: prev, settled: false };
  }
  if (!(allocation.impPagado > 0)) {
    // Complemento sin monto: se marca issued pero no hay nada que abonar.
    // Si el SAT dice saldo cero, la factura queda liquidada sin abono.
    if (allocation.impSaldoInsoluto != null && allocation.impSaldoInsoluto <= 0.01) {
      return {
        invoice: {
          ...base,
          collection: {
            ...base.collection,
            paidAmount: prev,
            ...(fechaPago ? { paidAt: fechaPago } : {}),
          },
          creditCycle: { ...invoice.creditCycle, status: "paid" },
        },
        receiptKey, applied: true, paidAmount: prev, settled: true,
      };
    }
    return { invoice: base, receiptKey, applied: false, skippedReason: "no_amount", paidAmount: prev, settled: false };
  }
  const paid = round2(prev + allocation.impPagado);
  if (paid > total + 0.01) {
    return { invoice: base, receiptKey, applied: false, skippedReason: "overpayment", paidAmount: prev, settled: false };
  }
  const settled =
    allocation.impSaldoInsoluto != null
      ? allocation.impSaldoInsoluto <= 0.01
      : paid >= total - 0.01;
  const history = [...(invoice.collection?.paymentsHistory || [])];
  const historyEntry: {
    receiptId: string;
    reference?: string;
    amount: number;
    date?: string;
    notes: string;
  } = {
    receiptId: receiptKey,
    amount: allocation.impPagado,
    notes: `Complemento de pago CFDI${complementUuid ? ` ${complementUuid}` : ""}`,
  };
  if (complementUuid) historyEntry.reference = complementUuid;
  if (fechaPago) historyEntry.date = fechaPago;
  history.push(historyEntry);
  return {
    invoice: {
      ...base,
      collection: {
        ...base.collection,
        paidAmount: paid,
        ...(settled ? { paidAt: fechaPago || undefined } : {}),
        paymentsHistory: history,
      },
      creditCycle: { ...invoice.creditCycle, status: settled ? "paid" : "in_review" },
    },
    receiptKey,
    applied: true,
    paidAmount: paid,
    settled,
  };
}

/** Totales de cobro de un expediente tras aplicar abonos. */
export function refreshOrderPaymentTotals(invoices: InvoiceLike[]): {
  paidAmount: number;
  allSettled: boolean;
} {
  const paidAmount = round2(
    invoices.reduce((sum, inv) => sum + (Number(inv.collection?.paidAmount) || 0), 0)
  );
  const allSettled =
    invoices.length > 0 &&
    invoices.every((inv) =>
      ["paid", "collected"].includes(inv.creditCycle?.status || "")
    );
  return { paidAmount, allSettled };
}
