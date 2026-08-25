import { lazy, Suspense } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { Drawer } from '../ui';
import { ContrarecibosTable } from './ContrarecibosTable';
import { SeguimientoPedidosTable } from './SeguimientoPedidosTable';
import { QuickInvoiceModal } from '../FastFlows/QuickInvoiceModal';
import { QuickCollectionModal } from '../FastFlows/QuickCollectionModal';
import { QuickDeliveryModal } from '../FastFlows/QuickDeliveryModal';
import { PagarAndresModal } from '../Compras/PagarAndresModal';
import { MagicPasteModal } from '../MagicPasteModal';
import { SincronizadorOficialModal } from '../Cobranza/SincronizadorOficialModal';
import { downloadBackupJsonFile } from '../../lib/cloudBackup';
import type { PurchaseOrder, Expense, Purchase, FinancialConfig } from '../../lib/types';
import type { LiveLogEntry } from '../../pages/Dashboard';

const CloudBackupsModal = lazy(() => import('./CloudBackupsModal').then(m => ({ default: m.CloudBackupsModal })));
const LiveLogsModal = lazy(() => import('./LiveLogsModal').then(m => ({ default: m.LiveLogsModal })));
const ChangelogModalComponent = lazy(() => import('./ChangelogFeed').then(m => ({ default: m.ChangelogModal })));
const CorteMensualModal = lazy(() => import('./CorteMensualModal').then(m => ({ default: m.CorteMensualModal })));
const CorteSemanalModal = lazy(() => import('./CorteSemanalModal').then(m => ({ default: m.CorteSemanalModal })));
const BalanzaComprobacionModal = lazy(() => import('./BalanzaComprobacionModal').then(m => ({ default: m.BalanzaComprobacionModal })));

export interface DashboardModalsHostProps {
  showContrarecibosDrawer: boolean;
  setShowContrarecibosDrawer: (v: boolean) => void;
  showSeguimientoDrawer: boolean;
  setShowSeguimientoDrawer: (v: boolean) => void;
  showQuickInvoice: boolean;
  setShowQuickInvoice: (v: boolean) => void;
  selectedInvoiceOrderId?: string | null;
  setSelectedInvoiceOrderId?: (id: string | null) => void;
  showQuickDelivery?: boolean;
  setShowQuickDelivery?: (v: boolean) => void;
  selectedDeliveryOrderId?: string | null;
  showQuickCollection: boolean;
  setShowQuickCollection: (v: boolean) => void;
  showQuickPay: boolean;
  setShowQuickPay: (v: boolean) => void;
  showCorteMensual: boolean;
  setShowCorteMensual: (v: boolean) => void;
  showCorteSemanal: boolean;
  setShowCorteSemanal: (v: boolean) => void;
  showBalanza: boolean;
  setShowBalanza: (v: boolean) => void;
  showBackupsModal: boolean;
  setShowBackupsModal: (v: boolean) => void;
  showChangelogModal: boolean;
  setShowChangelogModal: (v: boolean) => void;
  showLiveLogsModal: boolean;
  setShowLiveLogsModal: (v: boolean) => void;
  showMagicPaste: boolean;
  setShowMagicPaste: (v: boolean) => void;
  showSincronizador: boolean;
  setShowSincronizador: (v: boolean) => void;

  seguimientoOrders: PurchaseOrder[];
  activeOrders: PurchaseOrder[];
  globalOrders: PurchaseOrder[];
  expenses: Expense[];
  purchases: Purchase[];
  config: FinancialConfig;
  settings: any;
  saldoCaja: number;
  cloudBackups: any[];
  backupBusy: boolean;
  handleCreateBackup: () => Promise<void>;
  handleRestoreBackup: (snap: any) => Promise<void>;
  liveLogs: LiveLogEntry[];
  nav: NavigateFunction;
}

