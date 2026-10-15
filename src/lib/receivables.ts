import { round2 } from './finance';
import { toDate } from './format';
import { DEFAULT_CONFIG, type FinancialConfig, type PurchaseOrder } from './types';

/** Customer debt is invoice based. A shared CR groups invoices; it never replaces them. */
export function buildReceivables(orders: PurchaseOrder[], config: FinancialConfig = DEFAULT_CONFIG, now = new Date()) {
  const seen = new Set<string>();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const rows = orders.filter(o => !o.isDeleted).flatMap(order => (order.invoices ?? []).flatMap((invoice, index) => {
    const key = invoice.uuid?.trim().toUpperCase() || `${order.id}:${invoice.id || index}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const total = round2(Math.max(0, invoice.financials?.invoiceTotal ??
      ((invoice.financials?.saleTotal ?? invoice.kilos * (order.customSellPrice ?? config.salePricePerKg)) * (1 + config.ivaRate))));
    const settled = ['paid', 'collected'].includes(invoice.creditCycle?.status) || Boolean(invoice.collection?.paidAt || invoice.collection?.collectedAt);
    const paid = settled ? total : Math.min(total, Math.max(0, invoice.collection?.paidAmount ?? 0));
    const balance = round2(total - paid);
    const cr = invoice.collection?.contrareciboNumber?.trim().toUpperCase() || '';
    const due = toDate(invoice.creditCycle?.dueDate);
    return [{ key, order, invoice, total, paid, balance, cr, overdue: balance > 0 && (due ? due.getTime() < today : invoice.creditCycle?.status === 'overdue') }];
  }));
  const pending = rows.filter(row => row.balance > 0.01);
  const sum = (items: typeof rows) => round2(items.reduce((total, row) => total + row.balance, 0));
  return { rows, pending, total: sum(pending), withCR: sum(pending.filter(row => row.cr)),
    withoutCR: sum(pending.filter(row => !row.cr)), overdue: sum(pending.filter(row => row.overdue)),
    crCount: new Set(pending.filter(row => row.cr).map(row => row.cr)).size,
    invoiced: round2(rows.reduce((total, row) => total + row.total, 0)),
    paid: round2(rows.reduce((total, row) => total + row.paid, 0)) };
}
