import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import Decimal from 'decimal.js-light';
import { doc, getDoc, collection, query, orderBy, limit, getDocs, onSnapshot, updateDoc, addDoc, Timestamp, serverTimestamp, type QuerySnapshot, type QueryDocumentSnapshot } from 'firebase/firestore';
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
import { QuickPayModal } from '../components/FastFlows/QuickPayModal';
import { QuickCollectionModal } from '../components/FastFlows/QuickCollectionModal';
import { CashflowProjection } from '../components/Dashboard/CashflowProjection';
import { SmartAlerts } from '../components/Dashboard/SmartAlerts';
import { FacturasSinCRPanel } from '../components/Dashboard/FacturasSinCRPanel';
import { SemaforoDelDia } from '../components/Dashboard/SemaforoDelDia';
import { SociosProfitCard } from '../components/Dashboard/SociosProfitCard';
import { WeeklyCollectionSummary } from '../components/Dashboard/WeeklyCollectionSummary';
import { MoneyFlowPipeline } from '../components/Dashboard/MoneyFlowPipeline';
import { KilosSpeedometer } from '../components/Dashboard/KilosSpeedometer';
import { ContrarecibosTimeline } from '../components/Dashboard/ContrarecibosTimeline';
import { FloatingKiloCalculator } from '../components/FloatingKiloCalculator';
import { MagicPasteModal } from '../components/MagicPasteModal';

