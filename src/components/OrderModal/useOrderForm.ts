import { useState, useCallback } from 'react';
import type { PurchaseOrder, Delivery } from '../../lib/types';

export function useOrderForm(order: PurchaseOrder, migratedDeliveries: Delivery[], initialInvoices: any[]) {
  const [form, setForm] = useState({
    folio: order.folio ?? '',
    client: order.client ?? '',
    clientEmail: order.clientEmail ?? '',
    department: order.department ?? '',
    provider: order.provider ?? '',
    oc: order.oc ?? '',
    totalKilograms: String(order.totalKilograms ?? ''),
    estimatedDeliveryDate: order.estimatedDeliveryDate ?? null,
    deliveries: migratedDeliveries,
    invoices: initialInvoices,
    items: order.items ?? [],
    customCostPrice: order.customCostPrice !== undefined ? String(order.customCostPrice) : '',
    customSellPrice: order.customSellPrice !== undefined ? String(order.customSellPrice) : '',
    customCommissionRate: order.customCommissionRate !== undefined ? String(order.customCommissionRate * 100) : '',
    isClosedShort: order.isClosedShort ?? false,
  });

  const set = useCallback(<K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  return { form, setForm, set };
}
