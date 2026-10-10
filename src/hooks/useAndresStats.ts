import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
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
  
  // Saldo histórico canónico del config: preserva montos válidos y signo exacto (+ a favor de Andrés/anticipos, - deuda de empresa).
  // Nunca sobreescribe Firestore automáticamente al abrir la pantalla.
  const deudaHistorica = typeof config?.historicalDebtAndres === 'number' 
    ? config.historicalDebtAndres 
    : (DEFAULT_CONFIG.historicalDebtAndres ?? 103411.84);

  const stats = useMemo(() => {
    // Saldo base: viene del config (historicalDebtAndres).
    // Convención: positivo = saldo a favor de Andrés (anticipos disponibles), negativo = deuda de empresa.
    const saldoProveedor = deudaHistorica;

    // Libro Mayor (Ledger) iniciando desde el saldo histórico del config
    const ledger: LedgerEntry[] = [
      {
        id: 'init-andres-balance',
        date: Timestamp.fromDate(new Date('2026-09-02T00:00:00')),
        concept: 'Saldo Inicial Oficial a Favor (Anticipos Disponibles)',
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
  }, [deudaHistorica]);

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
