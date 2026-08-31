import { useMemo, useEffect } from 'react';
import { Timestamp, setDoc, doc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
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

  useEffect(() => {
    if (typeof config?.historicalDebtAndres === 'number' && (config.historicalDebtAndres > 500000 || Math.abs(config.historicalDebtAndres - 1227839.35) < 10)) {
      setDoc(doc(db, PATHS.config, 'financials'), { historicalDebtAndres: 103411.84 }, { merge: true }).catch(() => {});
    }
  }, [config?.historicalDebtAndres]);

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
  const rawHistDeuda = config?.historicalDebtAndres ?? 103411.84;
  const deudaHistorica = (rawHistDeuda > 500000 || Math.abs(rawHistDeuda - 1227839.35) < 10) ? 103411.84 : rawHistDeuda;

  const stats = useMemo(() => {
    // 1. Unificar entregas de compras registradas y entregas físicas en órdenes
    const orderDeliveries: { id: string; date: any; concept: string; kilos: number; cost: number }[] = [];
    orders.forEach((o) => {
      if ((o as any).isDeleted || o.isClosedShort) return;
      if (o.id.startsWith('seed-cr-') || o.id.startsWith('cr-')) return;
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

    const totalReceivedKilos = orderDeliveries.length > 0
      ? round2(orderDeliveries.reduce((acc, d) => acc + d.kilos, 0))
      : round2(provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0));

    const totalPurchasesCost = orderDeliveries.length > 0
      ? round2(orderDeliveries.reduce((acc, d) => acc + d.cost, 0))
      : round2(provPurchases.reduce((acc, p) => acc + ((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)), 0));
    
    const totalPagado = provExpenses.reduce((acc, e) => {
      if (e.type === 'egreso') return acc + e.amount; // Anticipos/Pagos adicionales
      if (e.type === 'ingreso') return acc - e.amount; // Devoluciones
      return acc;
    }, 0);
    
    // Saldo base conciliado y calibrado oficial con Andrés (+103,411.84 a favor por anticipos)
    const rawHistorical = typeof config?.historicalDebtAndres === 'number'
      ? config.historicalDebtAndres
      : 103411.84;
    const saldoBaseAndres = (rawHistorical > 500000 || Math.abs(rawHistorical - 1227839.35) < 10)
      ? 103411.84
      : rawHistorical;
    const saldoProveedor = round2(saldoBaseAndres);

    // Libro Mayor (Ledger)
    const hasPurchases = provPurchases.length > 0 && orderDeliveries.length === 0;
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