const CloudBackupsModal = lazy(() => import('../components/Dashboard/CloudBackupsModal').then(m => ({ default: m.CloudBackupsModal })));
const LiveLogsModal = lazy(() => import('../components/Dashboard/LiveLogsModal').then(m => ({ default: m.LiveLogsModal })));
const ChangelogModalComponent = lazy(() => import('../components/Dashboard/ChangelogFeed').then(m => ({ default: m.ChangelogModal })));
const CorteMensualModal = lazy(() => import('../components/Dashboard/CorteMensualModal').then(m => ({ default: m.CorteMensualModal })));




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
  const [showMagicPaste, setShowMagicPaste] = useState(false);

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
    // Filter global orders exactly as the original query did, PLUS by department
    const activeOrders = useMemo(() => {
      return globalOrders.filter((o: PurchaseOrder) => {
        const passDept = deptFilter === 'ALL' || o.department === deptFilter;
        const passStatus = o.invoiceStatuses?.some((s: string) => ['pending', 'overdue', 'manual_review', 'paid'].includes(s));
        return passDept && passStatus;
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
      return globalOrders.filter((o: PurchaseOrder) => deptFilter === 'ALL' || o.department === deptFilter);
    }, [globalOrders, deptFilter]);

  const k = useDashboardStats(statsDoc, activeOrders, monthFilter, config as any, purchases, expenses);

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

  return (
    <div className="dashboard-container" style={{ maxWidth: 1600, margin: '0 auto' }}>
      {/* ─── ENCABEZADO EJECUTIVO & HERRAMIENTAS GLOBALES ─────────────────── */}
      <div className="page-head" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>Dashboard Maestro</h1>
              <span className="live-status-pill" style={{ fontSize: 11, padding: '3px 8px' }}>
                <span className="live-pulse-dot" style={{ width: 6, height: 6 }} /> En Vivo
              </span>
            </div>
            <p style={{ margin: '4px 0 0', color: 'var(--ink-soft)', fontSize: 14 }}>
              Control Integral de Ventas, Flujo de Efectivo, Cobranza y Maquila Providencia.
            </p>
          </div>

          {/* Botones de Exportación e Impresión */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              style={{
                background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                border: 'none',
                color: '#fff',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.25)',
              }}
              onClick={() => nav('/ordenes?nueva=1')}
            >
              ➕ Nuevo Expediente
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600 }}
              onClick={async () => {
                toast('Generando sábana con los datos actuales...', 'info');
                try {
                  await exportToExcel();
                  toast('Sábana descargada', 'ok');
                } catch (e) {
                  toast(`Error al exportar: ${(e as Error).message}`, 'bad');
                }
              }}
            >
              📊 Sábana Excel
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600 }}
              onClick={() => nav('/audit')}
            >
              ⚖️ Auditoría
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600 }}
              onClick={shareRentabilidad}
            >
              📤 Compartir PDF
            </button>
            <button
              className="btn"
              style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', color: 'var(--ink)', fontWeight: 600 }}
              onClick={printRentabilidad}
            >
              🖨️ Imprimir
            </button>
          </div>
        </div>

        {/* Barra de Filtros: Departamentos & Mes P&L */}
        <div
          style={{
            marginTop: 18,
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

      {/* ─── 1. HERO SUITE DE KPIS EJECUTIVOS (EN PRIMER PLANO) ──────────── */}
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

      {/* ─── 2. SEMÁFORO OPERATIVO DEL DÍA (FLUJO DE TRABAJO REAL) ───────── */}
      <SemaforoDelDia
        orders={activeOrders}
        purchases={purchases}
        config={config}
        nav={nav}
        onOpenQuickInvoice={() => setShowQuickInvoice(true)}
        onOpenQuickCollection={() => setShowQuickCollection(true)}
      />

      {/* ─── 2.5 PIPELINE VISUAL DEL FLUJO DEL DINERO ─────────────────────── */}
      <MoneyFlowPipeline
        orders={activeOrders}
        purchases={purchases}
        expenses={expenses}
        config={config}
        nav={nav}
      />

      {/* ─── 3. BARRA DE ACCIONES RÁPIDAS Y CONTROL OPERATIVO ───────────── */}
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

      {/* ─── 4. ALERTAS PROACTIVAS, REPARTO DE SOCIOS Y CASHFLOW PREDICTIVO ─ */}
      {role === 'admin' && (
        <div style={{ marginBottom: 24 }}>
          <WeeklyCollectionSummary orders={activeOrders} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 14 }}>
            <KilosSpeedometer orders={activeOrders} />
          </div>
          <ContrarecibosTimeline orders={activeOrders} nav={nav} />
          <SociosProfitCard
            orders={activeOrders}
            expenses={expenses}
            costPricePerKg={config.costPricePerKg || 42}
            salePricePerKg={config.salePricePerKg || 43}
            onOpenRetiro={() => nav('/caja-chica')}
          />
          <SmartAlerts orders={activeOrders} />
          <CashflowProjection orders={activeOrders} />
        </div>
      )}

      {/* ─── 5. PANELES OPERATIVOS PRINCIPALES ─────────────────────────────── */}
      {/* Panel: Por Recibir del Contador (Efectivo pendiente de entrar a Caja) */}
      {k.porRecibir.length > 0 &&
        (() => {
          const totalBruto = k.porRecibir.reduce((acc: number, r: any) => acc + r.invoiceTotal, 0);
          const totalComision = k.porRecibir.reduce((acc: number, r: any) => acc + r.commission, 0);
          return (
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.15) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 16,
                padding: 22,
                marginBottom: 24,
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

              {/* Desglose en 3 Pasos */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  flexWrap: 'wrap',
                  background: 'var(--paper-raised)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  marginBottom: 16,
                  border: '1px solid var(--line-soft)',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Cobrado por el Cliente
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)' }}>{money(totalBruto)}</div>
                </div>
                <div style={{ fontSize: 20, color: 'var(--ink-soft)' }}>−</div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Comisión Contador (8%)
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#f87171' }}>{money(totalComision)}</div>
                </div>
                <div style={{ fontSize: 20, color: 'var(--ink-soft)' }}>=</div>
                <div style={{ marginLeft: 'auto' }}>
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 700, textTransform: 'uppercase' }}>
                    Neto a Entrar a Caja Chica
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--ok)' }}>{money(k.totalPorRecibir)}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>Factura</th>
                    <th style={{ padding: '8px', textAlign: 'left', color: 'var(--ink-soft)', fontWeight: 600 }}>Contrarecibo</th>
                    <th style={{ padding: '8px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Importe Factura</th>
                    <th style={{ padding: '8px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Comisión</th>
                    <th style={{ padding: '8px', textAlign: 'right', color: 'var(--ink-soft)', fontWeight: 600 }}>Neto a Recibir</th>
                    <th style={{ padding: '8px', textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {k.porRecibir.map((r: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                      <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 700 }}>#{r.folio}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--ink-soft)', fontFamily: 'monospace' }}>{r.cr}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>{money(r.invoiceTotal)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--bad)' }}>-{money(r.commission)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--ok)', fontWeight: 800 }}>{money(r.net)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                        <button
                          className="btn"
                          style={{
                            background: 'var(--ok-bg)',
                            color: 'var(--ok)',
                            border: '1px solid var(--ok)',
                            padding: '5px 12px',
                            fontSize: 12,
                            fontWeight: 700,
                          }}
                          onClick={() => handleRecibir(r)}
                        >
                          💵 Recibir → CAJA
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

      {/* Facturas sin Contrarecibo */}
      <FacturasSinCRPanel orders={activeOrders} />

      {/* Bandeja de Entregas del Maquilador (Andrés) */}
      <BandejaMaquilaWidget />

      {/* ─── 6. MONITOREO DE SISTEMA & ESTADO EN VIVO (FOOTER SUITE) ────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 24, marginBottom: 32 }}>
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
          <ContrarecibosTable orders={activeOrders} />
        </Drawer>
      )}

      {showSeguimientoDrawer && (
        <Drawer title="Seguimiento de Pedidos" onClose={() => setShowSeguimientoDrawer(false)} width={1000}>
          <SeguimientoPedidosTable orders={seguimientoOrders} />
        </Drawer>
      )}

      {showQuickInvoice && (
        <QuickInvoiceModal orders={activeOrders} onClose={() => setShowQuickInvoice(false)} />
      )}

      {showQuickCollection && (
        <QuickCollectionModal orders={activeOrders} onClose={() => setShowQuickCollection(false)} />
      )}

      {showQuickPay && (
        <QuickPayModal orders={activeOrders} onClose={() => setShowQuickPay(false)} />
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
      </Suspense>

      {/* Calculadora Flotante de Kilos */}
      <FloatingKiloCalculator />
    </div>
  );
}
