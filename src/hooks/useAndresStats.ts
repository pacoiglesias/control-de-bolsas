import { useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useOrders } from './useOrders';
import { useConfig } from './useConfig';
import { normalizarTexto,computeAndresBalance,round2,getAndresPurchaseCost,mergeProviderPayments } from '../lib/finance';
import { toDate } from '../lib/format';
export type LedgerEntry = {
  id: string;
  date: Timestamp | null;
  concept: string;
  cargo: number;
  abono: number;
  balance: number;
  source: 'purchase' | 'expense' | 'historical';
  sourceSequence?: number;
  statementReported?:boolean;
};

import { DEFAULT_CONFIG } from '../lib/types';

export function useAndresStats(selectedProvider: string = 'Andres') {
  const { purchases, loading: loadingP, error: errorP } = usePurchases();
  const { expenses, loading: loadingE, error: errorE } = useExpenses();
  const { orders } = useOrders();
  const { config } = useConfig();

  const loading = loadingP || loadingE;
  const error = errorP || errorE;

  const orderById = useMemo(() => {
    const lookup=new Map(orders.map(order=>[order.id,order]));
    purchases.forEach(purchase=>{const parent=purchase.orderId?lookup.get(purchase.orderId):undefined;if(parent)lookup.set(purchase.id,parent);});
    return lookup;
  }, [orders,purchases]);

  const CUT_TIMESTAMP = new Date(config?.providerBalanceCutoff || '2026-09-02T00:00:00Z').getTime();

  const provPurchases = useMemo(() => 
    purchases.filter(p => {
      if (normalizarTexto(p.provider) !== normalizarTexto(selectedProvider)) return false;
      const pDate = toDate(p.date)?.getTime() || toDate((p as any).createdAt)?.getTime() || 0;
      return pDate >= CUT_TIMESTAMP;
    }), 
  [purchases, selectedProvider, CUT_TIMESTAMP]);

  const provExpenses = useMemo(() => 
    mergeProviderPayments(expenses.filter(e=>!e.isDeleted && !(e as any).isSuperseded),config,selectedProvider).filter(e => {
      if (e.isDeleted || (e as any).isSuperseded || (normalizarTexto(e.provider) !== normalizarTexto(selectedProvider) && !(normalizarTexto(selectedProvider)==='andres' && e.isAndresPayment))) return false;
      const eDate = toDate(e.date)?.getTime() || toDate((e as any).createdAt)?.getTime() || 0;
      return eDate >= CUT_TIMESTAMP;
    }), 
  [expenses, selectedProvider, CUT_TIMESTAMP,config]);

  const currentCostPerKg = config?.costPricePerKg ?? DEFAULT_CONFIG.costPricePerKg;
  
  // Saldo histórico canónico del config: preserva montos válidos y signo exacto (+ a favor de Andrés/anticipos, - deuda de empresa).
  // Nunca sobreescribe Firestore automáticamente al abrir la pantalla.
  const deudaHistorica = typeof config?.historicalDebtAndres === 'number' 
    ? config.historicalDebtAndres 
    : (DEFAULT_CONFIG.historicalDebtAndres ?? 103411.84);

  const stats = useMemo(() => {
    // Saldo base: viene del config (historicalDebtAndres).
    // Convención: positivo = saldo a favor de Andrés (anticipos disponibles), negativo = deuda de empresa.
    const balance=computeAndresBalance(provPurchases,provExpenses,{...config,costPricePerKg:currentCostPerKg,historicalDebtAndres:deudaHistorica},selectedProvider);
    const saldoProveedor = balance.saldoProveedor;

    // Libro Mayor (Ledger) iniciando desde el saldo histórico del config
    const ledger: LedgerEntry[] = [
      {
        id: 'init-andres-balance',
        date: Timestamp.fromDate(new Date(CUT_TIMESTAMP+12*60*60*1000)),
        concept: deudaHistorica>=0?'Anticipo anterior disponible':'Saldo anterior pendiente de pagar al proveedor',
        cargo: deudaHistorica<0?Math.abs(deudaHistorica):0,
        abono: deudaHistorica>0?deudaHistorica:0,
        balance: deudaHistorica,
        source: 'historical' as const,
      }
    ];

    const movements:LedgerEntry[]=[
      ...provPurchases.map(p=>({id:p.id,date:Timestamp.fromDate(toDate(p.date)||new Date(CUT_TIMESTAMP)),concept:'Remisión '+((p as any).remissionNumber||p.id)+' · '+p.receivedKilos+' kg a $'+p.pricePerKg,cargo:getAndresPurchaseCost(p as any,currentCostPerKg),abono:0,balance:0,source:'purchase' as const,sourceSequence:(p as any).sourceSequence||0})),
      ...provExpenses.map(e=>({id:e.id||'',date:Timestamp.fromDate(toDate(e.date)||new Date(CUT_TIMESTAMP)),concept:e.concept||'Movimiento de proveedor',cargo:e.type==='ingreso'?Number(e.amount)||0:0,abono:e.type==='ingreso'?0:Number(e.amount)||0,balance:0,source:'expense' as const,sourceSequence:e.sourceSequence||0,statementReported:e.statementReported})),
    ].sort((a,b)=>a.date!.toMillis()-b.date!.toMillis()||a.sourceSequence-b.sourceSequence);
    let running=deudaHistorica;
    for(const move of movements){running=round2(running+move.abono-move.cargo);ledger.push({...move,balance:running});}
    return {
      totalReceivedKilos: balance.totalReceivedKilos,
      totalPurchasesCost: balance.totalPurchasesCost,
      totalPagado: balance.totalPagado,
      saldoProveedor,
      ledger
    };
  }, [deudaHistorica,provPurchases,provExpenses,currentCostPerKg,selectedProvider,CUT_TIMESTAMP,config]);

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
    sourceStatement:config?.providerStatement,
  };
}
