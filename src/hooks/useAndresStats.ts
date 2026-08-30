import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useOrders } from './useOrders';
import { useConfig } from './useConfig';
import { round2, normalizarTexto } from '../lib/finance';
import { toDate } from '../lib/format';
export type LedgerEntry = {
  id: string;
  date: Timestamp | null;
  concept: string;
  cargo: number;
  abono: number;
  balance: number;
  source: 'purchase' | 'expense' | 'historical';
};

import { DEFAULT_CONFIG } from '../lib/types';

export function useAndresStats(selectedProvider: string = 'Andres') {
  const { purchases, loading: loadingP, error: errorP } = usePurchases();
  const { expenses, loading: loadingE, error: errorE } = useExpenses();
  const { orders } = useOrders();
  const { config } = useConfig();

  const loading = loadingP || loadingE;
  const error = errorP || errorE;

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const provPurchases = useMemo(() => 
    purchases.filter(p => normalizarTexto(p.provider) === normalizarTexto(selectedProvider)), 
  [purchases, selectedProvider]);

  const provExpenses = useMemo(() => 
    expenses.filter(e => normalizarTexto(e.provider) === normalizarTexto(selectedProvider)), 
  [expenses, selectedProvider]);

  const currentCostPerKg = config?.costPricePerKg ?? DEFAULT_CONFIG.costPricePerKg;
  const deudaHistorica = config?.historicalDebtAndres || 0;

  const stats = useMemo(() => {
    // 1. Unificar entregas de compras registradas y entregas físicas en órdenes
    const orderDeliveries: { id: string; date: any; concept: string; kilos: number; cost: number }[] = [];
    orders.forEach((o) => {
      if ((o as any).isDeleted || o.isClosedShort) return;
      const ocLabel = o.oc || o.folio || 'S/N';
      (o.deliveries || []).forEach((d) => {
        const dKilos = Number(d.kilos) || 0;
        if (dKilos <= 0) return;
        const dCost = round2(dKilos * currentCostPerKg);
        orderDeliveries.push({
          id: d.id || `del-${ocLabel}-${dKilos}`,
          date: d.date || null,
          concept: `Entrega Material (${dKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg) · OC ${ocLabel}${d.docFolio ? ` [${d.docFolio}]` : ''}`,
          kilos: dKilos,
          cost: dCost,
        });
      });
    });

    const hasPurchases = provPurchases.length > 0;
    const totalReceivedKilos = hasPurchases 
      ? provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0)
      : round2(orderDeliveries.reduce((acc, d) => acc + d.kilos, 0));

    const totalPurchasesCost = hasPurchases
      ? round2(provPurchases.reduce((acc, p) => acc + ((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)), 0))
      : round2(orderDeliveries.reduce((acc, d) => acc + d.cost, 0));
    
    const totalPagado = provExpenses.reduce((acc, e) => {
      if (e.type === 'egreso') return acc + e.amount; // Anticipos/Pagos adicionales
      if (e.type === 'ingreso') return acc - e.amount; // Devoluciones
      return acc;
    }, 0);
    
    // Saldo base conciliado y calibrado con Andrés (+103,411.84 a favor por anticipos)
    const saldoBaseAndres = typeof config?.historicalDebtAndres === 'number'
      ? config.historicalDebtAndres
      : 103411.84;
    const saldoProveedor = round2(saldoBaseAndres + totalPagado);

    // Libro Mayor (Ledger)
    const ledger: LedgerEntry[] = hasPurchases
      ? [
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
        ]
      : [
          ...orderDeliveries.map(d => ({
            id: d.id,
            date: d.date,
            concept: d.concept,
            cargo: d.cost,
            abono: 0,
            balance: 0,
            source: 'purchase' as const,
          })),
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
      const ta = toDate(a.date)?.getTime() || 0;
      const tb = toDate(b.date)?.getTime() || 0;
      return ta - tb;
    });

    let running = deudaHistorica;
    for (const row of ledger) {
      running += (row.abono - row.cargo);
      row.balance = round2(running);
    }
    ledger.reverse();

    return {
      totalReceivedKilos,
      totalPurchasesCost,
      totalPagado,
      saldoProveedor,
      ledger
    };
  }, [provPurchases, provExpenses, currentCostPerKg, deudaHistorica, orderById, orders]);

  // Alertas Proactivas
  const hoy = Date.now();
  const entregasAtrasadas = useMemo(() => provPurchases.filter((p) => {
    const o = orderById.get(p.id);
    if (!o?.estimatedDeliveryDate) return false;
    const kilosFaltan = (p.expectedKilos ?? 0) - (p.receivedKilos ?? 0);
    const ms = toDate(o.estimatedDeliveryDate)?.getTime();
    return kilosFaltan > 0.01 && ms !== undefined && ms < hoy;
  }), [provPurchases, orderById, hoy]);

  return {
    provPurchases,
    provExpenses,
    orderById,
    loading,
    error,
    stats,
    entregasAtrasadas,
    currentCostPerKg,
    deudaHistorica,
  };
}