export function DashboardModalsHost(props: DashboardModalsHostProps) {
  const {
    showContrarecibosDrawer, setShowContrarecibosDrawer,
    showSeguimientoDrawer, setShowSeguimientoDrawer,
    showQuickInvoice, setShowQuickInvoice, selectedInvoiceOrderId, setSelectedInvoiceOrderId,
    showQuickDelivery, setShowQuickDelivery, selectedDeliveryOrderId,
    showQuickCollection, setShowQuickCollection,
    showQuickPay, setShowQuickPay,
    showCorteMensual, setShowCorteMensual,
    showCorteSemanal, setShowCorteSemanal,
    showBalanza, setShowBalanza,
    showBackupsModal, setShowBackupsModal,
    showChangelogModal, setShowChangelogModal,
    showLiveLogsModal, setShowLiveLogsModal,
    showMagicPaste, setShowMagicPaste,
    showSincronizador, setShowSincronizador,
    seguimientoOrders, activeOrders, globalOrders,
    expenses, purchases, config, settings, saldoCaja,
    cloudBackups, backupBusy, handleCreateBackup, handleRestoreBackup,
    liveLogs, nav,
  } = props;

  return (
    <>
      {showContrarecibosDrawer && (
        <Drawer title="Vencimientos (Contrarecibos)" onClose={() => setShowContrarecibosDrawer(false)} width={900}>
          <ContrarecibosTable
            orders={seguimientoOrders}
            onOpenOrder={(order) => {
              setShowContrarecibosDrawer(false);
              nav(`/ordenes?abrir=${order.id}`);
            }}
          />
        </Drawer>
      )}

      {showSeguimientoDrawer && (
        <Drawer title="Seguimiento de Pedidos" onClose={() => setShowSeguimientoDrawer(false)} width={1000}>
          <SeguimientoPedidosTable 
            orders={seguimientoOrders} 
            onOpenOrder={(order) => {
              setShowSeguimientoDrawer(false);
              nav(`/ordenes?abrir=${order.id}`);
            }}
          />
        </Drawer>
      )}

      {showQuickInvoice && (
        <QuickInvoiceModal
          orders={seguimientoOrders}
          initialOrderId={selectedInvoiceOrderId}
          onClose={() => setShowQuickInvoice(false)}
        />
      )}

      {showQuickDelivery && setShowQuickDelivery && (
        <QuickDeliveryModal
          orders={seguimientoOrders}
          initialOrderId={selectedDeliveryOrderId}
          onClose={() => setShowQuickDelivery(false)}
          onOpenInvoice={(orderId) => {
            setShowQuickDelivery(false);
            if (setSelectedInvoiceOrderId) setSelectedInvoiceOrderId(orderId);
            setShowQuickInvoice(true);
          }}
        />
      )}

      {showQuickCollection && (
        <QuickCollectionModal orders={seguimientoOrders} onClose={() => setShowQuickCollection(false)} />
      )}

      {showQuickPay && (
        <PagarAndresModal onClose={() => setShowQuickPay(false)} />
      )}

      <Suspense fallback={null}>
        {showCorteMensual && (
          <CorteMensualModal
            onClose={() => setShowCorteMensual(false)}
            orders={activeOrders}
            expenses={expenses}
            purchases={purchases}
            config={config}
            settings={settings}
          />
        )}

        {showCorteSemanal && (
          <CorteSemanalModal
            onClose={() => setShowCorteSemanal(false)}
            orders={activeOrders}
            expenses={expenses}
            purchases={purchases}
            config={config}
            settings={settings}
          />
        )}

        {showBalanza && (
          <BalanzaComprobacionModal
            onClose={() => setShowBalanza(false)}
            orders={activeOrders}
            expenses={expenses}
            purchases={purchases}
            config={config}
            settings={settings}
            saldoCajaSistema={saldoCaja}
          />
        )}

        {showBackupsModal && (
          <CloudBackupsModal
            onClose={() => setShowBackupsModal(false)}
            cloudBackups={cloudBackups}
            backupBusy={backupBusy}
            handleCreateBackup={handleCreateBackup}
            handleRestoreBackup={handleRestoreBackup}
            onDownloadJson={() => downloadBackupJsonFile(activeOrders, purchases, expenses, config)}
          />
        )}

        {showChangelogModal && (
          <ChangelogModalComponent onClose={() => setShowChangelogModal(false)} />
        )}

        {showLiveLogsModal && (
          <LiveLogsModal onClose={() => setShowLiveLogsModal(false)} liveLogs={liveLogs} />
        )}

        {showMagicPaste && (
          <MagicPasteModal onClose={() => setShowMagicPaste(false)} />
        )}

        {showSincronizador && (
          <SincronizadorOficialModal
            orders={globalOrders}
            onClose={() => setShowSincronizador(false)}
          />
        )}
      </Suspense>
    </>
  );
}
