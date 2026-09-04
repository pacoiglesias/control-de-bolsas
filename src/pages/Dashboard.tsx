import { useMemo, useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { shareHtmlAsPdf } from '../lib/format';
import { round2, filterOrderByDepartment, inferDepartment, getOrderSummary } from '../lib/finance';
import { usePurchases } from '../hooks/usePurchases';
import { useOrdersContext } from '../context/OrdersContext';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useToast } from '../context/ToastContext';
import { Skeleton } from '../components/ui';
import { confirmDialog } from '../lib/confirmDialog';
import { createCloudBackup, listCloudBackups, restoreCloudBackup, type CloudSnapshotMeta } from '../lib/cloudBackup';
import type { PurchaseOrder } from '../lib/types';
import { useDashboardStats } from '../hooks/useDashboardStatsV2';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { getRentabilidadHtml } from './DashboardReports';
import { autoHealAndPurgeErpDatabase } from '../lib/autoHealEngine';
import { triggerHaptic } from '../lib/hapticEngine';
import { sound } from '../lib/sounds';
import confetti from 'canvas-confetti';

// Componentes Modulares del Dashboard
import { DashboardLiveTicker } from '../components/Dashboard/DashboardLiveTicker';
import { DashboardHeaderToolbar } from '../components/Dashboard/DashboardHeaderToolbar';
import { ModernKpiGrid } from '../components/Dashboard/ModernKpiGrid';
import { DashboardViewModeTabs, type DashboardViewMode } from '../components/Dashboard/DashboardViewModeTabs';
import { DashboardExecutiveView } from '../components/Dashboard/views/DashboardExecutiveView';
import { DashboardOrdersView } from '../components/Dashboard/views/DashboardOrdersView';
import { DashboardCollectionView } from '../components/Dashboard/views/DashboardCollectionView';
import { DashboardProductionView } from '../components/Dashboard/views/DashboardProductionView';
import { DashboardPnlView } from '../components/Dashboard/views/DashboardPnlView';
import { DashboardSystemStatusFooter } from '../components/Dashboard/DashboardSystemStatusFooter';
import { DashboardModalsHost } from '../components/Dashboard/DashboardModalsHost';
import { MobileQuickDock } from '../components/Dashboard/MobileQuickDock';
import { AdminQuickEditPanel } from '../components/Dashboard/AdminQuickEditPanel';
import { AdminFloatingButton } from '../components/Dashboard/AdminFloatingButton';
import type { PipelineStageKey } from '../components/Dashboard/MoneyFlowPipeline';

export interface LiveLogEntry {
  id: string;
  user: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: Date | null;
}

