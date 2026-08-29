import type { NavigateFunction } from 'react-router-dom';
import { ProactiveBriefingCard } from '../ProactiveBriefingCard';
import { ExecutiveFinancialCard } from '../ExecutiveFinancialCard';
import { ActiveOrdersMobileCards } from '../ActiveOrdersMobileCards';
import { MoneyFlowPipeline, type PipelineStageKey } from '../MoneyFlowPipeline';
import { SeguimientoPedidosTable } from '../SeguimientoPedidosTable';
import { FinancialTrendChart } from '../FinancialTrendChart';
import type { PurchaseOrder, Expense, FinancialConfig } from '../../../lib/types';

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
}: DashboardExecutiveViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Radar Proactivo + Tarjeta Financiera Ejecutiva */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
        {/* Lado Izquierdo: Asistente Proactivo */}
        <div style={{ flex: 1.5 }}>
          <ProactiveBriefingCard
            orders={seguimientoOrders}
            config={config as any}
            onOpenQuickInvoice={() => onOpenQuickInvoice(null)}
            onOpenQuickCollection={onOpenQuickCollection}
            onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
          />
        </div>

        {/* Lado Derecho: Tarjeta Financiera Ejecutiva y P&L */}
        <div style={{ flex: 1 }}>
          <ExecutiveFinancialCard
            orders={seguimientoOrders}
            config={config as any}
            saldoCaja={saldoCaja}
          />
        </div>
      </div>

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

      {/* 5. Gráfico Visual Interactivo de Flujo y Tendencia de Kilos */}
      <FinancialTrendChart orders={seguimientoOrders} />
    </div>
  );
}
