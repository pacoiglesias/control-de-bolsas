import { useCallback } from 'react';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import type { Invoice, PurchaseOrder } from '../../lib/types';
import { camposInvoices } from '../../lib/invoiceOps';
import type { FinanceConfigCore } from '../../lib/finance';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { logAction } from '../../lib/logger';
import { confirmDialog } from '../../lib/confirmDialog';
import { findDuplicateInvoiceFolio } from '../../lib/duplicateGuards';
import { useOrders } from '../../hooks/useOrders';
import { linkDeliveriesToInvoice, unmarkDeliveriesByInvoiceId } from '../../lib/deliveries';
import { cleanUndefined } from '../../lib/cleanUndefined';
import { round2, validateInvoiceWeightGuardrail } from '../../lib/finance';
import {assertInvoiceQuantityPolicy,getInvoiceDocumentCost} from '../../lib/billingQuantities';

export function useInvoiceActions() {
  const toast = useToast();
  const { user } = useAuth();
  const { orders: allOrders } = useOrders();

  const saveInvoice = useCallback(
    async (order: PurchaseOrder, updatedInvoice: Invoice, dynamicConfig: FinanceConfigCore) => {
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
          const finalFolio = crNum && !folioStr ? 'S/N' : folioStr;

          const existingSaleTotal = updatedInvoice.financials?.saleTotal;
          const existingInvoiceTotal = updatedInvoice.financials?.invoiceTotal;
          const k = Number(updatedInvoice.kilos ?? 0);
          if (!Number.isFinite(k) || k < 0) throw new Error('Los kilos de la factura no son válidos.');
          assertInvoiceQuantityPolicy(currentOrder,k,updatedInvoice.items);
          if (currentOrder.isDeleted) throw new Error('La orden está en la papelera.');
          const previousInvoice = currentInvoices[index];
          const baselineInvoice = order.invoices?.find(invoice => invoice.id === updatedInvoice.id);
          if (previousInvoice && baselineInvoice &&
            (JSON.stringify(previousInvoice.collection) !== JSON.stringify(baselineInvoice.collection) ||
              JSON.stringify(previousInvoice.creditCycle) !== JSON.stringify(baselineInvoice.creditCycle))) {
            throw new Error('La cobranza de esta factura cambió mientras la editabas. Vuelve a abrirla antes de guardar.');
          }
          if (!previousInvoice || previousInvoice.kilos !== k) {
            const limits = validateInvoiceWeightGuardrail(currentOrder, k, updatedInvoice.id);
            if (limits.isOverOrdered || ((currentOrder.deliveries?.length ?? 0) > 0 && limits.isOverDelivered)) {
              throw new Error('Los kilos superan el saldo disponible de la orden. Actualiza la captura con las entregas y facturas actuales.');
            }
          }

          // Jerarquía de precios y costos:
          // 1. Valores capturados en la factura
          // 2. Valores capturados a nivel orden de compra
          // 3. Configuración efectiva / fallback
          const salePrice = updatedInvoice.financials?.salePricePerKg ?? currentOrder.customSellPrice ?? dynamicConfig.salePricePerKg;
          const costPrice = updatedInvoice.financials?.costPricePerKg ?? currentOrder.customCostPrice ?? dynamicConfig.costPricePerKg;
          const commRate = updatedInvoice.financials?.commissionRate ?? order.financials?.commissionRate ?? dynamicConfig.commissionRate ?? 0.08;
          if ([salePrice, costPrice, commRate].some(value => !Number.isFinite(value) || value < 0)) {
            throw new Error('Revisa los precios y la comisión antes de guardar la factura.');
          }

          const hasRealSaleTotal = existingSaleTotal != null && Number.isFinite(Number(existingSaleTotal)) && Number(existingSaleTotal) >= 0;
          const saleTotal = hasRealSaleTotal ? Number(existingSaleTotal) : Math.round(k * salePrice * 100) / 100;

          const hasRealInvoiceTotal = existingInvoiceTotal != null && Number.isFinite(Number(existingInvoiceTotal)) && Number(existingInvoiceTotal) >= 0;
          const ivaMultiplier = 1 + (dynamicConfig.ivaRate ?? 0.16);
          const invoiceTotal = hasRealInvoiceTotal ? Number(existingInvoiceTotal) : Math.round(saleTotal * ivaMultiplier * 100) / 100;

          const documentedCost=getInvoiceDocumentCost(currentOrder,k,updatedInvoice.id);
          const costTotal = documentedCost?.amount ?? Math.round(k * costPrice * 100) / 100;
          const commBase = dynamicConfig.commissionBase === 'total' ? invoiceTotal : saleTotal;
          const commission = Math.round(commBase * commRate * 100) / 100;
          const netCashFlow = Math.round((saleTotal - costTotal - commission) * 100) / 100;
          const tradeMargin = Math.round((saleTotal - costTotal) * 100) / 100;

          const isEstimatedPrice = currentOrder.customSellPrice == null && updatedInvoice.financials?.salePricePerKg == null && !hasRealSaleTotal;
          const isEstimatedCost = Boolean(documentedCost?.needsReview) || (currentOrder.customCostPrice == null && updatedInvoice.financials?.costPricePerKg == null);

          const finalFinancials = {
            salePricePerKg: salePrice,
            costPricePerKg: costPrice,
            commissionRate: commRate,
            saleTotal,
            invoiceTotal,
            costTotal,
            commission,
            netCashFlow:isEstimatedCost?0:netCashFlow,
            tradeMargin:isEstimatedCost?0:tradeMargin,
            isEstimatedPrice,
            isEstimatedCost,
          };

          // Normalización canónica de estados: 'revision' -> 'in_review'
          let rawStatus = updatedInvoice.creditCycle?.status || 'pending';
          if ((rawStatus as string) === 'revision') rawStatus = 'in_review';

          const finalInv: Invoice = {
            ...updatedInvoice,
            reconciliation:{...updatedInvoice.reconciliation,version:1,source:updatedInvoice.reconciliation?.source||'manual_verified_invoice',useSubtotalMargin:true},
            folio: finalFolio,
            financials: finalFinancials,
            isEstimatedPrice,
            isEstimatedCost,
            creditCycle: {
              ...updatedInvoice.creditCycle,
              status: rawStatus,
            },
            collection: updatedInvoice.collection
              ? {
                  ...updatedInvoice.collection,
                  contrareciboNumber: crNum,
                }
              : undefined,
            orderId: order.id,
            client: order.client?.trim() || '',
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

          // Validación de duplicados con ámbito de UUID vs Folio
          if (finalFolio !== 'S/N') {
            const upperFolio = finalFolio.toUpperCase();
            if (currentInvoices.some((x) => x.id !== updatedInvoice.id && x.folio?.toUpperCase() === upperFolio)) {
              throw new Error(`El folio de factura ${finalFolio} ya está en este expediente.`);
            }

            const globalDup = findDuplicateInvoiceFolio(allOrders || [], finalFolio, updatedInvoice.id);
            if (globalDup && globalDup.orderFolio !== (order.folio || order.oc)) {
              // Buscar la factura existente en la otra orden para cotejar UUIDs
              const otherOrder = (allOrders || []).find((o) => (o.folio || o.oc) === globalDup.orderFolio);
              const otherInv = (otherOrder?.invoices || []).find((i: any) => i.folio?.trim().toUpperCase() === upperFolio);

              const currentUuid = (updatedInvoice.uuid || (updatedInvoice as any).uuidFiscal || '').trim().toLowerCase();
              const otherUuid = (otherInv?.uuid || (otherInv as any)?.uuidFiscal || '').trim().toLowerCase();

              if (currentUuid && otherUuid && currentUuid !== otherUuid) {
                // Mismo folio pero distinto UUID fiscal: advertir y marcar para revisión en lugar de bloqueo ciego
                finalInv.creditCycle = {
                  ...finalInv.creditCycle,
                  status: 'manual_review',
                };
              } else {
                // Mismo UUID o folios sin UUID diferenciador: bloqueo por duplicidad
                throw new Error(
                  `🚨 La factura #${finalFolio} ya está registrada en la OC #${globalDup.orderFolio} (${globalDup.client}).`
                );
              }
            }
          }

          // Vincular entregas de báscula a la factura
          const updatedDeliveries = previousInvoice && round2(previousInvoice.kilos) === round2(k)
            ? currentOrder.deliveries || []
            : linkDeliveriesToInvoice(currentOrder.deliveries || [], finalInv.id, k);

          tx.update(orderRef, cleanUndefined({
            deliveries: updatedDeliveries,
            ...camposInvoices(newInvoicesArray),
          }));

          tx.set(invRef, cleanUndefined(finalInv), { merge: true });
        });

        await logAction(user?.email, 'Factura Guardada', {
          orderId: order.id,
          folio: updatedInvoice.folio,
          kilos: updatedInvoice.kilos,
        });

        toast('Factura guardada correctamente', 'ok');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast(`No se pudo guardar la factura: ${msg}`, 'bad');
        throw e;
      }
    },
    [allOrders, user?.email, toast]
  );

  const deleteInvoice = useCallback(
    async (order: PurchaseOrder, invoiceId: string) => {
      const invToDelete = (order.invoices || []).find((i) => i.id === invoiceId);
      const cr = invToDelete?.collection?.contrareciboNumber;
      const isPaid = invToDelete?.creditCycle?.status === 'paid' || invToDelete?.creditCycle?.status === 'collected';

      let warningMsg = `¿Estás seguro de que deseas eliminar la Factura #${invToDelete?.folio || '(sin folio)'}?`;
      if (cr || isPaid) {
        warningMsg = `⚠️ ¡ADVERTENCIA CRÍTICA!\n\nLa Factura #${
          invToDelete?.folio || '(sin folio)'
        } ya tiene Contrarecibo (${cr || 'registrado'}) o pagos en caja.\n\nSi la eliminas, alterará las cuentas por cobrar y el historial financiero.\n\nEsta acción quedará registrada en la bitácora de auditoría. ¿Deseas proceder?`;
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
          const currentInvoice = currentInvoices.find(invoice => invoice.id === invoiceId);
          if (currentInvoice && ((currentInvoice.collection?.paidAmount ?? 0) > 0 || currentInvoice.collection?.paidAt || currentInvoice.collection?.collectedAt ||
            ['paid', 'collected'].includes(currentInvoice.creditCycle?.status))) {
            throw new Error('Revierte primero los pagos de esta factura en Cobranza para conservar el historial de caja.');
          }
          const newInvoicesArray = currentInvoices.filter((i) => i.id !== invoiceId);

          // Desvincular entregas asociadas a la factura eliminada
          const updatedDeliveries = unmarkDeliveriesByInvoiceId(
            currentOrder.deliveries || [],
            invoiceId
          );

          // Quitar una factura conserva la OC y sus entregas para volver a facturarlas.
          tx.update(orderRef, cleanUndefined({
              deliveries: updatedDeliveries,
              ...camposInvoices(newInvoicesArray),
          }));

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
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        toast(`No se pudo eliminar la factura: ${msg}`, 'bad');
        throw e;
      }
    },
    [user?.email, toast]
  );

  return { saveInvoice, deleteInvoice };
}
