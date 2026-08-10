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
      
      // Calculate how many total kilos were in this delivery
      const d = nextDelivs[index];
      const kilos = (d.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0) || d.kilos || 0;

      // Draft a new invoice
      const newInv: Invoice = {
        id: crypto.randomUUID(),
        orderId: f.id || '',
        kilos,
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
