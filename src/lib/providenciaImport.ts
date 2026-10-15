import { parseOrdenDeCompra } from './ocParser';
import type { ParsedProvidenciaPaymentData } from './providenciaPortalParser';
import type { PurchaseOrder, Invoice } from './types';
import { round2 } from './finance';

const identity = (value?: string) => (value || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
export function findExactPurchaseOrder(orders: PurchaseOrder[], oc: string, folio: string) {
  return orders.find(o => !o.isDeleted && ((oc && identity(o.oc) === identity(oc)) || ((!oc || !o.oc) && folio && identity(o.folio) === identity(folio)))) || null;
}

export function purchaseOrderFromText(text: string): Partial<PurchaseOrder> {
  const parsed = parseOrdenDeCompra(text);
  if (!parsed.oc || !parsed.folio || !parsed.items.length) throw new Error('La OC requiere número, folio y partidas legibles.');
  const subtotal = round2(parsed.items.reduce((sum, item) => sum + item.amount, 0));
  const declared = [...text.matchAll(/Sub\s*Total\s*[:$]?\s*([\d,]+\.\d+)/gi)].pop();
  if (declared && Math.abs(Number(declared[1].replace(/,/g, '')) - subtotal) > 0.02) throw new Error('Las partidas no coinciden con el subtotal de la OC.');
  if (parsed.items.some(item => !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unitPrice) || item.unitPrice < 0 || Math.abs(round2(item.quantity * item.unitPrice) - item.amount) > 0.02)) throw new Error('Revisa cantidades, precios y descuentos de las partidas de la OC.');
  const uniformPrice = parsed.items.every(item => item.unitPrice === parsed.items[0].unitPrice);
  return { oc: parsed.oc, folio: parsed.folio, client: parsed.client, department: parsed.department,
    totalKilograms: parsed.totalKilograms, ...(uniformPrice ? { customSellPrice: parsed.items[0].unitPrice } : {}),
    items: parsed.items.map((item, index) => ({ ...item, id: `item-${index+1}`, unit: 'Kilos' })),
    invoices: [], deliveries: [], creditCycle: { status: 'pedido' }, isClosedShort: false };
}

export function planProvidenciaPayment(payment: ParsedProvidenciaPaymentData, orders: PurchaseOrder[]) {
  const errors: string[] = [];
  const targets: Array<{ row: NonNullable<ParsedProvidenciaPaymentData['allocations']>[number]; order: PurchaseOrder; invoice: Invoice }> = [];
  if (payment.allocationError) errors.push(payment.allocationError);
  if (!payment.allocations?.length) errors.push('No se encontraron filas de facturas en el pago.');
  const seen = new Set<string>();
  for (const row of payment.allocations || []) {
    if (seen.has(identity(row.facturaFolio))) { errors.push(`Factura ${row.facturaFolio} repetida en el comprobante.`); continue; }
    seen.add(identity(row.facturaFolio));
    const matches = orders.filter(order => !order.isDeleted).flatMap(order => (order.invoices || []).filter(invoice => {
      const cr = invoice.collection?.contrareciboNumber || (order.invoices?.length === 1 ? order.collection?.contrareciboNumber : '') || '';
      return identity(invoice.folio) === identity(row.facturaFolio) && (!cr || identity(cr) === identity(row.contrareciboNumber));
    }).map(invoice => ({ row, order, invoice })));
    if (matches.length !== 1) errors.push(`Factura ${row.facturaFolio} / ${row.contrareciboNumber}: ${matches.length ? 'hay más de una coincidencia' : 'no se encontró el expediente'}.`);
    else targets.push(matches[0]);
  }
  if (Math.abs(round2((payment.allocations || []).reduce((sum, row) => sum + row.amount, 0)) - payment.amount) > 0.01) errors.push('El desglose no cuadra con el importe total.');
  return { targets, errors };
}
