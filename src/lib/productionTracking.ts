import type { PurchaseOrder } from './types';
import { computeDeliveredTotals } from './deliveries';
import { round2 } from './finance';

export function isProductionTracked(order: PurchaseOrder): boolean {
  return !order.isDeleted && !order.isSuperseded && order.productionTrackingEnabled !== false;
}

export function getProductionProgress(order: PurchaseOrder) {
  const orderedItems = (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const ordered = round2(orderedItems > 0 ? orderedItems : Number(order.totalKilograms) || 0);
  const delivered = computeDeliveredTotals(order.deliveries || [], order.items).kilosEntregados;
  const remaining = order.isClosedShort || !isProductionTracked(order) ? 0 : round2(Math.max(0, ordered - delivered));
  return {ordered, delivered, remaining, active: isProductionTracked(order) && !order.isClosedShort && order.creditCycle?.status !== 'completed' && (remaining > 0 || ordered <= 0)};
}

export function summarizeProduction(orders: PurchaseOrder[]) {
  return orders.reduce((totals, order) => {
    const progress = getProductionProgress(order);
    if (!progress.active) return totals;
    return {count: totals.count + 1, remaining: round2(totals.remaining + progress.remaining)};
  }, {count: 0, remaining: 0});
}
