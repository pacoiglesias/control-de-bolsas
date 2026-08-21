import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useOrders } from './useOrders';
import { useConfig } from './useConfig';
import { round2, normalizarTexto, computeAndresBalance } from '../lib/finance';
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

  const currentCostPerKg = config?.costPricePerKg || 42;
  const deudaHistorica = config?.historicalDebtAndres || 0;

  const stats = useMemo(() => {
    // FIX (auditoría v8.9.5): esta misma fórmula (kilos/costo/pagado/saldo)
    // vivía copiada aquí, en useDashboardStatsV2.ts y en el handler de
    // ledger del Portal Maquilador (functions/src/index.ts) -- la misma
    // clase de bug que causó el incidente real del "Saldo con Andrés"
    // ($1.3M de diferencia entre Dashboard y esta misma pantalla, para el
    // mismo dato). Ahora las tres llaman a computeAndresBalance(), la
    // fuente única de verdad (ver finance.core.ts).
    const balance = computeAndresBalance(
      provPurchases,
      provExpenses,
      { costPricePerKg: currentCostPerKg, historicalDebtAndres: deudaHistorica },
      selectedProvider,
    );
    const { totalReceivedKilos, totalPagado, saldoProveedor } = balance;
    const totalPurchasesCost = round2(balance.totalPurchasesCost);

    // Libro Mayor (Ledger)
    const ledger: LedgerEntry[] = [
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
      const ta = toDate(a.date)?.getTime() || 0;
      const tb = toDate(b.date)?.getTime() || 0;
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
  }, [provPurchases, provExpenses, currentCostPerKg, deudaHistorica, orderById, selectedProvider]);

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
