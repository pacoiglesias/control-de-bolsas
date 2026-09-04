import { ExecutiveFinancialCard } from '../ExecutiveFinancialCard';
import type { PurchaseOrder, FinancialConfig } from '../../../lib/types';

interface DashboardPnlViewProps {
  seguimientoOrders: PurchaseOrder[];
  config: FinancialConfig;
  saldoCaja: number;
}

export function DashboardPnlView({
  seguimientoOrders,
  config,
  saldoCaja,
}: DashboardPnlViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚖️</span>
        <span>Corte Financiero Ejecutivo & Reparto de Utilidades 50/50</span>
      </div>

      <ExecutiveFinancialCard
        orders={seguimientoOrders}
        config={config}
        saldoCaja={saldoCaja}
      />
    </div>
  );
}
