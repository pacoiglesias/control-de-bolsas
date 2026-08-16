import type { PurchaseOrder } from './types';
import { normalizarTexto } from './finance';
import { fmtDate, toDate } from './format';

export interface DuplicateMatch {
  exists: boolean;
  type: 'cr' | 'invoice' | 'oc' | 'remision';
  matchedValue: string;
  orderFolio: string;
  invoiceFolio?: string;
  client: string;
  dateStr?: string;
}

/**
 * Normaliza un código/folio alfanumérico eliminando espacios y caracteres superfluos
 */
export function normalizeFolio(val: string | undefined | null): string {
  if (!val) return '';
  return normalizarTexto(val).replace(/[^a-z0-9]/gi, '');
}

/**
 * Valida si un número de Contrarecibo ya existe en cualquier otra factura/orden.
 */
export function findDuplicateContrarecibo(
  orders: PurchaseOrder[],
  crNumber: string,
  excludeInvoiceId?: string,
  excludeOrderId?: string
): DuplicateMatch | null {
  const target = normalizeFolio(crNumber);
  if (!target || target.length < 2) return null;

  for (const o of orders) {
    if (o.isClosedShort) continue;

    // 1. Revisar en facturas de la orden
    for (const inv of o.invoices || []) {
      if (excludeInvoiceId && inv.id === excludeInvoiceId) continue;
      const invCr = normalizeFolio(inv.collection?.contrareciboNumber);
      if (invCr === target) {
        const dt = toDate(inv.collection?.contrareciboDate || inv.creditCycle?.dueDate);
        return {
          exists: true,
          type: 'cr',
          matchedValue: (inv.collection?.contrareciboNumber || '').trim(),
          orderFolio: o.folio || o.oc || 'S/OC',
          invoiceFolio: inv.folio || 'S/F',
          client: o.client || 'Providencia',
          dateStr: dt ? fmtDate(dt) : undefined,
        };
      }
    }

    // 2. Revisar a nivel orden (legacy)
    if (excludeOrderId && o.id === excludeOrderId) continue;
    const orderCr = normalizeFolio(o.collection?.contrareciboNumber);
    if (orderCr === target) {
      const dt = toDate(o.collection?.contrareciboDate);
      return {
        exists: true,
        type: 'cr',
        matchedValue: (o.collection?.contrareciboNumber || '').trim(),
        orderFolio: o.folio || o.oc || 'S/OC',
        client: o.client || 'Providencia',
        dateStr: dt ? fmtDate(dt) : undefined,
      };
    }
  }

  return null;
}

/**
 * Valida si un Folio de Factura ya existe en cualquier orden del sistema.
 */
export function findDuplicateInvoiceFolio(
  orders: PurchaseOrder[],
  invoiceFolio: string,
  excludeInvoiceId?: string
): DuplicateMatch | null {
  const target = normalizeFolio(invoiceFolio);
  if (!target || target.length < 2) return null;

  for (const o of orders) {
    if (o.isClosedShort) continue;
    for (const inv of o.invoices || []) {
      if (excludeInvoiceId && inv.id === excludeInvoiceId) continue;
      const f = normalizeFolio(inv.folio);
      if (f === target) {
        const dt = toDate(inv.creditCycle?.issueDate);
        return {
          exists: true,
          type: 'invoice',
          matchedValue: (inv.folio || '').trim(),
          orderFolio: o.folio || o.oc || 'S/OC',
          invoiceFolio: inv.folio,
          client: o.client || 'Providencia',
          dateStr: dt ? fmtDate(dt) : undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Valida si una Orden de Compra (Folio de OC) ya existe en el sistema.
 */
export function findDuplicateOrderFolio(
  orders: PurchaseOrder[],
  orderFolio: string,
  excludeOrderId?: string
): DuplicateMatch | null {
  const target = normalizeFolio(orderFolio);
  if (!target || target.length < 2) return null;

  for (const o of orders) {
    if (excludeOrderId && o.id === excludeOrderId) continue;
    const f = normalizeFolio(o.folio || o.oc);
    if (f === target) {
      const dt = toDate(o.processedAt || o.updatedAt || o.estimatedDeliveryDate);
      return {
        exists: true,
        type: 'oc',
        matchedValue: (o.folio || o.oc || '').trim(),
        orderFolio: o.folio || o.oc || 'S/OC',
        client: o.client || 'Providencia',
        dateStr: dt ? fmtDate(dt) : undefined,
      };
    }
  }

  return null;
}
