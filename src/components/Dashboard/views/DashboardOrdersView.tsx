import type { NavigateFunction } from 'react-router-dom';
import { SeguimientoPedidosTable } from '../SeguimientoPedidosTable';
import type { PurchaseOrder } from '../../../lib/types';
import type { PipelineStageKey } from '../MoneyFlowPipeline';

interface DashboardOrdersViewProps {
  seguimientoOrders: PurchaseOrder[];
  selectedPipelineStage: PipelineStageKey | null;
  onSelectPipelineStage: (st: PipelineStageKey | null) => void;
  nav: NavigateFunction;
  onOpenQuickInvoice: () => void;
  onOpenQuickCollection: () => void;
}

export function DashboardOrdersView({
  seguimientoOrders,
  selectedPipelineStage,
  onSelectPipelineStage,
  nav,
  onOpenQuickInvoice,
  onOpenQuickCollection,
}: DashboardOrdersViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>📁</span>
        <span>Expedientes, Órdenes de Compra y Entregas en Báscula</span>
      </div>

      <SeguimientoPedidosTable
        orders={seguimientoOrders}
        filterStage={selectedPipelineStage}
        onFilterStageChange={onSelectPipelineStage}
        onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
        onQuickInvoice={onOpenQuickInvoice}
        onQuickCollection={onOpenQuickCollection}
      />
    </div>
  );
}
