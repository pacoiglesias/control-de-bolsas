import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db, PATHS } from './firebase';
import { cleanUndefined } from './cleanUndefined';
import { planProvidenciaPayment } from './providenciaImport';
import { resolveInvoiceDates } from './invoiceDates';
import { round2 } from './finance';
import type { ParsedProvidenciaPaymentData } from './providenciaPortalParser';
import type { PurchaseOrder, Invoice } from './types';

/** One transaction for the entire transfer, even when it covers several orders. */
export async function applyProvidenciaPayment(payment: ParsedProvidenciaPaymentData, orders: PurchaseOrder[], fingerprint?: string | null) {
  const plan = planProvidenciaPayment(payment, orders);
  if (plan.errors.length) throw new Error(plan.errors.join(' '));
  if (!/^TR_\d+$/i.test(payment.transferRef || '')) throw new Error('Falta la referencia de transferencia.');
  return runTransaction(db, async txn => {
    const snapshots = new Map<string, PurchaseOrder>();
    for (const { order } of plan.targets) {
      if (snapshots.has(order.id)) continue;
      const snapshot = await txn.get(doc(db, PATHS.orders, order.id));
      if (!snapshot.exists() || snapshot.data().isDeleted) throw new Error('El expediente ya no está disponible.');
      snapshots.set(order.id, { ...snapshot.data(), id: order.id } as PurchaseOrder);
    }
    const receipts = [];
    for (const target of plan.targets) {
      const receiptKey = `PROV_${payment.transferRef}_${encodeURIComponent(target.order.id)}_${encodeURIComponent(target.invoice.id)}`;
      const receiptRef = doc(db, 'payment_receipts', receiptKey);
      receipts.push({ ...target, receiptKey, receiptRef, exists: (await txn.get(receiptRef)).exists() });
    }
    // Resolve every allocation and validate balances before queuing any write.
    const updates: Array<{ invoice: Invoice; orderId: string; receipt: typeof receipts[number]; paidAt: Timestamp }> = [];
    for (const receipt of receipts) {
      if (receipt.exists) continue;
      const order = snapshots.get(receipt.order.id)!;
      const current = order.invoices?.find(invoice => invoice.id === receipt.invoice.id);
      if (!current || current.folio !== receipt.invoice.folio) throw new Error(`Cambió la factura ${receipt.row.facturaFolio}. Vuelve a revisar el pago.`);
      const ref = payment.transferRef!;
      if (current.collection?.transferRef === ref || current.collection?.paymentsHistory?.some(p => p.reference === ref || p.receiptId === ref)) continue;
      const total = current.financials?.invoiceTotal;
      const previous = Number(current.collection?.paidAmount) || 0;
      if (total == null || !Number.isFinite(total)) throw new Error(`Falta el total real de la factura ${current.folio}.`);
      if (['paid', 'collected'].includes(current.creditCycle?.status) || receipt.row.amount > round2(total - previous) + 0.01) throw new Error(`La factura ${current.folio} ya está liquidada o el pago supera su saldo. Requiere conciliación; no se duplicó el abono.`);
      const cr = current.collection?.contrareciboNumber || '';
      if (cr && cr.toUpperCase() !== receipt.row.contrareciboNumber) throw new Error(`Cambió el contrarrecibo de la factura ${current.folio}.`);
      const [day, month, year] = receipt.row.paymentDate.split('/');
      const paidAt = Timestamp.fromDate(resolveInvoiceDates(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, '', 0).issue);
      const paid = round2(previous + receipt.row.amount);
      const full = Math.abs(total - paid) <= 0.01;
      const invoice: Invoice = { ...current, collection: { ...current.collection, paidAmount: paid,
        contrareciboNumber: receipt.row.contrareciboNumber, transferRef: ref,
        ...(full ? { paidAt } : {}),
        paymentsHistory: [...(current.collection?.paymentsHistory || []), { receiptId: receipt.receiptKey, reference: ref, amount: receipt.row.amount, date: paidAt, notes: `Detalle Providencia ${ref} · SAP ${receipt.row.doctoSap}` }],
      }, creditCycle: { ...current.creditCycle, status: full ? 'paid' : 'in_review' } };
      updates.push({ invoice, orderId: order.id, receipt, paidAt });
    }
    const changed = new Map<string, Invoice[]>();
    for (const update of updates) {
      const invoices = changed.get(update.orderId) || [...(snapshots.get(update.orderId)!.invoices || [])];
      invoices[invoices.findIndex(invoice => invoice.id === update.invoice.id)] = update.invoice;
      changed.set(update.orderId, invoices);
      txn.set(update.receipt.receiptRef, { receiptKey: update.receipt.receiptKey, orderId: update.orderId,
        invoiceId: update.invoice.id, invoiceFolio: update.invoice.folio, canonicalRef: payment.transferRef,
        amount: update.receipt.row.amount, status: 'applied', bankReference: payment.transferRef,
        trackingKey: null, fileSha256: fingerprint || null, appliedAt: serverTimestamp(),
        appliedBy: auth.currentUser?.email || auth.currentUser?.uid || 'sistema', paymentDate: update.paidAt });
      txn.set(doc(db, PATHS.invoices, update.invoice.id), cleanUndefined({ ...update.invoice, orderId: update.orderId, updatedAt: serverTimestamp() }), { merge: true });
    }
    for (const [orderId, invoices] of changed) {
      const paidAmount = round2(invoices.reduce((sum, invoice) => sum + (invoice.collection?.paidAmount || 0), 0));
      const full = invoices.every(invoice => ['paid','collected'].includes(invoice.creditCycle?.status));
      txn.update(doc(db, PATHS.orders, orderId), cleanUndefined({ invoices, 'collection.paidAmount': paidAmount,
        ...(full ? { 'creditCycle.status': 'paid', status: 'paid' } : {}), updatedAt: serverTimestamp() }));
    }
    return { isDuplicate: updates.length === 0, appliedRows: updates.length };
  });
}
