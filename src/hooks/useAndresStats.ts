import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useOrders } from './useOrders';
import { useConfig } from './useConfig';
import { round2 } from '../lib/finance';
export type LedgerEntry = {
  id: string;
  date: Timestamp | null;
  concept: string;
  cargo: number;
  abono: number;
  balance: number;
  source: 'purchase' | 'expense' | 'historical';
};

export function useAndresStats(selectedProvider: string = 'Andres') {
  const { purchases, loading: loadingP, error: errorP } = usePurchases();
  const { expenses, loading: loadingE, error: errorE } = useExpenses();
  const { orders } = useOrders();
  const { config } = useConfig();

  const loading = loadingP || loadingE;
  const error = errorP || errorE;

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const provPurchases = useMemo(() => 
    purchases.filter(p => p.provider.toLowerCase() === selectedProvider.toLowerCase()), 
  [purchases, selectedProvider]);

  const provExpenses = useMemo(() => 
    expenses.filter(e => e.provider?.toLowerCase() === selectedProvider.toLowerCase()), 
  [expenses, selectedProvider]);

  const currentCostPerKg = config?.costPricePerKg || 42;
  const deudaHistorica = config?.historicalDebtAndres || 0;

  const stats = useMemo(() => {
    // Totales
    const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0);
    const totalPurchasesCost = round2(provPurchases.reduce((acc, p) => acc + ((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)), 0));
    
    const totalPagado = provExpenses.reduce((acc, e) => {
      if (e.type === 'egreso') return acc + e.amount; // Anticipos/Pagos
      if (e.type === 'ingreso') return acc - e.amount; // Devoluciones
      return acc;
    }, 0);
    
    const saldoProveedor = totalPagado - totalPurchasesCost + deudaHistorica;

    // Libro Mayor (Ledger)
    let ledger: LedgerEntry[] = [
      ...provPurchases.map(p => ({
        id: p.id,
        date: p.date,
        concept: `Entrega (Amortización) OC-${orderById.get(p.id)?.folio || 'S/F'}`,
        cargo: round2((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)),
        abono: 0,
        balance: 0,
        source: 'purchase' as const
      })).filter(x => x.cargo > 0),
      ...provExpenses.map(e => ({
        id: e.id,
        date: e.date,
        concept: e.concept,
        cargo: e.type === 'ingreso' ? e.amount : 0, 
        abono: e.type === 'egreso' ? e.amount : 0, 
        balance: 0,
        source: 'expense' as const
      }))
    ];

    ledger.sort((a, b) => {
      const ta = a.date?.toMillis() ?? 0;
      const tb = b.date?.toMillis() ?? 0;
      return ta - tb;
    });

    let running = -deudaHistorica;
    for (const row of ledger) {
      running += row.cargo;
      running -= row.abono;
      row.balance = running;
    }
    ledger.reverse();

    return {
      totalReceivedKilos,
      totalPurchasesCost,
      totalPagado,
      saldoProveedor,
      ledger
    };
  }, [provPurchases, provExpenses, currentCostPerKg, deudaHistorica, orderById]);

  // Alertas Proactivas
  const hoy = Date.now();
  const entregasAtrasadas = useMemo(() => provPurchases.filter((p) => {
    const o = orderById.get(p.id);
    if (!o?.estimatedDeliveryDate) return false;
    const kilosFaltan = (p.expectedKilos ?? 0) - (p.receivedKilos ?? 0);
    return kilosFaltan > 0.01 && o.estimatedDeliveryDate.toMillis() < hoy;
  }), [provPurchases, orderById, hoy]);

  return {
    provPurchases,
    provExpenses,
    orderById,
    loading,
    error,
    stats,
    entregasAtrasadas,
    currentCostPerKg
  };
}
