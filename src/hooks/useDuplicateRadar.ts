import { useState, useEffect, useMemo } from 'react';
import type { PurchaseOrder } from '../lib/types';
import { checkAllDuplicates, type DuplicateMatch } from '../lib/duplicateGuards';

export interface UseDuplicateRadarOptions {
  oc?: string;
  invoiceFolio?: string;
  uuid?: string;
  contrarecibo?: string;
  remision?: string;
  excludeOrderId?: string;
  excludeInvoiceId?: string;
  excludeDeliveryId?: string;
  debounceMs?: number;
}

export function useDuplicateRadar(
  orders: PurchaseOrder[] = [],
  options: UseDuplicateRadarOptions
): {
  match: DuplicateMatch | null;
  isChecking: boolean;
} {
  const [match, setMatch] = useState<DuplicateMatch | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const {
    oc,
    invoiceFolio,
    uuid,
    contrarecibo,
    remision,
    excludeOrderId,
    excludeInvoiceId,
    excludeDeliveryId,
    debounceMs = 150,
  } = options;

  const hasAnyInput = useMemo(() => {
    return Boolean(
      (oc && oc.trim().length >= 2) ||
      (invoiceFolio && invoiceFolio.trim().length >= 2) ||
      (uuid && uuid.trim().length >= 10) ||
      (contrarecibo && contrarecibo.trim().length >= 2) ||
      (remision && remision.trim().length >= 2)
    );
  }, [oc, invoiceFolio, uuid, contrarecibo, remision]);

  useEffect(() => {
    if (!hasAnyInput || !orders || orders.length === 0) {
      setMatch(null);
      setIsChecking(false);
      return;
    }

    setIsChecking(true);
    const timer = setTimeout(() => {
      const result = checkAllDuplicates(orders, {
        oc,
        invoiceFolio,
        uuid,
        contrarecibo,
        remision,
        excludeOrderId,
        excludeInvoiceId,
        excludeDeliveryId,
      });
      setMatch(result);
      setIsChecking(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [
    orders,
    oc,
    invoiceFolio,
    uuid,
    contrarecibo,
    remision,
    excludeOrderId,
    excludeInvoiceId,
    excludeDeliveryId,
    hasAnyInput,
    debounceMs,
  ]);

  return { match, isChecking };
}