export default function Dashboard() {
  const { purchases } = usePurchases();
  const { expenses, loading: loadingExp } = useExpenses();
  const { settings } = useSystemSettings();
  const { orders: globalOrders, loading: loadingGlobalOrders } = useOrdersContext();
  const { role, user } = useAuth();
  const { config } = useConfig();
  const nav = useNavigate();
  const toast = useToast();

  // Estados de Monitoreo y Respaldos
  const [health] = useState<{ snapshotDate: Date | null; recentLogs: number; dbStatus: string }>({
    snapshotDate: null,
    recentLogs: 0,
    dbStatus: 'Conectado',
  });
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showLiveLogsModal, setShowLiveLogsModal] = useState(false);
  const [liveLogs] = useState<LiveLogEntry[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudSnapshotMeta[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [recibiendoId, setRecibiendoId] = useState<string | null>(null);

  // Filtros y Espacios de Trabajo
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<DashboardViewMode>('executive');
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<PipelineStageKey | null>(null);

  // Estados de Modales y Drawers
  const [showContrarecibosDrawer, setShowContrarecibosDrawer] = useState(false);
  const [showSeguimientoDrawer, setShowSeguimientoDrawer] = useState(false);
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [selectedInvoiceOrderId, setSelectedInvoiceOrderId] = useState<string | null>(null);
  const [showQuickDelivery, setShowQuickDelivery] = useState(false);
  const [selectedDeliveryOrderId, setSelectedDeliveryOrderId] = useState<string | null>(null);
  const [showQuickCollection, setShowQuickCollection] = useState(false);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [showCorteMensual, setShowCorteMensual] = useState(false);
  const [showCorteSemanal, setShowCorteSemanal] = useState(false);
  const [showBalanza, setShowBalanza] = useState(false);
  const [showMagicPaste, setShowMagicPaste] = useState(false);
  const [showSincronizador, setShowSincronizador] = useState(false);
  const [showUniversalUpload, setShowUniversalUpload] = useState(false);
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showQuickEdit, setShowQuickEdit] = useState(false);

  // Cerrar menús desplegables al hacer clic fuera
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setShowReportsMenu(false);
        setShowExportMenu(false);
      }
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Atajos de Teclado Globales (N = Nueva OC, F = Facturar, C = Cobrar, P = Pegar WhatsApp)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.toLowerCase();
      if (k === 'n') {
        e.preventDefault();
        nav('/ordenes?nueva=1');
      } else if (k === 'f') {
        e.preventDefault();
        setSelectedInvoiceOrderId(null);
        setShowQuickInvoice(true);
      } else if (k === 'c') {
        e.preventDefault();
        setShowQuickCollection(true);
      } else if (k === 'p') {
        e.preventDefault();
        setShowMagicPaste(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nav]);

  const recalcStats = useMemo(() => async () => {
    setRecalcBusy(true);
    try {
      const fn = httpsCallable<unknown, { ok: boolean; procesados: number; mensaje: string }>(
        functions, 'recalcDashboardStats',
      );
      const res = await fn({});
      toast(res.data.mensaje, 'ok');
    } catch (e) {
      toast(`No se pudieron recalcular los indicadores: ${(e as Error).message}`, 'bad');
    } finally {
      setRecalcBusy(false);
    }
  }, [toast]);

  // Filtrado departamental de órdenes
  const seguimientoOrders = useMemo(() => {
    return globalOrders
      .map((o: PurchaseOrder) => filterOrderByDepartment(o, deptFilter))
      .filter((o): o is PurchaseOrder => o !== null);
  }, [globalOrders, deptFilter]);

  const activeOrders = useMemo(() => {
    return globalOrders.filter(o => !(o as any).isDeleted);
  }, [globalOrders]);

  // Métricas financieras departamentales en vivo para los botones de filtrado
  const deptPorCobrar = useMemo(() => {
    let all = 0;
    let th = 0;
    let gt = 0;

    globalOrders.forEach(o => {
      if ((o as any).isDeleted) return;
      (o.invoices || []).forEach(inv => {
        const st = inv.creditCycle?.status;
        const paidAmt = inv.collection?.paidAmount || 0;
        const total = inv.financials?.invoiceTotal ?? (Number(inv.kilos || 0) * (config?.salePricePerKg || 43) * (1 + (config?.ivaRate || 0.16)));
        if (st === 'paid' || st === 'collected' || (paidAmt >= total && total > 0)) return;
        if (total <= 0) return;

        all += total;
        const dept = inferDepartment(o, inv);
        if (dept === 'TH') th += total;
        else if (dept === 'GT') gt += total;
      });
    });

    return { all, th, gt };
  }, [globalOrders, config]);

  const k = useDashboardStats(null, activeOrders, monthFilter, config as any, purchases, expenses, seguimientoOrders, deptFilter);

  const saldoCaja = useMemo(() => {
    return round2((expenses || []).reduce((acc, e) => {
      if (!e) return acc;
      return acc + (e.type === 'ingreso' ? e.amount : -e.amount);
    }, 0));
  }, [expenses]);

  const pendingInvoicesCount = useMemo(() => {
    return seguimientoOrders.filter(o => {
      if ((o as any).isDeleted) return false;
      if (o.isClosedShort) return false;
      const orderStatus = (o as any).status || o.creditCycle?.status;
      if (orderStatus === 'facturado' || orderStatus === 'completado' || orderStatus === 'revision') return false;
      const s = getOrderSummary(o);
      return s.kilosDelivered > s.kilosInvoiced + 0.05;
    }).length;
  }, [seguimientoOrders]);

  const pendingCollectionsCount = useMemo(() => {
    let count = 0;
    seguimientoOrders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        if (inv.creditCycle?.status === 'pending' || inv.creditCycle?.status === 'overdue' || inv.creditCycle?.status === 'in_review' || inv.creditCycle?.status === 'paid') {
          count++;
        }
      });
    });
    return count;
  }, [seguimientoOrders]);

  const contrarecibosVencidosCount = useMemo(() => {
    const ahora = Date.now();
    let n = 0;
    for (const o of activeOrders) {
      for (const inv of o.invoices ?? []) {
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if (!cr) continue;
        const due = inv.creditCycle?.dueDate;
        const dueMs = due ? (typeof (due as any).toDate === 'function' ? (due as any).toDate().getTime() : new Date(due as any).getTime()) : null;
        if (dueMs !== null && dueMs < ahora) n++;
      }
    }
    return n;
  }, [activeOrders]);

  function printRentabilidad() {
    const html = getRentabilidadHtml(settings, k, config);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareRentabilidad() {
    const html = getRentabilidadHtml(settings, k, config);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Rentabilidad_Providencia_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  async function handleRecibir(r: { orderId: string; invoiceId: string; folio: string; cr: string; invoiceTotal: number; commission: number; net: number }) {
    if (recibiendoId === r.invoiceId) return;
    setRecibiendoId(r.invoiceId);
    try {
      if (!(await confirmDialog(`¿Mover $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} de la factura #${r.folio} a Caja Chica?`))) return;

      const orderRef = doc(db, PATHS.orders, r.orderId);
      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) throw new Error("Orden no encontrada");

      const orderData = orderSnap.data();
      const invoices = orderData.invoices || [];
      const invIndex = invoices.findIndex((i: any) => i.id === r.invoiceId);
      if (invIndex === -1) throw new Error("Factura no encontrada");

      invoices[invIndex].creditCycle.status = 'collected';
      invoices[invIndex].collection = { ...invoices[invIndex].collection, collectedAt: Timestamp.now() };

      await updateDoc(orderRef, { invoices });

      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.now(),
        concept: `Cobro factura #${r.folio} (CR: ${r.cr})`,
        amount: r.net,
        type: 'ingreso',
        notes: `Documento: $${r.invoiceTotal.toLocaleString('es-MX', {minimumFractionDigits:2})} — Comisión: $${r.commission.toLocaleString('es-MX', {minimumFractionDigits:2})}`,
        createdAt: serverTimestamp(),
      });

      toast(`💵 Recibido del contador. $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} agregado a CAJA.`, 'ok');
    } catch (e: any) {
      toast('Error: ' + e.message, 'bad');
    } finally {
      setRecibiendoId(null);
    }
  }

  const handleCreateBackup = async () => {
    setBackupBusy(true);
    try {
      await createCloudBackup(user?.email, globalOrders, purchases, expenses, config as any);
      const updated = await listCloudBackups();
      setCloudBackups(updated);
      toast('✅ Respaldo en la nube creado exitosamente.', 'ok');
    } catch (err) {
      toast(`❌ Error al crear respaldo: ${(err as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleOpenBackupsModal = async () => {
    setBackupBusy(true);
    try {
      const snaps = await listCloudBackups();
      setCloudBackups(snaps);
      setShowBackupsModal(true);
    } catch (err) {
      toast(`❌ Error al consultar respaldos: ${(err as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  };

  const handleRestoreBackup = async (snap: any) => {
    setBackupBusy(true);
    try {
      await restoreCloudBackup(user?.email, snap);
      toast('✅ Respaldo restaurado con éxito.', 'ok');
      setShowBackupsModal(false);
    } catch (err) {
      toast(`❌ Error al restaurar: ${(err as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  };

  const [isHealing, setIsHealing] = useState(false);

  const handleAutoHeal = async () => {
    setIsHealing(true);
    triggerHaptic('medium');
    try {
      const res = await autoHealAndPurgeErpDatabase();
      sound.playChaChing();
      confetti({ particleCount: 60, spread: 60, origin: { y: 0.6 } });
      toast(`✨ ${res.message}`, 'ok');
    } catch (e: any) {
      toast(`❌ Error en auto-sanación: ${e.message}`, 'bad');
    } finally {
      setIsHealing(false);
    }
  };

  if (loadingGlobalOrders || loadingExp) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 280, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '60%', height: 16 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="skeleton-card" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container" style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 60 }}>
      {/* 0. Franja Superior de Pulso Financiero en Vivo */}
      <DashboardLiveTicker
        saldoCaja={saldoCaja}
        porCobrar={k.porCobrar}
        deudaAndres={k.deudaAndres}
        providerName={settings?.providerName || 'Andrés'}
        kilosTotal={k.kilosTotal}
      />

      {/* 1. Encabezado Maestro y Filtro Departamental (TH vs GT) */}
      <DashboardHeaderToolbar
        nav={nav}
        toast={toast}
        deptFilter={deptFilter}
        setDeptFilter={setDeptFilter}
        monthFilter={monthFilter}
        setMonthFilter={setMonthFilter}
        deptPorCobrar={deptPorCobrar}
        settings={settings}
        mesesKeys={k.mesesKeys}
        showReportsMenu={showReportsMenu}
        setShowReportsMenu={setShowReportsMenu}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        onOpenCorteMensual={() => setShowCorteMensual(true)}
        onOpenCorteSemanal={() => setShowCorteSemanal(true)}
        onOpenBalanza={() => setShowBalanza(true)}
        onOpenSincronizador={() => setShowSincronizador(true)}
        onOpenUniversalUpload={() => setShowUniversalUpload(true)}
        onAutoHeal={handleAutoHeal}
        isHealing={isHealing}
        globalOrders={globalOrders}
        purchases={purchases}
        expenses={expenses}
        config={config}
        shareRentabilidad={shareRentabilidad}
        printRentabilidad={printRentabilidad}
      />

      {/* 2. Hero Suite de 4 Pilares Financieros */}
      <ModernKpiGrid
        k={k}
        role={role}
        saldoCaja={saldoCaja}
        monthFilter={monthFilter}
        nav={nav}
        contrarecibosVencidosCount={contrarecibosVencidosCount}
        config={config}
      />

      {/* 3. Selector de Espacio de Trabajo (Pestañas Modulares) */}
      <DashboardViewModeTabs
        viewMode={viewMode}
        setViewMode={setViewMode}
        seguimientoOrdersCount={seguimientoOrders.length}
        providerName={settings?.providerName || 'Andrés'}
      />

      {/* 4. Contenido Modular del Espacio de Trabajo Seleccionado */}
      <ErrorBoundary>
        {(viewMode === 'executive' || viewMode === 'all') && (
          <DashboardExecutiveView
            seguimientoOrders={seguimientoOrders}
            config={config as any}
            saldoCaja={saldoCaja}
            expenses={expenses}
            nav={nav}
            selectedPipelineStage={selectedPipelineStage}
            onSelectPipelineStage={setSelectedPipelineStage}
            onOpenQuickInvoice={(orderId) => {
              if (orderId) setSelectedInvoiceOrderId(orderId);
              setShowQuickInvoice(true);
            }}
            onOpenQuickCollection={() => setShowQuickCollection(true)}
            onOpenQuickDelivery={(orderId) => {
              if (orderId) setSelectedDeliveryOrderId(orderId);
              setShowQuickDelivery(true);
            }}
            onOpenUniversalUpload={() => setShowUniversalUpload(true)}
          />
        )}

        {viewMode === 'orders' && (
          <DashboardOrdersView
            seguimientoOrders={seguimientoOrders}
            selectedPipelineStage={selectedPipelineStage}
            onSelectPipelineStage={setSelectedPipelineStage}
            nav={nav}
            onOpenQuickInvoice={() => setShowQuickInvoice(true)}
            onOpenQuickCollection={() => setShowQuickCollection(true)}
          />
        )}

        {(viewMode === 'collection' || viewMode === 'all') && (
          <DashboardCollectionView
            seguimientoOrders={seguimientoOrders}
            activeOrders={activeOrders}
            purchases={purchases}
            config={config as any}
            nav={nav}
            k={k}
            handleRecibir={handleRecibir}
            recibiendoId={recibiendoId}
            onOpenQuickCollection={() => setShowQuickCollection(true)}
            onOpenQuickInvoice={() => setShowQuickInvoice(true)}
            viewModeAll={viewMode === 'all'}
          />
        )}

        {(viewMode === 'production' || viewMode === 'all') && (
          <DashboardProductionView
            activeOrders={activeOrders}
            providerName={settings?.providerName || 'Andrés'}
            viewModeAll={viewMode === 'all'}
          />
        )}

        {viewMode === 'pnl' && (
          <DashboardPnlView
            seguimientoOrders={seguimientoOrders}
            config={config as any}
            saldoCaja={saldoCaja}
          />
        )}
      </ErrorBoundary>

      {/* 5. Pie de Monitoreo, Estado del Sistema y Respaldos */}
      <DashboardSystemStatusFooter
        role={role}
        liveLogs={liveLogs}
        onOpenLiveLogs={() => setShowLiveLogsModal(true)}
        onOpenChangelog={() => setShowChangelogModal(true)}
        health={health}
        backupBusy={backupBusy}
        recalcBusy={recalcBusy}
        onCreateBackup={() => void handleCreateBackup()}
        onOpenBackupsModal={() => void handleOpenBackupsModal()}
        onRecalc={() => void recalcStats()}
      />

      {/* 6. Modales y Drawers Centralizados */}
      <DashboardModalsHost
        showContrarecibosDrawer={showContrarecibosDrawer}
        setShowContrarecibosDrawer={setShowContrarecibosDrawer}
        showSeguimientoDrawer={showSeguimientoDrawer}
        setShowSeguimientoDrawer={setShowSeguimientoDrawer}
        showQuickInvoice={showQuickInvoice}
        setShowQuickInvoice={setShowQuickInvoice}
        selectedInvoiceOrderId={selectedInvoiceOrderId}
        setSelectedInvoiceOrderId={setSelectedInvoiceOrderId}
        showQuickDelivery={showQuickDelivery}
        setShowQuickDelivery={setShowQuickDelivery}
        selectedDeliveryOrderId={selectedDeliveryOrderId}
        showQuickCollection={showQuickCollection}
        setShowQuickCollection={setShowQuickCollection}
        showQuickPay={showQuickPay}
        setShowQuickPay={setShowQuickPay}
        showCorteMensual={showCorteMensual}
        setShowCorteMensual={setShowCorteMensual}
        showCorteSemanal={showCorteSemanal}
        setShowCorteSemanal={setShowCorteSemanal}
        showBalanza={showBalanza}
        setShowBalanza={setShowBalanza}
        showBackupsModal={showBackupsModal}
        setShowBackupsModal={setShowBackupsModal}
        showChangelogModal={showChangelogModal}
        setShowChangelogModal={setShowChangelogModal}
        showLiveLogsModal={showLiveLogsModal}
        setShowLiveLogsModal={setShowLiveLogsModal}
        showMagicPaste={showMagicPaste}
        setShowMagicPaste={setShowMagicPaste}
        showSincronizador={showSincronizador}
        setShowSincronizador={setShowSincronizador}
        showUniversalUpload={showUniversalUpload}
        setShowUniversalUpload={setShowUniversalUpload}
        seguimientoOrders={seguimientoOrders}
        activeOrders={activeOrders}
        globalOrders={globalOrders}
        expenses={expenses}
        purchases={purchases}
        config={config as any}
        settings={settings}
        saldoCaja={saldoCaja}
        cloudBackups={cloudBackups}
        backupBusy={backupBusy}
        handleCreateBackup={handleCreateBackup}
        handleRestoreBackup={handleRestoreBackup as any}
        liveLogs={liveLogs}
        nav={nav}
      />

      {/* 7. Dock Rápido en Móviles */}
      <MobileQuickDock
        onNewOrder={() => nav('/ordenes?nueva=1')}
        onQuickDelivery={() => {
          setSelectedDeliveryOrderId(null);
          setShowQuickDelivery(true);
        }}
        onQuickInvoice={() => {
          setSelectedInvoiceOrderId(null);
          setShowQuickInvoice(true);
        }}
        onQuickCollection={() => setShowQuickCollection(true)}
        onQuickPay={() => setShowQuickPay(true)}
        onFastEntry={() => nav('/recepcion')}
        onMagicPaste={() => setShowMagicPaste(true)}
        onOpenCalculator={() => {
          const btn = document.querySelector('.floating-calc-trigger') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        pendingDeliveriesCount={(seguimientoOrders || []).filter(o => {
          if (!o || o.isClosedShort) return false;
          const s = getOrderSummary(o);
          return s.kilosDelivered < (Number(o.totalKilograms) || 0) - 0.01;
        }).length}
        pendingInvoicesCount={pendingInvoicesCount}
        pendingCollectionsCount={pendingCollectionsCount}
      />

      {/* 8. Panel de Edición Rápida Flotante (Admin) */}
      {role === 'admin' && (
        <>
          <AdminFloatingButton onClick={() => setShowQuickEdit(true)} />
          <AdminQuickEditPanel
            open={showQuickEdit}
            onClose={() => setShowQuickEdit(false)}
            config={config as any}
            saldoAndres={k.deudaAndres ?? 0}
            totalPagadoAndres={k.totalPagadoAndres ?? 0}
            totalPurchasesCost={k.totalPurchasesCost ?? 0}
          />
        </>
      )}
    </div>
  );
}
