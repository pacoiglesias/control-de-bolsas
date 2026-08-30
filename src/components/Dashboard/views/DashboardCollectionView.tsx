import type { NavigateFunction } from 'react-router-dom';
import { WeeklyCollectionSummary } from '../WeeklyCollectionSummary';
import { ContrarecibosTimeline } from '../ContrarecibosTimeline';
import { PorRecibirPanel } from '../PorRecibirPanel';
import { FacturasSinCRPanel } from '../FacturasSinCRPanel';
import { SemaforoDelDia } from '../SemaforoDelDia';
import { SmartAlerts } from '../SmartAlerts';
import { CashflowProjection } from '../CashflowProjection';
import type { PurchaseOrder, Purchase, FinancialConfig } from '../../../lib/types';

interface DashboardCollectionViewProps {
  seguimientoOrders: PurchaseOrder[];
  activeOrders: PurchaseOrder[];
  purchases: Purchase[];
  config: FinancialConfig;
  nav: NavigateFunction;
  k: any;
  handleRecibir: (r: any) => Promise<void>;
  recibiendoId: string | null;
  onOpenQuickCollection: () => void;
  onOpenQuickInvoice: () => void;
  viewModeAll?: boolean;
}

export function DashboardCollectionView({
  seguimientoOrders,
  activeOrders,
  purchases,
  config,
  nav,
  k,
  handleRecibir,
  recibiendoId,
  onOpenQuickCollection,
  onOpenQuickInvoice,
  viewModeAll = false,
}: DashboardCollectionViewProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: viewModeAll ? 24 : 0 }}>
      {!viewModeAll && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📆</span>
            <span>Centro de Cobranza & Contrarecibos Providencia</span>
          </div>
        </div>
      )}

      {/* 1. Resumen Semanal de Proyección de Cobranza */}
      <WeeklyCollectionSummary
        orders={seguimientoOrders}
        onOpenQuickCollection={onOpenQuickCollection}
      />

      {/* 2. Grid de 2 Columnas: Línea de Tiempo + Alertas de Facturación */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        {/* Columna Principal: Timeline de Contrarecibos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <ContrarecibosTimeline orders={seguimientoOrders} nav={nav} />
          <PorRecibirPanel
            porRecibir={k.porRecibir}
            totalPorRecibir={k.totalPorRecibir}
            onRecibir={handleRecibir}
            recibiendoId={recibiendoId}
          />
        </div>

        {/* Columna Lateral: Facturas en espera de CR y Semáforo Operativo */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <FacturasSinCRPanel
            orders={seguimientoOrders}
            onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
          />

          <SemaforoDelDia
            orders={seguimientoOrders}
            purchases={purchases}
            config={config}
            nav={nav}
            onOpenQuickInvoice={onOpenQuickInvoice}
            onOpenQuickCollection={onOpenQuickCollection}
          />

          <SmartAlerts orders={activeOrders} deudaAndres={k.deudaAndres} />
          <CashflowProjection orders={activeOrders} />
        </div>
      </div>
    </div>
  );
}
