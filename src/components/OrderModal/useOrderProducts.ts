import { useCallback } from 'react';
import type { PurchaseOrderItem, FinancialConfig } from '../../lib/types';
import { confirmDialog } from '../../lib/confirmDialog';
import { round2 } from '../../lib/finance';

export function useOrderProducts(
  items: PurchaseOrderItem[],
  setForm: React.Dispatch<React.SetStateAction<any>>,
  config: FinancialConfig
) {
  
  const addItem = useCallback(() => {
    setForm((f: any) => {
      const newItem = { id: Date.now().toString(), quantity: 0, unit: 'Kilos', description: '', unitPrice: config.salePricePerKg || 43, amount: 0 };
      const nextItems = [...(f.items || []), newItem];
      const sumKg = nextItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      return {
        ...f,
        items: nextItems,
        totalKilograms: sumKg > 0 ? String(sumKg) : f.totalKilograms,
      };
    });
  }, [setForm, config]);

  const updateItem = useCallback(<F extends keyof PurchaseOrderItem>(index: number, field: F, value: PurchaseOrderItem[F]) => {
    setForm((f: any) => {
      const nextItems = [...(f.items || [])];
      const current = { ...nextItems[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const q = Number(field === 'quantity' ? value : current.quantity) || 0;
        const p = Number(field === 'unitPrice' ? value : current.unitPrice) || 0;
        current.amount = round2(q * p);
      }
      nextItems[index] = current;
      const sumKg = nextItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
      return {
        ...f,
        items: nextItems,
        totalKilograms: sumKg > 0 ? String(sumKg) : f.totalKilograms,
      };
    });
  }, [setForm]);

  const removeItem = useCallback(async (index: number) => {
    if (await confirmDialog({ message: '¿Seguro que deseas eliminar esta partida?', danger: true })) {
      setForm((f: any) => {
        const nextItems = [...(f.items || [])];
        nextItems.splice(index, 1);
        const sumKg = nextItems.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
        return {
          ...f,
          items: nextItems,
          totalKilograms: sumKg > 0 ? String(sumKg) : (nextItems.length === 0 ? '' : f.totalKilograms),
        };
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
