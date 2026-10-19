import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { cleanUndefined } from './cleanUndefined';
import type { Invoice, PurchaseOrder } from './types';
import {getInvoiceDocumentCost} from './billingQuantities';
import {linkDeliveriesToInvoice} from './deliveries';

/** An invoice is fiscal evidence. Only delivery documents can add physical kilos. */
export async function registerImportedInvoice(orderId: string, invoice: Invoice): Promise<void> {
  const orderRef = doc(db, PATHS.orders, orderId);
  const mirrorRef = doc(db, PATHS.invoices, invoice.id);
  await runTransaction(db, async transaction => {
    const [orderSnapshot, mirrorSnapshot] = await Promise.all([
      transaction.get(orderRef), transaction.get(mirrorRef),
    ]);
    if (!orderSnapshot.exists()) throw new Error('La orden ya no está disponible.');
    const current = orderSnapshot.data() as PurchaseOrder & { isSuperseded?: boolean };
    if (current.isDeleted || current.isSuperseded) throw new Error('La orden está retirada. Revisa su expediente.');
    const invoices = current.invoices || [];
    const normalize = (value?: string) => (value || '').trim().toUpperCase();
    if (mirrorSnapshot.exists() || invoices.some(existing =>
      existing.id === invoice.id ||
      (normalize(invoice.folio) && normalize(existing.folio) === normalize(invoice.folio)) ||
      (normalize(invoice.uuid) && normalize(existing.uuid) === normalize(invoice.uuid)))) {
      throw new Error('Esta factura ya está registrada. Revisa el expediente antes de volver a cargarla.');
    }
    const documentedCost=getInvoiceDocumentCost(current,invoice.kilos,invoice.id);
    const estimatedCost = Boolean(invoice.isEstimatedCost || (invoice.financials as any)?.needsReview || documentedCost?.needsReview);
    const saved = cleanUndefined({ ...invoice, orderId, oc: current.oc || current.folio || '',
      reconciliation: {version: 1, source: 'invoice_document',useSubtotalMargin:true},
      ...(invoice.financials ? {financials: {...invoice.financials, isEstimatedCost: estimatedCost,
        ...(documentedCost?{costTotal:documentedCost.amount,tradeMargin:invoice.financials.saleTotal!-documentedCost.amount,netCashFlow:invoice.financials.saleTotal!-documentedCost.amount-(invoice.financials.commission||0)}:{}),
        ...(estimatedCost ? {tradeMargin: 0, netCashFlow: 0} : {})}} : {}),
    });
    transaction.update(orderRef, { invoices: [...invoices, saved], ...(documentedCost?{deliveries:linkDeliveriesToInvoice(current.deliveries||[],invoice.id,invoice.kilos)}:{}), updatedAt: serverTimestamp() });
    transaction.set(mirrorRef, saved);
  });
}
