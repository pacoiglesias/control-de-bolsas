import { useMemo } from 'react';
import { useOrdersContext } from '../context/OrdersContext';
import { usePurchases } from './usePurchases';
import { useExpenses } from './useExpenses';
import { useConfig } from './useConfig';
import { runContinuousAutoAudit, type AuditHealthReport } from '../lib/auditEngine';

/**
 * Hook reutilizable que ejecuta el motor de auditoría continua con los datos
 * del contexto global. Memoiza el resultado para que múltiples consumidores
 * (badge, modal, dashboard card) no re-calculen independientemente.
 */
export function useAuditReport(): AuditHealthReport {
  const { orders } = useOrdersContext();
  const { purchases } = usePurchases();
  const { expenses } = useExpenses();
  const { config } = useConfig();

  return useMemo(
    () =>
      runContinuousAutoAudit({
        orders:    orders    || [],
        purchases: purchases || [],
        expenses:  expenses  || [],
        config:    config as any,
      }),
    [orders, purchases, expenses, config],
  );
}
