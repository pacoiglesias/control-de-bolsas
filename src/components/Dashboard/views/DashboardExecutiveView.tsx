import type { NavigateFunction } from 'react-router-dom';
import { ExecutivePriorityAlerts } from '../ExecutivePriorityAlerts';
import { MorningBriefingWidget } from '../MorningBriefingWidget';
import { CashFlowSimulatorWidget } from '../CashFlowSimulatorWidget';
import { ExecutiveFinancialCard } from '../ExecutiveFinancialCard';
import { ActiveOrdersMobileCards } from '../ActiveOrdersMobileCards';
import { MoneyFlowPipeline, type PipelineStageKey } from '../MoneyFlowPipeline';
import { SeguimientoPedidosTable } from '../SeguimientoPedidosTable';
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
  onOpenUniversalUpload,
}: DashboardExecutiveViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 0. Asistente Matutino de 3 Tareas Clave */}
      <MorningBriefingWidget
        orders={seguimientoOrders}
        config={config}
        onOpenQuickCollection={onOpenQuickCollection}
        onOpenUniversalUpload={onOpenUniversalUpload}
      />

      {/* 1. Radar Ejecutivo de Atención Prioritaria (Nava 1500kg, Evelia Esperando OC, Cobranza) */}
      <ExecutivePriorityAlerts
        orders={seguimientoOrders}
        config={config}
        onOpenQuickInvoice={onOpenQuickInvoice}
        onOpenQuickCollection={onOpenQuickCollection}
      />

      {/* 1.5 Simulador de Flujo Semanal & Capacidad de Compra */}
      <CashFlowSimulatorWidget
        orders={seguimientoOrders}
        config={config}
      />

      {/* 2. Tarjeta Financiera Ejecutiva y Resumen P&L */}
      <ExecutiveFinancialCard
        orders={seguimientoOrders}
        config={config as any}
        saldoCaja={saldoCaja}
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
    </div>
  );
}
