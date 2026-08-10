import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { camposInvoices } from '../../lib/invoiceOps';
import { computeFinancials } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import { confirmDialog } from '../../lib/confirmDialog';

export function useInvoiceActions() {
  const toast = useToast();

  async function saveInvoice(order: PurchaseOrder, updatedInvoice: Invoice, dynamicConfig: any) {
    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const invRef = doc(db, PATHS.invoices, updatedInvoice.id);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');

        const currentOrder = snap.data() as PurchaseOrder;
        const currentInvoices = currentOrder.invoices || [];
        const index = currentInvoices.findIndex((i) => i.id === updatedInvoice.id);

        const crNum = updatedInvoice.collection?.contrareciboNumber?.trim() || '';
        const folioStr = updatedInvoice.folio?.trim() || '';
        const finalFolio = (crNum && !folioStr) ? 'S/N' : folioStr;

        const finalInv = {
          ...updatedInvoice,
          folio: finalFolio,
          financials: computeFinancials(updatedInvoice.kilos, {
            ...dynamicConfig,
            salePricePerKg: updatedInvoice.financials?.salePricePerKg || dynamicConfig.salePricePerKg,
            costPricePerKg: updatedInvoice.financials?.costPricePerKg || dynamicConfig.costPricePerKg,
            commissionRate: updatedInvoice.financials?.commissionRate || dynamicConfig.commissionRate,
          }),
          collection: updatedInvoice.collection ? {
            ...updatedInvoice.collection,
            contrareciboNumber: crNum
          } : undefined,
          orderId: order.id,
          clientId: order.client?.trim() || '',
          oc: order.oc?.trim() || '',
          createdAt: updatedInvoice.createdAt || Timestamp.now(),
          updatedAt: Timestamp.now(),
        };

        const newInvoicesArray = [...currentInvoices];
        if (index >= 0) {
          newInvoicesArray[index] = finalInv;
        } else {
          newInvoicesArray.push(finalInv);
        }

        // Validate duplicates
        if (finalFolio !== 'S/N') {
            const upperFolio = finalFolio.toUpperCase();
            if (currentInvoices.some(x => x.id !== updatedInvoice.id && x.folio?.toUpperCase() === upperFolio)) {
                throw new Error(`El folio de factura ${finalFolio} ya está en este expediente.`);
            }
        }

        tx.update(orderRef, {
          ...camposInvoices(newInvoicesArray),
        });

        tx.set(invRef, finalInv, { merge: true });
      });

      toast('Factura guardada correctamente', 'ok');
    } catch (e: any) {
      toast(`No se pudo guardar la factura: ${e.message}`, 'bad');
      throw e;
    }
  }

  async function deleteInvoice(order: PurchaseOrder, invoiceId: string) {
    if (!(await confirmDialog({ message: '¿Seguro que deseas eliminar esta factura?', danger: true }))) return;
    try {
      const orderRef = doc(db, PATHS.orders, order.id);
      const invRef = doc(db, PATHS.invoices, invoiceId);

      await runTransaction(db, async (tx) => {
        const snap = await tx.get(orderRef);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');

        const currentOrder = snap.data() as PurchaseOrder;
        const currentInvoices = currentOrder.invoices || [];
        const newInvoicesArray = currentInvoices.filter((i) => i.id !== invoiceId);

        tx.update(orderRef, {
          ...camposInvoices(newInvoicesArray),
        });

        tx.delete(invRef);
      });

      toast('Factura eliminada', 'ok');
    } catch (e: any) {
      toast(`No se pudo eliminar la factura: ${e.message}`, 'bad');
      throw e;
    }
  }

  return { saveInvoice, deleteInvoice };
}
