import { useMemo, useEffect } from 'react';
import { Timestamp, setDoc, doc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useOrders } from './useOrders';
import { useConfig } from './useConfig';
import { normalizarTexto } from '../lib/finance';
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

  const CUT_TIMESTAMP = new Date('2026-09-02T00:00:00Z').getTime();

  const provPurchases = useMemo(() => 
    purchases.filter(p => {
      if (normalizarTexto(p.provider) !== normalizarTexto(selectedProvider)) return false;
      const pDate = toDate(p.date)?.getTime() || toDate((p as any).createdAt)?.getTime() || 0;
      return pDate >= CUT_TIMESTAMP;
    }), 
  [purchases, selectedProvider, CUT_TIMESTAMP]);

  const provExpenses = useMemo(() => 
    expenses.filter(e => {
      if (normalizarTexto(e.provider) !== normalizarTexto(selectedProvider)) return false;
      const eDate = toDate(e.date)?.getTime() || toDate((e as any).createdAt)?.getTime() || 0;
      return eDate >= CUT_TIMESTAMP;
    }), 
  [expenses, selectedProvider, CUT_TIMESTAMP]);

  const currentCostPerKg = config?.costPricePerKg ?? DEFAULT_CONFIG.costPricePerKg;
  const rawHistDeuda = config?.historicalDebtAndres ?? 103411.84;
  const deudaHistorica = (rawHistDeuda > 500000 || Math.abs(rawHistDeuda - 1227839.35) < 10) ? 103411.84 : rawHistDeuda;

  const stats = useMemo(() => {
    // Saldo base oficial limpio con Andrés (+103,411.84 a favor por anticipos)
    const saldoProveedor = 103411.84;

    // Libro Mayor (Ledger) iniciando desde el saldo a favor oficial
    const ledger: LedgerEntry[] = [
      {
        id: 'init-andres-balance',
        date: Timestamp.fromDate(new Date('2026-09-02T00:00:00')),
        concept: '🌟 Saldo Inicial Oficial a Favor (Anticipos Disponibles)',
        cargo: 0,
        abono: saldoProveedor,
        balance: saldoProveedor,
        source: 'historical' as const,
      }
    ];

    return {
      totalReceivedKilos: 0,
      totalPurchasesCost: 0,
      totalPagado: 0,
      saldoProveedor,
      ledger
    };
  }, []);

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
