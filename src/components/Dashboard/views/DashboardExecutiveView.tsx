import type { NavigateFunction } from 'react-router-dom';
import { PendingDeliveriesExecutiveBoard } from '../PendingDeliveriesExecutiveBoard';
import { ExecutivePriorityAlerts } from '../ExecutivePriorityAlerts';
import { PriorityActionQueue } from '../PriorityActionQueue';
import { ReconciliationBoard } from '../ReconciliationBoard';
import { ProvidenciaCaptureReview } from '../../Upload/ProvidenciaCaptureReview';
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
  onOpenPrefactura?: (orderId?: string | null) => void;
  onOpenConciliacion?: () => void;
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
  onOpenPrefactura,
  onOpenConciliacion,
}: DashboardExecutiveViewProps) {
  const { role } = useAuth();
  const canOperate = role === 'admin' || role === 'manager';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 0. TABLERO DE CONTROL TOTAL: QUÉ FALTA POR ENTREGAR DE LAS OCs ABIERTAS Y VIGENTES */}
      <PendingDeliveriesExecutiveBoard
        orders={seguimientoOrders}
        saldoCaja={saldoCaja}
        onOpenQuickDelivery={onOpenQuickDelivery}
        onOpenQuickInvoice={onOpenQuickInvoice}
        onOpenPrefactura={onOpenPrefactura}
      />

      {canOperate && (
        <nav className="work-shortcuts" aria-label="Acciones de operación diaria">
          {onOpenUniversalUpload && (
            <button type="button" onClick={onOpenUniversalUpload}>
              <span>＋</span>
              <div>
                <strong>Subir documento</strong>
                <small>Detectar y completar datos</small>
              </div>
            </button>
          )}
          <button type="button" onClick={() => onOpenQuickDelivery()}>
            <span>01</span>
            <div>
              <strong>Registrar entrega</strong>
              <small>Captura kilos y remisión</small>
            </div>
          </button>
          <button type="button" onClick={() => onOpenQuickInvoice()}>
            <span>02</span>
            <div>
              <strong>Registrar factura</strong>
              <small>Vincula folio y entregas</small>
            </div>
          </button>
          {onOpenPrefactura && (
            <button type="button" onClick={() => onOpenPrefactura()}>
              <span>🧾</span>
              <div>
                <strong>Pre-factura CFDI 4.0</strong>
                <small>XML SAT y Excel oficial</small>
              </div>
            </button>
          )}
          {onOpenConciliacion && (
            <button type="button" onClick={onOpenConciliacion}>
              <span>⚖️</span>
              <div>
                <strong>Conciliación y CRs</strong>
                <small>Cuadre 100% y cobranza</small>
              </div>
            </button>
          )}
          <button type="button" onClick={onOpenQuickCollection}>
            <span>03</span>
            <div>
              <strong>Registrar cobro</strong>
              <small>Revisa pagos y saldos</small>
            </div>
          </button>
        </nav>
      )}

      {/* 0. Alertas Ejecutivas Prioritarias: Pods de Lic. Evelia (GT 9806 y 9807) e Ing. José Nava (TH 14302) */}
      <ExecutivePriorityAlerts
        orders={seguimientoOrders}
        config={config}
        onOpenQuickInvoice={onOpenQuickInvoice}
        onOpenQuickCollection={onOpenQuickCollection}
        onOpenPrefactura={onOpenPrefactura}
        onOpenConciliacion={onOpenConciliacion}
      />

      {/* 1. Centro Operativo Unificado: Qué Requiere Atención Hoy */}
      <ProvidenciaCaptureReview compact />
      <PriorityActionQueue
        orders={seguimientoOrders}
        config={config}
        onOpenQuickInvoice={onOpenQuickInvoice}
        onOpenQuickCollection={onOpenQuickCollection}
        onOpenQuickDelivery={onOpenQuickDelivery}
      />

      {/* 1.5 Tablero de conciliación: OC ↔ entregas ↔ facturas ↔ pagos */}
      <ReconciliationBoard
        orders={seguimientoOrders}
        config={config}
        onOpenOrder={(orderId) => nav(`/ordenes?abrir=${orderId}`)}
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
      <details className="work-details">
        <summary>Seguimiento de órdenes y etapas</summary>
        <div>
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
      </details>

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
