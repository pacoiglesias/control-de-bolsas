import { useCallback } from 'react';
import type { PurchaseOrderItem, FinancialConfig } from '../../lib/types';

export function useOrderProducts(
  items: PurchaseOrderItem[],
  setForm: React.Dispatch<React.SetStateAction<any>>,
  config: FinancialConfig
) {
  
  const addItem = useCallback(() => {
    setForm((f: any) => ({
      ...f,
      items: [
        ...f.items,
        { id: Date.now().toString(), quantity: 0, unit: 'Kilos', description: '', unitPrice: config.salePricePerKg, amount: 0 }
      ],
    }));
  }, [setForm, config]);

  const updateItem = useCallback(<F extends keyof PurchaseOrderItem>(index: number, field: F, value: PurchaseOrderItem[F]) => {
    setForm((f: any) => {
      const nextItems = [...f.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...f, items: nextItems };
    });
  }, [setForm]);

  const removeItem = useCallback((index: number) => {
    if (window.confirm('¿Seguro que deseas eliminar esta partida?')) {
      setForm((f: any) => {
        const nextItems = [...f.items];
        nextItems.splice(index, 1);
        return { ...f, items: nextItems };
      });
    }
  }, [setForm]);

  return {
    items,
    addItem,
    updateItem,
    removeItem
  };
}
