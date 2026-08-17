import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { camposInvoices } from '../../lib/invoiceOps';
import { computeFinancials } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { logAction } from '../../lib/logger';
import { confirmDialog } from '../../lib/confirmDialog';

export function useInvoiceActions() {
  const toast = useToast();
  const { user } = useAuth();

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

      await logAction(user?.email, 'Factura Guardada', {
        orderId: order.id,
        folio: updatedInvoice.folio,
        kilos: updatedInvoice.kilos,
      });

      toast('Factura guardada correctamente', 'ok');
    } catch (e: any) {
      toast(`No se pudo guardar la factura: ${e.message}`, 'bad');
      throw e;
    }
  }

  async function deleteInvoice(order: PurchaseOrder, invoiceId: string) {
    const invToDelete = (order.invoices || []).find(i => i.id === invoiceId);
    const cr = invToDelete?.collection?.contrareciboNumber;
    const isPaid = invToDelete?.creditCycle?.status === 'paid' || invToDelete?.creditCycle?.status === 'collected';

    let warningMsg = `¿Estás seguro de que deseas eliminar la Factura #${invToDelete?.folio || '(sin folio)'}?`;
    if (cr || isPaid) {
      warningMsg = `⚠️ ¡ADVERTENCIA CRÍTICA!\n\nLa Factura #${invToDelete?.folio || '(sin folio)'} ya tiene Contrarecibo (${cr || 'registrado'}) o pagos en caja.\n\nSi la eliminas, alterará las cuentas por cobrar y el historial financiero.\n\nEsta acción quedará registrada en la bitácora de auditoría. ¿Deseas proceder?`;
    }

    if (!(await confirmDialog({ message: warningMsg, danger: true }))) return;

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

      await logAction(user?.email, 'Factura Eliminada', {
        orderId: order.id,
        orderFolio: order.folio,
        invoiceId,
        folio: invToDelete?.folio,
        kilos: invToDelete?.kilos,
        total: invToDelete?.financials?.invoiceTotal,
        cr: invToDelete?.collection?.contrareciboNumber,
      });

      toast('Factura eliminada', 'ok');
    } catch (e: any) {
      toast(`No se pudo eliminar la factura: ${e.message}`, 'bad');
      throw e;
    }
  }

  return { saveInvoice, deleteInvoice };
}
