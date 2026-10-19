import {doc, runTransaction, serverTimestamp} from 'firebase/firestore';
import {db, PATHS} from './firebase';
import {toDate} from './format';
import {assertDeliveryFitsOrder, computeDeliveredTotals, migrateLegacyDeliveries} from './deliveries';
import {cleanUndefined} from './cleanUndefined';
import type {Delivery, PurchaseOrder} from './types';

/** Captures a physical event only. Supplier purchases are a separate operation. */
export async function registerDeliveryEvent(orderId: string, delivery: Delivery, baselineMillis?: number) {
  const ref = doc(db, PATHS.orders, orderId);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('El expediente ya no existe.');
    const current = {...snapshot.data(), id: orderId} as PurchaseOrder;
    const currentMillis = toDate(current.updatedAt)?.getTime();
    if (baselineMillis && currentMillis && baselineMillis !== currentMillis) throw new Error('Este expediente fue modificado. Ciérralo y vuelve a intentarlo.');
    const deliveries = migrateLegacyDeliveries(current, current.deliveries || []);
    if (deliveries.some(existing => existing.id === delivery.id)) throw new Error('Esta entrega ya fue registrada. Actualiza el expediente.');
    if (delivery.docFolio && deliveries.some(existing=>!existing.inferredFromInvoice && existing.docFolio?.trim().toUpperCase()===delivery.docFolio?.trim().toUpperCase())) throw new Error('Esta remisión ya está registrada en la orden.');
    const kilos = computeDeliveredTotals([delivery]).kilosEntregados;
    assertDeliveryFitsOrder({...current, deliveries}, kilos, delivery.items);
    const updated = [...deliveries, cleanUndefined({...delivery,billingQuantityPolicy:delivery.billingQuantityPolicy||current.invoiceBillingPolicy})];
    transaction.update(ref, {deliveries: updated, updatedAt: serverTimestamp()});
    return computeDeliveredTotals(updated, current.items).kilosEntregados;
  });
}
