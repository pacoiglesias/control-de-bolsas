import { useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import type { Delivery, Invoice } from '../../lib/types';
import { confirmDialog } from '../../lib/confirmDialog';

export function useOrderDeliveries(
  setForm: React.Dispatch<React.SetStateAction<any>>,
  setTab?: (t: 'resumen' | 'productos' | 'entregas' | 'facturas') => void
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
      const deliv = next[deliveryIndex];
      const itIdx = deliv.items.findIndex((x: any) => x.itemId === itemId);
      
      const newItems = [...deliv.items];
      if (itIdx >= 0) {
        if (quantity > 0) newItems[itIdx].quantity = quantity;
        else newItems.splice(itIdx, 1);
      } else if (quantity > 0) {
        newItems.push({ itemId, quantity });
      }
      
      deliv.items = newItems;
      return { ...f, deliveries: next };
    });
  }, [setForm]);

  const removeDelivery = useCallback(async (index: number) => {
    if (await confirmDialog({ message: '¿Eliminar esta entrega?', danger: true })) {
      setForm((f: any) => {
        const next = [...f.deliveries];
        next.splice(index, 1);
        return { ...f, deliveries: next };
      });
    }
  }, [setForm]);

  const facturarEntrega = useCallback((index: number) => {
    setForm((f: any) => {
      const nextDelivs = [...f.deliveries];
      nextDelivs[index] = { ...nextDelivs[index], invoiced: true };
      
      // Calculate how many total kilos were in this delivery and map items
      const d = nextDelivs[index];
      const dItems = d.items || [];
      const kilos = dItems.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0) || d.kilos || 0;

      const orderItems = f.items || [];
      let invoiceItems: any[] = [];

      if (dItems.length > 0) {
        invoiceItems = dItems
          .filter((di: any) => Number(di.quantity) > 0)
          .map((di: any) => {
            const matched = orderItems.find((oi: any) => oi.id === di.itemId || oi.code === di.itemId);
            const unitPrice = Number(matched?.unitPrice || f.customSellPrice || 43);
            const qty = Number(di.quantity);
            return {
              id: matched?.id || crypto.randomUUID(),
              code: matched?.code || '24111500',
              description: matched?.description || 'Bolsa de Polietileno',
              quantity: qty,
              unit: matched?.unit || 'Kilos',
              unitPrice: unitPrice,
              amount: qty * unitPrice,
            };
          });
      } else if (orderItems.length === 1 && kilos > 0) {
        const matched = orderItems[0];
        const unitPrice = Number(matched.unitPrice || f.customSellPrice || 43);
        invoiceItems = [{
          id: matched.id || crypto.randomUUID(),
          code: matched.code || '24111500',
          description: matched.description || 'Bolsa de Polietileno',
          quantity: kilos,
          unit: matched.unit || 'Kilos',
          unitPrice: unitPrice,
          amount: kilos * unitPrice,
        }];
      }

      // Draft a new invoice
      const newInv: Invoice = {
        id: crypto.randomUUID(),
        orderId: f.id || '',
        kilos,
        items: invoiceItems.length > 0 ? invoiceItems : undefined,
        creditCycle: { status: 'pedido' },
      };

      return {
        ...f,
        deliveries: nextDelivs,
        invoices: [...f.invoices, newInv]
      };
    });
    
    if (setTab) setTab('facturas');
  }, [setForm, setTab]);

  return {
    addDelivery,
    updateDelivery,
    updateDeliveryItemQty,
    removeDelivery,
    facturarEntrega
  };
}
