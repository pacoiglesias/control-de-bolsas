/**
 * Tablero único de conciliación OC ↔ entregas ↔ facturas ↔ pagos.
 *
 * Una sola lista matutina de diferencias accionables, compuesta con piezas
 * que ya existen —NO duplica lógica de conciliación—:
 * - Kilos entregados sin facturar: mismo criterio que PriorityActionQueue
 *   (entregas sin inferredFromInvoice; suma de items o kilos).
 * - Pagos parciales: buildReceivables (su criterio de saldo y abonado).
 * - Precio de la OC: customSellPrice ?? financials.salePricePerKg ?? config.
 *
 * Tipos de diferencia:
 * - invoice_without_oc: expediente con facturas pero sin OC vinculada y
 *   sin partidas ni entregas (el expediente puro de un XML/PDF que nadie
 *   vinculó todavía). No se marca una OC que guarda su número en otro
 *   campo: si tiene partidas o entregas, no es un expediente huérfano.
 * - delivered_not_invoiced: kilos entregados en báscula sin factura.
 * - invoice_over_delivered: kilos facturados por encima de lo entregado.
 * - invoice_price_mismatch: precio implícito de la factura distinto al
 *   precio de la OC (tolerancia $0.50/kg).
 * - partial_payment: factura con abono pero con saldo pendiente.
 */

import { buildReceivables } from './receivables';
import { round2 } from './finance';
import type { PurchaseOrder, FinancialConfig } from './types';

export type ReconciliationKind =
  | 'invoice_without_oc'
  | 'delivered_not_invoiced'
  | 'invoice_over_delivered'
  | 'invoice_price_mismatch'
  | 'partial_payment';

export interface ReconciliationDiscrepancy {
  kind: ReconciliationKind;
  orderId: string;
  orderLabel: string;
  title: string;
  detail: string;
  kilos?: number;
  amount?: number;
}

export const RECONCILIATION_LABELS: Record<ReconciliationKind, string> = {
  invoice_without_oc: 'Facturas sin OC',
  delivered_not_invoiced: 'Entregado sin facturar',
  invoice_over_delivered: 'Facturado por encima de lo entregado',
  invoice_price_mismatch: 'Precio distinto al de la OC',
  partial_payment: 'Pagos parciales',
};

const TOL_KG = 0.01;
const TOL_PRICE = 0.5;

export function orderLabel(order: PurchaseOrder): string {
  if (order.oc) return `OC ${order.oc}`;
  if (order.folio) return `Folio ${order.folio}`;
  return `Expediente ${order.id}`;
}

function isAlive(order: PurchaseOrder): boolean {
  return !(order as any).isDeleted && !order.isClosedShort;
}

function liveInvoices(order: PurchaseOrder) {
  return (order.invoices ?? []).filter(
    (i) => !(i as any).isDeleted && !(i as any).isSuperseded
  );
}

/** Kilos entregados físicos (misma regla que PriorityActionQueue). */
export function deliveredKilos(order: PurchaseOrder): number {
  return (order.deliveries ?? [])
    .filter((d: any) => !d.inferredFromInvoice)
    .reduce((sum: number, d: any) => {
      const items = (d.items ?? []).reduce(
        (si: number, it: any) => si + (Number(it.quantity) || 0),
        0
      );
      return sum + (items > 0 ? items : Number(d.kilos) || 0);
    }, 0);
}

function orderPrice(order: PurchaseOrder, config: FinancialConfig): number {
  return (
    (order as any).customSellPrice ??
    order.financials?.salePricePerKg ??
    config.salePricePerKg
  );
}

export function buildReconciliationDiscrepancies(
  orders: PurchaseOrder[],
  config: FinancialConfig
): ReconciliationDiscrepancy[] {
  const out: ReconciliationDiscrepancy[] = [];
  const ivaRate = config.ivaRate ?? 0.16;

  for (const order of orders) {
    if (!isAlive(order)) continue;
    const invoices = liveInvoices(order);
    const delivered = deliveredKilos(order);
    const invoiced = invoices.reduce(
      (sum, inv) => sum + (Number(inv.kilos) || 0),
      0
    );
    const label = orderLabel(order);

    if (
      invoices.length > 0 &&
      !order.oc &&
      (order.items ?? []).length === 0 &&
      (order.deliveries ?? []).length === 0
    ) {
      out.push({
        kind: 'invoice_without_oc',
        orderId: order.id,
        orderLabel: label,
        title: `${invoices.length} factura(s) sin OC vinculada`,
        detail: 'Expediente de factura sin orden de compra: vincúlalo para que cuadre con entregas y pagos.',
      });
    }

    const pending = round2(delivered - invoiced);
    if (pending > TOL_KG) {
      const price = orderPrice(order, config);
      out.push({
        kind: 'delivered_not_invoiced',
        orderId: order.id,
        orderLabel: label,
        title: `${pending.toLocaleString('es-MX')} kg entregados sin facturar`,
        detail: 'Kilos en báscula que todavía no tienen factura.',
        kilos: pending,
        amount: round2(pending * price * (1 + ivaRate)),
      });
    }

    if (delivered > 0 && round2(invoiced - delivered) > TOL_KG) {
      out.push({
        kind: 'invoice_over_delivered',
        orderId: order.id,
        orderLabel: label,
        title: `${round2(invoiced - delivered).toLocaleString('es-MX')} kg facturados de más`,
        detail: 'Lo facturado supera lo entregado en báscula.',
        kilos: round2(invoiced - delivered),
      });
    }

    const expected = orderPrice(order, config);
    for (const inv of invoices) {
      const kilos = Number(inv.kilos) || 0;
      if (kilos <= 0) continue;
      const implied =
        inv.financials?.salePricePerKg && inv.financials.salePricePerKg > 0
          ? inv.financials.salePricePerKg
          : inv.financials?.saleTotal
            ? inv.financials.saleTotal / kilos
            : null;
      if (implied == null) continue;
      if (Math.abs(implied - expected) > TOL_PRICE) {
        out.push({
          kind: 'invoice_price_mismatch',
          orderId: order.id,
          orderLabel: label,
          title: `Factura ${inv.folio || inv.id} a $${round2(implied)} vs $${round2(expected)} de la OC`,
          detail: 'El precio implícito de la factura no coincide con el precio de la orden.',
        });
      }
    }
  }

  // Pagos parciales: reutiliza buildReceivables (saldo y abonado).
  const rec = buildReceivables(orders, config);
  for (const row of rec.rows) {
    if (row.balance > 0.01 && row.paid > 0) {
      out.push({
        kind: 'partial_payment',
        orderId: row.order.id,
        orderLabel: orderLabel(row.order),
        title: `Factura ${row.invoice.folio || row.invoice.id} con abono parcial`,
        detail: 'Tiene abono registrado pero queda saldo pendiente.',
        amount: row.balance,
      });
    }
  }

  return out;
}
