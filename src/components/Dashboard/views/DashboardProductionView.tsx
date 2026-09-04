import { KilosSpeedometer } from '../KilosSpeedometer';
import { BandejaMaquilaWidget } from '../BandejaMaquilaWidget';
import type { PurchaseOrder } from '../../../lib/types';

interface DashboardProductionViewProps {
  activeOrders: PurchaseOrder[];
  providerName: string;
  viewModeAll?: boolean;
}

export function DashboardProductionView({
  activeOrders,
  providerName,
  viewModeAll = false,
}: DashboardProductionViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: viewModeAll ? 24 : 0 }}>
      {!viewModeAll && (
        <div style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🏭</span>
          <span>Compras, Suministro y Kilos de {providerName || 'Andrés'}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <KilosSpeedometer orders={activeOrders} />
        <BandejaMaquilaWidget />
      </div>
    </div>
  );
}
