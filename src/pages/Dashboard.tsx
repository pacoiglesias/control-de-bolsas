import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import Decimal from 'decimal.js-light';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, onSnapshot, updateDoc, addDoc, Timestamp, serverTimestamp, type QuerySnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
import { db, PATHS, functions } from '../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { money, shareHtmlAsPdf, monthLabel, fmtDate, getPrintHeaderHtml } from '../lib/format';
import { exportToExcel } from '../lib/export';
import { usePurchases } from '../hooks/usePurchases';
import { useOrdersContext } from '../context/OrdersContext';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useToast } from '../context/ToastContext';
import { Skeleton, Drawer } from '../components/ui';
import { confirmDialog } from '../lib/confirmDialog';
import { createCloudBackup, listCloudBackups, restoreCloudBackup, downloadBackupJsonFile, type CloudSnapshotMeta } from '../lib/cloudBackup';
import type { PurchaseOrder } from '../lib/types';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { ModernKpiGrid } from '../components/Dashboard/ModernKpiGrid';
import { QuickActionsBar } from '../components/Dashboard/QuickActionsBar';
import { ContrarecibosTable } from '../components/Dashboard/ContrarecibosTable';
import { SeguimientoPedidosTable } from '../components/Dashboard/SeguimientoPedidosTable';
import { BandejaMaquilaWidget } from '../components/Dashboard/BandejaMaquilaWidget';
import { useDashboardStats } from '../hooks/useDashboardStats';
import { SYSTEM_CHANGELOG } from '../lib/systemChangelog';
import { QuickInvoiceModal } from '../components/FastFlows/QuickInvoiceModal';
import { PagarAndresModal } from '../components/Compras/PagarAndresModal';
import { QuickCollectionModal } from '../components/FastFlows/QuickCollectionModal';
import { CashflowProjection } from '../components/Dashboard/CashflowProjection';
import { SmartAlerts } from '../components/Dashboard/SmartAlerts';
import { FacturasSinCRPanel } from '../components/Dashboard/FacturasSinCRPanel';
import { SemaforoDelDia } from '../components/Dashboard/SemaforoDelDia';
import { ExecutiveFinancialCard } from '../components/Dashboard/ExecutiveFinancialCard';
import { WeeklyCollectionSummary } from '../components/Dashboard/WeeklyCollectionSummary';
import { MoneyFlowPipeline, type PipelineStageKey } from '../components/Dashboard/MoneyFlowPipeline';
import { KilosSpeedometer } from '../components/Dashboard/KilosSpeedometer';
import { ContrarecibosTimeline } from '../components/Dashboard/ContrarecibosTimeline';
import { FloatingKiloCalculator } from '../components/FloatingKiloCalculator';
import { MagicPasteModal } from '../components/MagicPasteModal';
import { MobileQuickDock } from '../components/Dashboard/MobileQuickDock';
import { ProactiveBriefingCard } from '../components/Dashboard/ProactiveBriefingCard';
import { getOrderSummary, filterOrderByDepartment } from '../lib/finance';

import { SincronizadorOficialModal } from '../components/Cobranza/SincronizadorOficialModal';

const CloudBackupsModal = lazy(() => import('../components/Dashboard/CloudBackupsModal').then(m => ({ default: m.CloudBackupsModal })));
const LiveLogsModal = lazy(() => import('../components/Dashboard/LiveLogsModal').then(m => ({ default: m.LiveLogsModal })));
const ChangelogModalComponent = lazy(() => import('../components/Dashboard/ChangelogFeed').then(m => ({ default: m.ChangelogModal })));
const CorteMensualModal = lazy(() => import('../components/Dashboard/CorteMensualModal').then(m => ({ default: m.CorteMensualModal })));
const CorteSemanalModal = lazy(() => import('../components/Dashboard/CorteSemanalModal').then(m => ({ default: m.CorteSemanalModal })));
const BalanzaComprobacionModal = lazy(() => import('../components/Dashboard/BalanzaComprobacionModal').then(m => ({ default: m.BalanzaComprobacionModal })));




export interface LiveLogEntry {
  id: string;
  user: string;
  action: string;
  details?: Record<string, unknown>;
  timestamp: Date | null;
}

// SYSTEM_CHANGELOG extracted to ChangelogFeed.tsx


