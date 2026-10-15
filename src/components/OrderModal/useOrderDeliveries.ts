import { useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Delivery } from '../../lib/types';
import { confirmDialog } from '../../lib/confirmDialog';
import { round2 } from '../../lib/finance';
import { getDeliveryBilling } from '../../lib/deliveries';

export function useOrderDeliveries(
  setForm: React.Dispatch<React.SetStateAction<any>>,
  onInvoice?: (index: number) => void,
  deliveries: Delivery[] = [],
) {

  const addDelivery = useCallback(() => {
    setForm((f: any) => ({
      ...f,
      deliveries: [
        ...f.deliveries,
        {
          id: crypto.randomUUID(),
          date: Timestamp.now(),
          kilos: 0,
          items: [],
          invoiced: false,
          notes: ''
        }
      ]
    }));
  }, [setForm]);

  const updateDelivery = useCallback(<F extends keyof Delivery>(index: number, field: F, value: Delivery[F]) => {
    setForm((f: any) => {
      const next = [...f.deliveries];
      next[index] = { ...next[index], [field]: value };
      return { ...f, deliveries: next };
    });
  }, [setForm]);

  const updateDeliveryItemQty = useCallback((deliveryIndex: number, itemId: string, quantity: number) => {
    setForm((f: any) => {
      const next = [...f.deliveries];
      const deliv = { ...next[deliveryIndex] };
      const currentItems = deliv.items || [];
      const itIdx = currentItems.findIndex((x: any) => x.itemId === itemId);
      
      const newItems = [...currentItems];
      if (itIdx >= 0) {
        if (quantity > 0) newItems[itIdx] = { ...newItems[itIdx], quantity };
        else newItems.splice(itIdx, 1);
      } else if (quantity > 0) {
        newItems.push({ itemId, quantity });
      }
      
      const totalKg = round2(newItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0));
      deliv.items = newItems;
      deliv.kilos = totalKg;
      next[deliveryIndex] = deliv;
      return { ...f, deliveries: next };
    });
  }, [setForm]);

  const removeDelivery = useCallback(async (index: number) => {
    const targetDeliv = deliveries[index];
    if (!targetDeliv) return;

    const isInvoiced = targetDeliv && getDeliveryBilling(targetDeliv).invoicedKilos > 0;
    if (isInvoiced) {
      await confirmDialog({ message: "Esta entrega tiene kilos facturados. Desvincula primero la factura desde Facturas para conservar la trazabilidad." });
      return;
    }
    const kg = targetDeliv?.kilos || targetDeliv?.items?.reduce((a: number, it: any) => a + (Number(it.quantity) || 0), 0) || 0;

    const msg = `¿Eliminar la entrega #${index + 1} (${kg} kg)?`;

    if (await confirmDialog({ message: msg, danger: true })) {
      setForm((f: any) => {
        const next = [...f.deliveries];
        next.splice(index, 1);
        return { ...f, deliveries: next };
      });
    }
  }, [setForm, deliveries]);

  const facturarEntrega = useCallback((index: number) => {
    onInvoice?.(index);
  }, [onInvoice]);

  return {
    addDelivery,
    updateDelivery,
    updateDeliveryItemQty,
    removeDelivery,
    facturarEntrega
  };
}
