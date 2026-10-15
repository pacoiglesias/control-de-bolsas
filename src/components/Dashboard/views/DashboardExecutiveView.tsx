import type { NavigateFunction } from 'react-router-dom';
import { PriorityActionQueue } from '../PriorityActionQueue';
import { CashFlowSimulatorWidget } from '../CashFlowSimulatorWidget';
import { ExecutiveFinancialCard } from '../ExecutiveFinancialCard';
import { ActiveOrdersMobileCards } from '../ActiveOrdersMobileCards';
import { MoneyFlowPipeline, type PipelineStageKey } from '../MoneyFlowPipeline';
import { SeguimientoPedidosTable } from '../SeguimientoPedidosTable';
import type { PurchaseOrder, Expense, FinancialConfig } from '../../../lib/types';
import { useAuth } from '../../../context/AuthContext';

interface DashboardExecutiveViewProps {
  seguimientoOrders: PurchaseOrder[];
  config: FinancialConfig;
  saldoCaja: number;
  expenses: Expense[];
  nav: NavigateFunction;
  selectedPipelineStage: PipelineStageKey | null;
  onSelectPipelineStage: (st: PipelineStageKey | null) => void;
  onOpenQuickInvoice: (orderId?: string | null) => void;
  onOpenQuickCollection: () => void;
  onOpenQuickDelivery: (orderId?: string | null) => void;
  onOpenUniversalUpload?: () => void;
}

export function DashboardExecutiveView({
  seguimientoOrders,
  config,
  saldoCaja,
  expenses,
  nav,
  selectedPipelineStage,
  onSelectPipelineStage,
  onOpenQuickInvoice,
  onOpenQuickCollection,
  onOpenQuickDelivery,
  onOpenUniversalUpload: _onOpenUniversalUpload,
}: DashboardExecutiveViewProps) {
  const { role } = useAuth();
  const canOperate = role === 'admin' || role === 'manager';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {canOperate && <nav className="work-shortcuts" aria-label="Acciones de operación diaria">
        <button type="button" onClick={() => onOpenQuickDelivery()}><span>01</span><div><strong>Registrar entrega</strong><small>Captura kilos y remisión</small></div></button>
        <button type="button" onClick={() => onOpenQuickInvoice()}><span>02</span><div><strong>Registrar factura</strong><small>Vincula folio y entregas</small></div></button>
        <button type="button" onClick={onOpenQuickCollection}><span>03</span><div><strong>Registrar cobro</strong><small>Revisa pagos y saldos</small></div></button>
      </nav>}
      {/* 0. Centro Operativo Unificado: Qué Requiere Atención Hoy */}
      <PriorityActionQueue
        orders={seguimientoOrders}
        config={config}
        onOpenQuickInvoice={onOpenQuickInvoice}
        onOpenQuickCollection={onOpenQuickCollection}
        onOpenQuickDelivery={onOpenQuickDelivery}
      />

      {/* 2. Vista Móvil de Tarjetas de OCs Activas con Acciones Directas */}
      <div className="mobile-cards-list">
        <ActiveOrdersMobileCards
          orders={seguimientoOrders}
          config={config as any}
          onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
          onQuickDelivery={(orderId) => onOpenQuickDelivery(orderId)}
          onQuickInvoice={(orderId) => onOpenQuickInvoice(orderId)}
        />
      </div>

      {/* 3. Pipeline Financiero de 5 Estaciones */}
      <MoneyFlowPipeline
        orders={seguimientoOrders}
        expenses={expenses}
        config={config}
        nav={nav}
        selectedStage={selectedPipelineStage}
        onSelectStage={onSelectPipelineStage}
      />

      {/* 4. Tabla de Órdenes Vinculada al Pipeline */}
      <SeguimientoPedidosTable
        orders={seguimientoOrders}
        filterStage={selectedPipelineStage}
        onFilterStageChange={onSelectPipelineStage}
        onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
        onQuickInvoice={() => onOpenQuickInvoice(null)}
        onQuickCollection={onOpenQuickCollection}
      />
      <details className="work-details">
        <summary>Consultar finanzas y simular compras</summary>
        <div>
          <ExecutiveFinancialCard orders={seguimientoOrders} config={config} saldoCaja={saldoCaja} />
          <CashFlowSimulatorWidget orders={seguimientoOrders} config={config} />
        </div>
      </details>
    </div>
  );
}