export default function Dashboard() {
  const { purchases } = usePurchases();
  const { expenses, loading: loadingExp } = useExpenses();
  const { settings } = useSystemSettings();
  const { orders: globalOrders, loading: loadingGlobalOrders } = useOrdersContext();
  const { role, user } = useAuth();
  const { config } = useConfig();
  const nav = useNavigate();
  const toast = useToast();
  const [health, setHealth] = useState<{ snapshotDate: Date | null; recentLogs: number; dbStatus: string }>({ snapshotDate: null, recentLogs: 0, dbStatus: '...' });
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [showLiveLogsModal, setShowLiveLogsModal] = useState(false);
  const [liveLogs, setLiveLogs] = useState<LiveLogEntry[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudSnapshotMeta[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const [monthFilter, setMonthFilter] = useState<string>('ALL');
  const [showContrarecibosDrawer, setShowContrarecibosDrawer] = useState(false);
  const [showSeguimientoDrawer, setShowSeguimientoDrawer] = useState(false);
  const [showQuickInvoice, setShowQuickInvoice] = useState(false);
  const [showQuickCollection, setShowQuickCollection] = useState(false);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [showCorteMensual, setShowCorteMensual] = useState(false);
  const [showCorteSemanal, setShowCorteSemanal] = useState(false);
  const [showBalanza, setShowBalanza] = useState(false);
  const [showMagicPaste, setShowMagicPaste] = useState(false);
  const [showSincronizador, setShowSincronizador] = useState(false);
  const [selectedPipelineStage, setSelectedPipelineStage] = useState<PipelineStageKey | null>(null);
  const [viewMode, setViewMode] = useState<'executive' | 'collection' | 'production' | 'all'>('executive');
  const [showReportsMenu, setShowReportsMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Cerrar menús al hacer clic fuera o presionar Escape
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

  // Atajos de Teclado Globales (N = Nueva OC, F = Facturar, C = Cobrar, P = Pegar WhatsApp, R = Recalcular)
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
        setShowQuickInvoice(true);
      } else if (k === 'c') {
        e.preventDefault();
        setShowQuickCollection(true);
      } else if (k === 'p') {
        e.preventDefault();
        setShowMagicPaste(true);
      } else if (k === 'r') {
        e.preventDefault();
        void recalcStats();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nav]);

  async function recalcStats() {
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
  }

  const [statsDoc, loadingStats, statsError] = useDocumentData(doc(db, 'stats', deptFilter === 'ALL' ? 'dashboard' : `dashboard_${deptFilter}`));
  
  const loading = loadingStats || loadingGlobalOrders || loadingExp;
  const error = statsError?.message;

  useEffect(() => {
    if (role !== 'admin') return;
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(25));
    const unsub = onSnapshot(q, (snap: QuerySnapshot) => {
      const list: LiveLogEntry[] = [];
      snap.forEach((d: QueryDocumentSnapshot) => {
        const data = d.data();
        list.push({
          id: d.id,
          user: data.user || 'Sistema',
          action: data.action || 'Movimiento sin título',
          details: data.details,
          timestamp: data.timestamp?.toDate?.() ?? null,
        });
      });
      setLiveLogs(list);
    });
  
return () => unsub();
    // `role` DEBE estar en las dependencias: llega asincrono desde
    // AuthContext, asi que en el primer render vale undefined, el efecto sale
    // por el early return y con el arreglo vacio nunca volvia a ejecutarse.
    // Resultado: al administrador no le cargaban nunca los logs en vivo.
  }, [role]);

  useEffect(() => {
    if (role !== 'admin') return;
    const fetchHealth = async () => {
      try {
        const snap = await getDoc(doc(db, 'snapshots', 'latest'));
        const snapDate = snap.exists() ? snap.data().createdAt?.toDate() : null;
        
        const logsQ = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50));
        const logsSnap = await getDocs(logsQ);
        const today = new Date();
        today.setHours(0,0,0,0);
        let logsToday = 0;
        logsSnap.forEach(d => {
          if (d.data().timestamp?.toDate() >= today) logsToday++;
        });
        
        setHealth({ snapshotDate: snapDate, recentLogs: logsToday, dbStatus: 'OK' });
      } catch (e) {
        console.error('No se pudo leer el estado del sistema:', e);
        setHealth({ snapshotDate: null, recentLogs: 0, dbStatus: 'Sin conexión' });
      }
    };
    fetchHealth();
  }, [role]);

  // Auto-calibración automática del saldo histórico con Andrés al valor oficial de corte (-102,670.27)
  useEffect(() => {
    if (role === 'admin' && config && (config.historicalDebtAndres === -123175.56 || config.historicalDebtAndres === undefined || config.historicalDebtAndres === 0)) {
      setDoc(doc(db, PATHS.config, 'financials'), { historicalDebtAndres: -102670.27 }, { merge: true }).catch((err: any) => {
        console.warn('Auto-calibración config/financials:', err);
      });
    }
  }, [role, config]);

  async function handleCreateBackup() {
    setBackupBusy(true);
    try {
      const ordersSnap = await getDocs(collection(db, PATHS.orders));
      const allOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder));
      
      const res = await createCloudBackup(user?.email, allOrders, purchases, expenses, config);
      setHealth(h => ({ ...h, snapshotDate: new Date() }));
      toast(`☁ Respaldo guardado en la nube (${res.count}/5 disponibles)`, 'ok');
    } catch (e) {
      toast(`No se pudo crear el respaldo: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleOpenBackupsModal() {
    setBackupBusy(true);
    try {
      const backups = await listCloudBackups();
      setCloudBackups(backups);
      setShowBackupsModal(true);
    } catch (e) {
      toast(`Error al listar respaldos: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }

  async function handleRestoreBackup(snap: CloudSnapshotMeta) {
    if (!(await confirmDialog({ message: `⚠️ ¿Deseas restaurar el respaldo del ${snap.createdAt?.toLocaleString('es-MX')}?\n\nEsto actualizará el estado de la nube con este punto de restauración.`, danger: true }))) {
      return;
    }
    setBackupBusy(true);
    try {
      const res = await restoreCloudBackup(user?.email, snap);
      toast(`✅ ${res.message}`, 'ok');
      setShowBackupsModal(false);
      window.location.reload();
    } catch (e) {
      toast(`Error al restaurar: ${(e as Error).message}`, 'bad');
    } finally {
      setBackupBusy(false);
    }
  }
    // Filter global orders exactly as the original query did, PLUS by department and per-invoice
    const activeOrders = useMemo(() => {
      return globalOrders
        .map((o: PurchaseOrder) => filterOrderByDepartment(o, deptFilter))
        .filter((o): o is PurchaseOrder => {
          if (!o) return false;
          const passStatus = Boolean(o.invoiceStatuses?.some((s: string) => ['pending', 'overdue', 'manual_review', 'paid'].includes(s)));
          return passStatus;
        });
    }, [globalOrders, deptFilter]);

    // Seguimiento de Pedidos necesita ver el expediente DESDE que se pega la
    // OC (status 'pedido', invoiceStatuses todavia vacio porque no existe
    // ninguna factura) -- ahi es justo donde empieza a importar dar
    // seguimiento a entregas. Con `activeOrders` (que exige invoiceStatuses
    // con pending/overdue/manual_review/paid) un pedido recien creado era
    // invisible en esta tabla hasta la primera factura, contradiciendo el
    // proposito de la pantalla ("OC, Entregas, Pagos y Cobros").
    const seguimientoOrders = useMemo(() => {
      return globalOrders
        .map((o: PurchaseOrder) => filterOrderByDepartment(o, deptFilter))
        .filter((o): o is PurchaseOrder => o !== null);
    }, [globalOrders, deptFilter]);

  const k = useDashboardStats(statsDoc, activeOrders, monthFilter, config as any, purchases, expenses, seguimientoOrders, deptFilter);

  // El contador de "Vencido" del agregado del servidor cuenta EXPEDIENTES,
  // no contrarecibos — correcto casi siempre (un expediente = una factura),
  // pero incorrecto para cualquier expediente que agrupe varias facturas
  // (como el de la migracion original). La etiqueta dice "contrarecibo(s)",
  // asi que el conteo debe ser por factura, no por expediente.
  const contrarecibosVencidosCount = useMemo(() => {
    const ahora = Date.now();
    let n = 0;
    for (const o of activeOrders) {
      for (const inv of o.invoices ?? []) {
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if (!cr) continue;
        // FIX 2026-08-10 (Iteracion 97): antes esto leia dueDate?.toMillis?.(),
        // que SOLO funciona si dueDate quedo guardado como Timestamp nativo de
        // Firestore. Cualquier factura cuyo dueDate se haya guardado como
        // string/Date normal (ej. datos migrados o escritos desde un flujo
        // distinto) hacia que venc quedara `undefined`, y la condicion
        // `if (venc && venc < ahora)` la saltaba en silencio -- SIN contarla
        // como vencida aunque lo fuera. Resultado real visto en produccion:
        // la tarjeta "Urgencias (Vencido)" mostraba un monto de dinero mayor
        // a cero pero "0 facturas fuera de fecha" al mismo tiempo -- las dos
        // mitades del mismo letrero, calculadas con dos formulas distintas
        // que no estaban de acuerdo. Ahora usa el mismo parseo tolerante
        // (Timestamp, Date, o string/numero) que ya usa el servidor
        // (toDate() en functions/src/stats.ts) para esta misma comprobacion.
        const rawDue = inv.creditCycle?.dueDate as any;
        let venc: number | null = null;
        if (rawDue) {
          if (typeof rawDue.toMillis === 'function') venc = rawDue.toMillis();
          else if (typeof rawDue.toDate === 'function') venc = rawDue.toDate().getTime();
          else if (rawDue instanceof Date) venc = rawDue.getTime();
          else { const d = new Date(rawDue); if (!isNaN(d.getTime())) venc = d.getTime(); }
        }
        if (venc !== null && venc < ahora) n++;
      }
    }
    return n;
  }, [activeOrders]);

  const saldoCaja = expenses.reduce((acc, e) => new Decimal(acc).plus(e.type === 'ingreso' ? e.amount : -e.amount).toNumber(), 0);

  const pendingInvoicesCount = useMemo(() => {
    return seguimientoOrders.filter(o => {
      if (o.isClosedShort) return false;
      const s = getOrderSummary(o);
      return s.kilosDelivered > s.kilosInvoiced + 0.01;
    }).length;
  }, [seguimientoOrders]);

  const pendingCollectionsCount = useMemo(() => {
    let count = 0;
    seguimientoOrders.forEach(o => {
      (o.invoices || []).forEach(inv => {
        if (inv.creditCycle?.status === 'pending' || inv.creditCycle?.status === 'overdue' || inv.creditCycle?.status === 'paid') {
          count++;
        }
      });
    });
    return count;
  }, [seguimientoOrders]);

  if (loading || loadingExp) {
    return (
      <div style={{ padding: '0 0 40px' }}>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 280, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '60%', height: 16 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} className="skeleton-card" />)}
        </div>
        <div className="kpi-grid">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 85 }} />)}
        </div>
      </div>
    );
  }
  if (error) return <div className="alert bad">{error}</div>;

  function getRentabilidadHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Reporte de Utilidad Comercial</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .flow-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 24px; }
            .flow-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
            .flow-row:last-child { border-bottom: none; }
            .flow-label { font-weight: 600; color: #475569; }
            .flow-val { font-family: monospace; font-size: 15px; }
            .flow-total { font-weight: 800; font-size: 18px; color: #0f172a; border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 8px; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Reporte de Rentabilidad (Utilidad Comercial)")}
          
          <div style="margin-bottom: 24px; font-size: 14px; color: #475569; font-weight: 500;">
            ${k.periodText}
          </div>

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">TOTAL VENDIDO</div><div class="kpi-val">$${k.ventasTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">UTILIDAD BRUTA (MARGIN)</div><div class="kpi-val" style="color: #047857;">$${k.margenTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">GANANCIA LÍQUIDA EN CAJA</div><div class="kpi-val" style="color: #2563eb;">$${k.gananciaRealizadaTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>Cascada Financiera: Deuda Proyectada</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">1. Dinero en la calle (Por cobrar):</span><span class="flow-val">$${(k.porCobrar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">2. Mercancía entregada pendiente de facturar:</span><span class="flow-val">$${(k.montoPendienteFacturar || 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Deuda Bruta de Providencia:</span><span class="flow-val" style="color: #b91c1c;">$${k.deudaTotalProvidencia.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row"><span class="flow-label">Menos Comisión Contable Estimada:</span><span class="flow-val" style="color: #047857;">-$${k.comisionContable.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
            <div class="flow-row flow-total"><span class="flow-label">Dinero Real a Recibir (Neto):</span><span class="flow-val" style="color: #2563eb;">$${k.dineroRealARecibir.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
          </div>

          <h3>Métricas Operativas</h3>
          <div class="flow-box">
            <div class="flow-row"><span class="flow-label">Kilos Procesados:</span><span class="flow-val">${k.kilosTotal.toLocaleString('es-MX')} kg</span></div>
            <div class="flow-row"><span class="flow-label">Facturas Emitidas:</span><span class="flow-val">${k.facturasEmitidas.toLocaleString('es-MX')} facturas</span></div>
            <div class="flow-row"><span class="flow-label">Órdenes Atendidas:</span><span class="flow-val">${k.totalOrders.toLocaleString('es-MX')} OC's</span></div>
            <div class="flow-row"><span class="flow-label">Costo por Kilo Base:</span><span class="flow-val">$${(config?.costPricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
            <div class="flow-row"><span class="flow-label">Venta por Kilo Base:</span><span class="flow-val">$${(config?.salePricePerKg || 0).toLocaleString('es-MX', {minimumFractionDigits:2})} MXN/kg</span></div>
          </div>

          <div class="signatures">
            <div class="sig-box">Elaborado Por</div>
            <div class="sig-box">Aprobado / Revisado</div>
          </div>

          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printRentabilidad() {
    const html = getRentabilidadHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareRentabilidad() {
    const html = getRentabilidadHtml();
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Rentabilidad_Providencia_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  async function handleRecibir(r: { orderId: string; invoiceId: string; folio: string; cr: string; invoiceTotal: number; commission: number; net: number }) {
    if (!(await confirmDialog(`¿Mover $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} de la factura #${r.folio} a Caja Chica?`))) return;
    
    try {
      // 1. Encontrar la orden para actualizar el invoice especifico
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
      
      // 2. Ingreso a caja chica
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
    }
  }

  // Panel auxiliar: Por Recibir del Contador
  const renderPorRecibirPanel = () => {
    if (k.porRecibir.length === 0) return null;
    const totalBruto = k.porRecibir.reduce((acc: number, r: any) => acc + r.invoiceTotal, 0);
    const totalComision = k.porRecibir.reduce((acc: number, r: any) => acc + r.commission, 0);
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: 16,
          padding: 22,
          marginBottom: 20,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--ink)' }}>
            💼 Por Recibir del Contador ({k.porRecibir.length})
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 2 }}>
            Facturas cobradas por el cliente donde el contador aún tiene pendiente entregar el efectivo.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            flexWrap: 'wrap',
            background: 'var(--paper-raised)',
            borderRadius: 12,
            padding: '14px 18px',
            marginBottom: 14,
            border: '1px solid var(--line-soft)',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
              Cobrado Cliente
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{money(totalBruto)}</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--ink-soft)' }}>−</div>
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
              Comisión 8%
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{money(totalComision)}</div>
          </div>
          <div style={{ fontSize: 18, color: 'var(--ink-soft)' }}>=</div>
          <div style={{ marginLeft: 'auto' }}>
            <div style={{ fontSize: 10, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
              Neto a Caja
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ok)' }}>{money(k.totalPorRecibir)}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
              <th style={{ padding: '6px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>Factura</th>
              <th style={{ padding: '6px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>CR</th>
              <th style={{ padding: '6px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Importe</th>
              <th style={{ padding: '6px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Neto</th>
              <th style={{ padding: '6px', textAlign: 'right' }}></th>
            </tr>
          </thead>
          <tbody>
            {k.porRecibir.map((r: any, idx: number) => (
              <tr key={idx} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontWeight: 700 }}>#{r.folio}</td>
                <td style={{ padding: '8px 6px', color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{r.cr}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>{money(r.invoiceTotal)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right', color: 'var(--ok)', fontWeight: 800 }}>{money(r.net)}</td>
                <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                  <button
                    className="btn"
                    style={{
                      background: 'var(--ok-bg)',
                      color: 'var(--ok)',
                      border: '1px solid var(--ok)',
                      padding: '4px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                    onClick={() => handleRecibir(r)}
                  >
                    💵 Recibir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="dashboard-container" style={{ maxWidth: 1600, margin: '0 auto', paddingBottom: 60 }}>
      {/* ─── 0. LIVE FINANCIAL TICKER (FRANJA DE PULSO EN VIVO) ────────────── */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(30, 41, 59, 0.88) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '10px 18px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 14,
          boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25)',
          color: '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>💵</span>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Efectivo en Caja</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: saldoCaja >= 0 ? '#4ade80' : '#f87171' }}>{money(saldoCaja)}</div>
            </div>
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>🏷️</span>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Por Cobrar (Providencia)</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#38bdf8' }}>{money(k.porCobrar)}</div>
            </div>
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>⚖️</span>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Saldo con Andrés</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: k.deudaAndres >= 0 ? '#34d399' : '#fbbf24' }}>
                {money(k.deudaAndres)}
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 26, background: 'rgba(255, 255, 255, 0.12)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>📦</span>
            <div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Kilos en Proceso</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#c084fc' }}>{k.kilosTotal.toLocaleString('es-MX')} kg</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 11,
              fontWeight: 800,
              color: '#34d399',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
            En Línea
          </span>
        </div>
      </div>

      {/* ─── 1. ENCABEZADO PRINCIPAL CONSOLIDADO (LIMPIO Y ERGONÓMICO) ──────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, letterSpacing: '-0.5px' }}>Dashboard Maestro</h1>
              <span className="badge" style={{ background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px' }}>
                v{__APP_VERSION__} Enterprise
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 13 }}>
              Control Integral de Ventas, Flujo de Efectivo, Cobranza y Maquila Providencia.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {/* BOTÓN HERO: NUEVO EXPEDIENTE */}
            <button
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13.5,
                padding: '9px 18px',
                borderRadius: 12,
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
              }}
              onClick={() => nav('/ordenes?nueva=1')}
            >
              <span style={{ fontSize: 16 }}>➕</span>
              <span>Nuevo Expediente</span>
            </button>

            {/* DROPDOWN 1: REPORTES & BALANZA */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReportsMenu((prev) => !prev);
                  setShowExportMenu(false);
                }}
                style={{
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '9px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span>📑</span>
                <span>Reportes & Balanza</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{showReportsMenu ? '▲' : '▼'}</span>
              </button>

              {showReportsMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    zIndex: 100,
                    background: 'var(--paper-raised)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: 6,
                    minWidth: 240,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowReportsMenu(false); setShowCorteMensual(true); }}
                  >
                    📑 Corte Mensual Contable
                  </button>
                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowReportsMenu(false); setShowCorteSemanal(true); }}
                  >
                    📅 Corte Semanal (Histórico)
                  </button>
                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowReportsMenu(false); setShowBalanza(true); }}
                  >
                    ⚖️ Balanza de Comprobación
                  </button>
                  <div style={{ height: 1, background: 'var(--line-soft)', margin: '2px 0' }} />
                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 700, color: '#7c3aed', padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowReportsMenu(false); setShowSincronizador(true); }}
                  >
                    ⚡ Sincronizar 10 Contrarecibos
                  </button>
                </div>
              )}
            </div>

            {/* DROPDOWN 2: EXPORTAR & RESPALDO */}
            <div className="dropdown-container" style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowExportMenu((prev) => !prev);
                  setShowReportsMenu(false);
                }}
                style={{
                  background: 'var(--paper-raised)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontWeight: 700,
                  fontSize: 13,
                  padding: '9px 14px',
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <span>📥</span>
                <span>Exportar</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>{showExportMenu ? '▲' : '▼'}</span>
              </button>

              {showExportMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '110%',
                    right: 0,
                    zIndex: 100,
                    background: 'var(--paper-raised)',
                    border: '1px solid var(--line)',
                    borderRadius: 14,
                    padding: 6,
                    minWidth: 230,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={async () => {
                      setShowExportMenu(false);
                      toast('Generando sábana Excel con los datos actuales...', 'info');
                      try {
                        await exportToExcel();
                        toast('Sábana Excel descargada con éxito', 'ok');
                      } catch (e) {
                        toast(`Error al exportar: ${(e as Error).message}`, 'bad');
                      }
                    }}
                  >
                    📊 Sábana Excel en Vivo
                  </button>

                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => {
                      setShowExportMenu(false);
                      try {
                        downloadBackupJsonFile(globalOrders, purchases, expenses, config as any);
                        toast('💾 Respaldo descargado exitosamente en tu dispositivo.', 'ok');
                      } catch (e: any) {
                        toast(`Error al exportar: ${e.message}`, 'bad');
                      }
                    }}
                  >
                    💾 Respaldo Local (1 Clic)
                  </button>

                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowExportMenu(false); void shareRentabilidad(); }}
                  >
                    📄 PDF Resumen de Rentabilidad
                  </button>

                  <button
                    className="btn"
                    style={{ justifyContent: 'flex-start', border: 'none', background: 'transparent', width: '100%', fontSize: 12.5, fontWeight: 600, padding: '8px 12px', borderRadius: 8 }}
                    onClick={() => { setShowExportMenu(false); printRentabilidad(); }}
                  >
                    🖨️ Imprimir Reporte
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BARRA DE FILTRADO (DEPARTAMENTOS Y MES P&L) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            background: 'var(--paper-raised)',
            padding: '8px 14px',
            borderRadius: 14,
            border: '1px solid var(--line-soft)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div className="tabs" style={{ margin: 0, display: 'flex', gap: 6 }}>
            <button
              className={deptFilter === 'ALL' ? 'active' : ''}
              onClick={() => setDeptFilter('ALL')}
              style={{ borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
            >
              🏢 Toda la Empresa
            </button>
            {(settings?.departments || ['TH', 'GT']).map((d) => (
              <button
                key={d}
                className={deptFilter === d ? 'active' : ''}
                onClick={() => setDeptFilter(d)}
                style={{ borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}
              >
                {d}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              📅 Período P&L:
            </span>
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                border: '1px solid var(--line)',
                background: 'var(--paper)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--ink)',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="ALL">Histórico Global</option>
              {[...k.mesesKeys].reverse().map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ─── 2. SELECTOR DE VISTAS MODULARES (ERRADICAR SCROLL INFINITO) ───── */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 20,
          background: 'var(--paper-sunk)',
          padding: 6,
          borderRadius: 14,
          border: '1px solid var(--line-soft)',
          overflowX: 'auto',
        }}
      >
        <button
          type="button"
          onClick={() => setViewMode('executive')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            background: viewMode === 'executive' ? 'var(--paper-raised)' : 'transparent',
            color: viewMode === 'executive' ? 'var(--accent)' : 'var(--ink-soft)',
            boxShadow: viewMode === 'executive' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>🌟</span>
          <span>Visión Ejecutiva</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('collection')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            background: viewMode === 'collection' ? 'var(--paper-raised)' : 'transparent',
            color: viewMode === 'collection' ? '#0284c7' : 'var(--ink-soft)',
            boxShadow: viewMode === 'collection' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>📆</span>
          <span>Centro de Cobranza</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('production')}
          style={{
            flex: 1,
            minWidth: 140,
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            background: viewMode === 'production' ? 'var(--paper-raised)' : 'transparent',
            color: viewMode === 'production' ? '#7c3aed' : 'var(--ink-soft)',
            boxShadow: viewMode === 'production' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>🏭</span>
          <span>Maquila & Kilos</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('all')}
          style={{
            flex: 1,
            minWidth: 120,
            padding: '9px 14px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            cursor: 'pointer',
            background: viewMode === 'all' ? 'var(--paper-raised)' : 'transparent',
            color: viewMode === 'all' ? 'var(--ink)' : 'var(--ink-soft)',
            boxShadow: viewMode === 'all' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>👁️</span>
          <span>Ver Todo</span>
        </button>
      </div>

      {/* ─── 3. CONTENIDO MODULAR POR VISTA ───────────────────────────────── */}

      {/* VISTA 1: VISIÓN EJECUTIVA (O VISTA COMPLETA) */}
      {(viewMode === 'executive' || viewMode === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Asistente Proactivo del Día */}
          <ProactiveBriefingCard
            orders={seguimientoOrders}
            config={config as any}
            onOpenQuickInvoice={() => setShowQuickInvoice(true)}
            onOpenQuickCollection={() => setShowQuickCollection(true)}
            onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
          />

          {/* Hero Suite de KPIs */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 28 }}>
              <Skeleton style={{ height: 150, borderRadius: 20 }} />
              <Skeleton style={{ height: 150, borderRadius: 20 }} />
              <Skeleton style={{ height: 150, borderRadius: 20 }} />
              <Skeleton style={{ height: 150, borderRadius: 20 }} />
            </div>
          ) : (
            <ModernKpiGrid
              k={k}
              role={role}
              saldoCaja={saldoCaja}
              monthFilter={monthFilter}
              nav={nav}
              contrarecibosVencidosCount={contrarecibosVencidosCount}
              config={config}
            />
          )}

          {/* Panel Ejecutivo de Corte Financiero & Reparto 50/50 */}
          {role === 'admin' && (
            <ExecutiveFinancialCard
              orders={seguimientoOrders}
              config={config}
              saldoCaja={saldoCaja}
            />
          )}

          {/* Grid de 2 Columnas Inteligente en Escritorio */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 20 }}>
            {/* Columna Izquierda: Flujo y Pedidos */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 2 }}>
              <MoneyFlowPipeline
                orders={seguimientoOrders}
                expenses={expenses}
                config={config}
                nav={nav}
                selectedStage={selectedPipelineStage}
                onSelectStage={setSelectedPipelineStage}
              />

              <SeguimientoPedidosTable
                orders={seguimientoOrders}
                filterStage={selectedPipelineStage}
                onFilterStageChange={setSelectedPipelineStage}
                onOpenOrder={(order) => nav(`/ordenes?abrir=${order.id}`)}
              />
            </div>

            {/* Columna Derecha: Semáforo y Acciones Rápidas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minWidth: 320 }}>
              <SemaforoDelDia
                orders={seguimientoOrders}
                purchases={purchases}
                config={config}
                nav={nav}
                onOpenQuickInvoice={() => setShowQuickInvoice(true)}
                onOpenQuickCollection={() => setShowQuickCollection(true)}
              />

              <QuickActionsBar
                role={role}
                onNewOrder={() => nav('/ordenes?nueva=1')}
                onOpenContrarecibos={() => setShowContrarecibosDrawer(true)}
                onOpenSeguimiento={() => setShowSeguimientoDrawer(true)}
                onQuickInvoice={() => setShowQuickInvoice(true)}
                onQuickCollection={() => setShowQuickCollection(true)}
                onQuickPay={() => setShowQuickPay(true)}
                onOpenMagicPaste={() => setShowMagicPaste(true)}
                onOpenCorteMensual={() => setShowCorteMensual(true)}
                onRecalc={() => void recalcStats()}
                recalcBusy={recalcBusy}
              />
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: CENTRO DE COBRANZA (O VISTA COMPLETA) */}
      {(viewMode === 'collection' || viewMode === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: viewMode === 'all' ? 24 : 0 }}>
          {viewMode !== 'all' && (
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📆</span>
              <span>Centro de Cobranza & Contrarecibos</span>
            </div>
          )}

          <WeeklyCollectionSummary orders={seguimientoOrders} />

          <ContrarecibosTimeline orders={seguimientoOrders} nav={nav} />

          {renderPorRecibirPanel()}

          <FacturasSinCRPanel orders={seguimientoOrders} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <SmartAlerts orders={activeOrders} />
            <CashflowProjection orders={activeOrders} />
          </div>
        </div>
      )}

      {/* VISTA 3: MAQUILA & KILOS (O VISTA COMPLETA) */}
      {(viewMode === 'production' || viewMode === 'all') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: viewMode === 'all' ? 24 : 0 }}>
          {viewMode !== 'all' && (
            <div style={{ fontSize: 16, fontWeight: 900, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>🏭</span>
              <span>Maquila, Producción y Kilos de Andrés</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            <KilosSpeedometer orders={activeOrders} />
            <BandejaMaquilaWidget />
          </div>
        </div>
      )}

      {/* ─── 4. MONITOREO DE SISTEMA & ESTADO EN VIVO (FOOTER SUITE) ──────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 32, marginBottom: 32 }}>
        {role === 'admin' && (
          <div
            style={{
              padding: 16,
              background: 'var(--paper-raised)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: 'var(--ok-bg)',
                color: 'var(--ok)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Último Movimiento</span>
                <span className="live-status-pill" style={{ fontSize: 10, padding: '2px 6px' }}>● En vivo</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700, marginTop: 2 }}>
                🕒 {liveLogs[0]?.timestamp ? liveLogs[0].timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Esperando movimiento…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {liveLogs[0]?.action || 'Sistema iniciado'}
              </div>
              <button className="btn btn-primary" onClick={() => setShowLiveLogsModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
                ⚡ Ver Monitor de Eventos
              </button>
            </div>
          </div>
        )}

        <div
          style={{
            padding: 16,
            background: 'var(--paper-raised)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--line-soft)',
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              background: 'var(--accent-sunk)',
              color: 'var(--accent-deep)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
            }}
          >
            🚀
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Versión del ERP</span>
              <span className="badge" style={{ background: 'var(--ok)', fontSize: 10 }}>v{__APP_VERSION__}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent-deep)', fontWeight: 600, marginTop: 2 }}>
              📅 {SYSTEM_CHANGELOG[0]?.date ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {SYSTEM_CHANGELOG[0]?.summary ?? ''}
            </div>
            <button className="btn" onClick={() => setShowChangelogModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
              📜 Bitácora de Versiones
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div
            style={{
              padding: 16,
              background: 'var(--paper-raised)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--line-soft)',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background: 'var(--info-bg)',
                color: 'var(--info)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
              }}
            >
              🛡️
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13 }}>Salud & Respaldos</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, marginBottom: 4 }}>
                BD: <strong>{health.dbStatus}</strong> · Respaldo: {health.snapshotDate ? fmtDate(health.snapshotDate) : 'No detectado'}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 10, padding: '3px 7px' }}>
                  {backupBusy ? 'Guardando…' : '☁ Respaldar'}
                </button>
                <button className="btn" onClick={() => void handleOpenBackupsModal()} disabled={backupBusy} style={{ fontSize: 10, padding: '3px 7px' }}>
                  📋 5 Máx
                </button>
                <button className="btn" onClick={() => void recalcStats()} disabled={recalcBusy} style={{ fontSize: 10, padding: '3px 7px' }}>
                  {recalcBusy ? '⏳ Recalculando…' : '🔄 Recalcular'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── MODALES Y DRAWERS DE CONTROL ─────────────────────────────────── */}
      {showContrarecibosDrawer && (
        <Drawer title="Vencimientos (Contrarecibos)" onClose={() => setShowContrarecibosDrawer(false)} width={900}>
          <ContrarecibosTable orders={seguimientoOrders} />
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
        <QuickInvoiceModal orders={seguimientoOrders} onClose={() => setShowQuickInvoice(false)} />
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
            cloudBackups={cloudBackups as any}
            backupBusy={backupBusy}
            handleCreateBackup={handleCreateBackup}
            handleRestoreBackup={handleRestoreBackup as any}
            onDownloadJson={() => downloadBackupJsonFile(activeOrders, purchases, expenses, config)}
          />
        )}

        {showChangelogModal && (
          <ChangelogModalComponent onClose={() => setShowChangelogModal(false)} />
        )}

        {showLiveLogsModal && (
          <LiveLogsModal onClose={() => setShowLiveLogsModal(false)} liveLogs={liveLogs as any} />
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

      {/* Calculadora Flotante de Kilos */}
      <FloatingKiloCalculator />

      {/* Dock Rápido de Acciones Locales en Móvil (1 Toque) */}
      <MobileQuickDock
        onNewOrder={() => nav('/ordenes?nueva=1')}
        onQuickInvoice={() => setShowQuickInvoice(true)}
        onQuickCollection={() => setShowQuickCollection(true)}
        onQuickPay={() => setShowQuickPay(true)}
        onMagicPaste={() => setShowMagicPaste(true)}
        onOpenCalculator={() => {
          const btn = document.querySelector('.floating-calc-trigger') as HTMLButtonElement | null;
          if (btn) btn.click();
        }}
        pendingInvoicesCount={pendingInvoicesCount}
        pendingCollectionsCount={pendingCollectionsCount}
      />
    </div>
  );
}
