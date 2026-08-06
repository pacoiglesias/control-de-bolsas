import { useMemo, useState, useEffect, lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
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
import { createCloudBackup, listCloudBackups, restoreCloudBackup, type CloudSnapshotMeta } from '../lib/cloudBackup';
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

const CloudBackupsModal = lazy(() => import('../components/Dashboard/CloudBackupsModal').then(m => ({ default: m.CloudBackupsModal })));
const LiveLogsModal = lazy(() => import('../components/Dashboard/LiveLogsModal').then(m => ({ default: m.LiveLogsModal })));
const ChangelogModalComponent = lazy(() => import('../components/Dashboard/ChangelogFeed').then(m => ({ default: m.ChangelogModal })));




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
    if (!window.confirm(`⚠️ ¿Deseas restaurar el respaldo del ${snap.createdAt?.toLocaleString('es-MX')}?\n\nEsto actualizará el estado de la nube con este punto de restauración.`)) {
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
        const venc = inv.creditCycle?.dueDate?.toMillis?.();
        if (venc && venc < ahora) n++;
      }
    }
    return n;
  }, [activeOrders]);

  const saldoCaja = expenses.reduce((acc, e) => acc + (e.type === 'ingreso' ? e.amount : -e.amount), 0);

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
    if (!window.confirm(`¿Mover $${r.net.toLocaleString('es-MX', {minimumFractionDigits:2})} de la factura #${r.folio} a Caja Chica?`)) return;
    
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
    <>
      <div className="page-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Dashboard Maestro</h1>
            <p>Visión integral: Ventas, Cobranza (Flujo) y Operación con Providencia.</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              className="btn"
              style={{ background: '#3b82f6', color: '#fff', borderColor: '#3b82f6', fontWeight: 600 }}
              onClick={async () => {
                // Antes este boton descargaba un archivo estatico
                // (/plantilla_llena.xlsx) guardado una sola vez en el
                // servidor: una foto congelada que nunca se actualizaba con
                // los datos reales. Si alguien la editaba pensando que eran
                // los datos de hoy y la volvia a subir, pisaba cambios
                // reales con informacion vieja. Ahora usa la MISMA
                // exportacion en vivo que el resto del sistema.
                toast('Generando sábana con los datos actuales...', 'info');
                try {
                  await exportToExcel();
                  toast('Sábana descargada', 'ok');
                } catch (e) {
                  toast(`Error al exportar: ${(e as Error).message}`, 'bad');
                }
              }}
            >
              ⬇️ Descargar Sábana (datos actuales)
            </button>
            <button className="btn" style={{ background: '#7e22ce', color: '#fff', borderColor: '#7e22ce', fontWeight: 600 }} onClick={() => window.location.href = '/audit'}>
              ⚖️ Auditoría Maestra
            </button>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareRentabilidad}>
              <span className="icon">📤</span> Compartir PDF
            </button>
            <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printRentabilidad}>
              📈 Imprimir Reporte
            </button>
          </div>
        </div>
        <div className="tabs" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={deptFilter === 'ALL' ? 'active' : ''} onClick={() => setDeptFilter('ALL')}>🏢 Toda la Empresa</button>
          {(settings?.departments || ['TH', 'GT']).map(d => (
            <button key={d} className={deptFilter === d ? 'active' : ''} onClick={() => setDeptFilter(d)}>{d}</button>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)' }}>Mes P&L:</span>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--paper)', fontSize: 13, fontWeight: 600, color: 'var(--ink)', outline: 'none' }}>
              <option value="ALL">Histórico Global</option>
              {[...k.mesesKeys].reverse().map(m => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {role !== 'viewer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24, marginTop: 16 }}>
          <button className="btn" onClick={() => nav('/ordenes?nueva=1&tab=productos')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px', background: 'var(--paper-sunk)', border: '2px dashed var(--accent)', color: 'var(--ink)' }}>
            <span style={{ fontSize: 28 }}>📥</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Subir OC (PDF)</span>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Órdenes de Compra</span>
          </button>
          <button className="btn" onClick={() => nav('/captura-rapida')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px', background: 'var(--paper-sunk)', border: '2px dashed var(--ok)', color: 'var(--ink)' }}>
            <span style={{ fontSize: 28 }}>⚡</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Pegar Facturas / Pagos</span>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Extraer texto de PDFs</span>
          </button>
          <button className="btn" onClick={() => nav('/ordenes?nueva=1')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}>
            <span style={{ fontSize: 28 }}>🛒</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Venta Manual</span>
            <span style={{ fontSize: 11, color: 'var(--ink-soft)' }}>Crear sin PDF</span>
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
        
        {role === 'admin' && (
          <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--ok-bg)', color: 'var(--ok)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              ⚡
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Último Movimiento (Live)</span>
                <span className="badge" style={{ background: 'var(--ok)', fontSize: 10 }}>● En vivo</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 700, marginTop: 2 }}>
                🕒 {liveLogs[0]?.timestamp ? liveLogs[0].timestamp.toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'medium' }) : 'Esperando movimiento…'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600, marginTop: 2, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {liveLogs[0]?.action || 'Sistema iniciado'}
              </div>
              <div style={{ fontSize: 10, color: 'var(--ink-soft)' }}>
                Por: {liveLogs[0]?.user || '—'}
              </div>
              <button className="btn btn-primary" onClick={() => setShowLiveLogsModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
                ⚡ Monitor Live de Movimientos
              </button>
            </div>
          </div>
        )}

        <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--accent-sunk)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🚀
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Versión del Sistema</span>
              <span className="badge" style={{ background: 'var(--ok)', fontSize: 10 }}>v{__APP_VERSION__}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--accent-deep)', fontWeight: 600, marginTop: 2 }}>
              📅 {SYSTEM_CHANGELOG[0]?.date ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {SYSTEM_CHANGELOG[0]?.summary ?? ''}
            </div>
            <button className="btn" onClick={() => setShowChangelogModal(true)} style={{ fontSize: 10, marginTop: 6, padding: '3px 8px' }}>
              📜 Bitácora de Parches
            </button>
          </div>
        </div>

        {role === 'admin' && (
          <div style={{ padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--info-bg)', color: 'var(--info)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
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
              </div>
            </div>
          </div>
        )}
      </div>

      <BandejaMaquilaWidget />
      
      {/* 🚀 Widget Proactivo: Asistente de Siguiente Acción */}
      {(k.pedidoPendiente.length > 0 || k.urgentes15 > 0 || k.review.length > 0) && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(217,119,6,0.2) 100%)', border: '1px solid var(--accent)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 16, boxShadow: 'var(--shadow-hover)' }}
        >
          <div style={{ fontSize: 32, filter: 'drop-shadow(0 0 8px rgba(245,158,11,0.5))' }}>✨</div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: 16, color: 'var(--accent)' }}>Sugerencias Proactivas</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 14, color: 'var(--ink-soft)' }}>
              {k.pedidoPendiente.length > 0 ? `Tienes ${k.pedidoPendiente.length} órdenes con entregas pero sin facturar. ` : ''}
              {k.urgentes15 > 0 ? `Existen ${k.urgentes15} contrarecibos urgentes por cobrar. ` : ''}
              {k.review.length > 0 ? `Hay ${k.review.length} XMLs esperando validación manual.` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {k.pedidoPendiente.length > 0 && <button className="btn btn-primary" onClick={() => nav('/ordenes?filtro=pedido')}>Facturar Ahora</button>}
            {k.urgentes15 > 0 && <button className="btn" onClick={() => nav('/cobranza')}>Cobrar</button>}
          </div>
        </motion.div>
      )}

      {/* Panel de Semáforo de Alertas Visuales - Control de Gestión */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: k.criticos30 > 0 ? 'rgba(239,68,68,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.criticos30 > 0 ? '#ef4444' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🔴</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.criticos30 > 0 ? '#b91c1c' : 'var(--ink-faint)' }}>Críticos (&gt;30 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.criticos30 > 0 ? '#b91c1c' : 'var(--ink)' }}>{k.criticos30} factura(s)</div>
          </div>
        </div>

        <div style={{ background: k.urgentes15 > 0 ? 'rgba(249,115,22,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.urgentes15 > 0 ? '#f97316' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟠</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.urgentes15 > 0 ? '#c2410c' : 'var(--ink-faint)' }}>Urgentes (16-30 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.urgentes15 > 0 ? '#c2410c' : 'var(--ink)' }}>{k.urgentes15} factura(s)</div>
          </div>
        </div>

        <div style={{ background: k.recientes1 > 0 ? 'rgba(234,179,8,0.12)' : 'var(--paper-sunk)', border: `1px solid ${k.recientes1 > 0 ? '#eab308' : 'var(--line)'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟡</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: k.recientes1 > 0 ? '#a16207' : 'var(--ink-faint)' }}>Recientes (1-15 días)</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: k.recientes1 > 0 ? '#a16207' : 'var(--ink)' }}>{k.recientes1} factura(s)</div>
          </div>
        </div>

        <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid #10b981', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>🟢</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#047857' }}>Por Recoger Contador</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#047857' }}>{k.porRecibir.length} contrarecibo(s)</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📅</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Flujo a 7 Días</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{money(k.proyeccion7d)}</div>
          </div>
        </div>

        <div style={{ background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📈</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--ink-faint)' }}>Flujo a 15 Días</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--ok)' }}>{money(k.proyeccion15d)}</div>
          </div>
        </div>
      </div>

      {(k.overdue.length > 0 || k.review.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {k.overdue.length > 0 && (
            <div className="alert bad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Atención:</strong> Tienes {k.overdue.length} contrarecibo{k.overdue.length > 1 ? 's' : ''} vencido{k.overdue.length > 1 ? 's' : ''} por <strong>{money(k.vencido)}</strong>.
              </div>
              <button className="btn btn-danger" onClick={() => nav('/cobranza')}>Ir a Cobranza</button>
            </div>
          )}
          {k.review.length > 0 && (
            <div className="alert warn" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <strong>Revisión manual:</strong> {k.review.length} archivo{k.review.length > 1 ? 's' : ''} con errores en XML o que esperan captura manual.
              </div>
              <button className="btn" onClick={() => nav('/ordenes?filtro=manual_review')} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)' }}>Revisar Ahora</button>
            </div>
          )}
        </div>
      )}

      {k.porRecibir.length > 0 && (() => {
        const totalBruto = k.porRecibir.reduce((acc: number, r: any) => acc + r.invoiceTotal, 0);
        const totalComision = k.porRecibir.reduce((acc: number, r: any) => acc + r.commission, 0);
        return (
        <div style={{
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0d2218 100%)',
          border: '1px solid var(--ok)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 22,
        }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>
              💼 Por Recibir del Contador
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
              Estas facturas ya fueron cobradas por el cliente — el contador aún no te da el efectivo
            </div>
          </div>
          {/* Flujo claro en 3 pasos: lo que cobró el cliente -> comisión -> lo que de verdad entra a Caja.
              Antes solo se veia el neto final, sin explicar de donde salia — cualquiera que no conociera
              el descuento del contador de memoria tenia que sumar la tabla completa para entender la diferencia. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '14px 18px' }}>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Cobrado por el cliente</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{money(totalBruto)}</div>
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)' }}>−</div>
            <div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Comisión del contador</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#f87171' }}>{money(totalComision)}</div>
            </div>
            <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.35)' }}>=</div>
            <div style={{ marginLeft: 'auto' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Esto es lo que entra a tu Caja</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--ok)' }}>{money(k.totalPorRecibir)}</div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Factura</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Contrarecibo</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Importe Factura</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Comisión</th>
                <th style={{ padding: '6px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Neto a recibir</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {k.porRecibir.map((r: any, idx: number) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '8px 8px', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>#{r.folio}</td>
                  <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{r.cr}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>{money(r.invoiceTotal)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--bad)' }}>-{money(r.commission)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--ok)', fontWeight: 700 }}>{money(r.net)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right' }}>
                    <button className="btn" style={{ background: 'rgba(34,197,94,0.2)', color: 'var(--ok)', borderColor: 'var(--ok)', padding: '4px 10px', fontSize: 12, fontWeight: 600 }} onClick={() => handleRecibir(r)}>
                      💵 Recibir → CAJA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Abre la factura → "💵 Recibida del Contador → Caja Chica" para mover el dinero automáticamente.
          </div>
        </div>
        );
      })()}

      {role !== 'viewer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {role === 'admin' && (
            <button className="btn" onClick={() => nav('/compras')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
              <span style={{ fontSize: 24 }}>🏭</span>
              <span style={{ fontWeight: 600 }}>Comprar al Fabricante</span>
            </button>
          )}
          <button className="btn" onClick={() => nav('/cobranza')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>💰</span>
            <span style={{ fontWeight: 600 }}>Registrar Cobro</span>
          </button>
          {role === 'admin' && (
            <button
              className="btn"
              onClick={() => { window.location.href = '/audit'; }}
              title="Sube tu Excel corregido y aplica los cambios a la base de datos."
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px', background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}
            >
              <span style={{ fontSize: 24 }}>⚖️</span>
              <span style={{ fontWeight: 600 }}>Ir a Auditoría Maestra</span>
            </button>
          )}
          {role === 'admin' && (
            <button
              className="btn"
              onClick={() => void recalcStats()}
              disabled={recalcBusy}
              title="Reconstruye los indicadores de este panel leyendo todos los expedientes. Úsalo si las cifras se ven en cero o descuadradas."
              style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}
            >
              <span style={{ fontSize: 24 }}>{recalcBusy ? '⏳' : '🔄'}</span>
              <span style={{ fontWeight: 600 }}>{recalcBusy ? 'Recalculando…' : 'Recalcular Indicadores'}</span>
            </button>
          )}
        </div>
      )}

      {(statsDoc?.counters?.totalOrders ?? 0) === 0 && role === 'admin' && (
        <div className="alert info" style={{ marginBottom: 22, padding: '16px 20px', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            El sistema no tiene órdenes registradas aún
          </div>
          <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Puedes cargar varios expedientes de golpe desde un Excel en la Auditoría Maestra,
            o capturar el primero a mano desde Expedientes.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => window.location.href = '/audit'}>
              ⚖️ Ir a la Auditoría Maestra
            </button>
            <button className="btn" onClick={() => nav('/ordenes?nueva=1')}>
              + Capturar a mano
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
          <Skeleton style={{ height: 160, borderRadius: 20 }} />
          <Skeleton style={{ height: 160, borderRadius: 20 }} />
          <Skeleton style={{ height: 160, borderRadius: 20 }} />
          <Skeleton style={{ height: 160, borderRadius: 20 }} />
        </div>
      ) : (
        <ModernKpiGrid k={k} role={role} saldoCaja={saldoCaja} monthFilter={monthFilter} nav={nav} contrarecibosVencidosCount={contrarecibosVencidosCount} config={config} />
      )}

      <QuickActionsBar 
        role={role}
        onNewOrder={() => nav('/ordenes?nueva=1')}
        onOpenContrarecibos={() => setShowContrarecibosDrawer(true)}
        onOpenSeguimiento={() => setShowSeguimientoDrawer(true)}
        onQuickInvoice={() => setShowQuickInvoice(true)}
        onQuickCollection={() => setShowQuickCollection(true)}
        onQuickPay={() => setShowQuickPay(true)}
      />

      {showContrarecibosDrawer && (
        <Drawer title="Vencimientos (Contrarecibos)" onClose={() => setShowContrarecibosDrawer(false)} width={900}>
          <ContrarecibosTable orders={activeOrders} />
        </Drawer>
      )}

      {showSeguimientoDrawer && (
        <Drawer title="Seguimiento de Pedidos" onClose={() => setShowSeguimientoDrawer(false)} width={1000}>
          <SeguimientoPedidosTable orders={activeOrders} />
        </Drawer>
      )}

      {showQuickInvoice && (
        <QuickInvoiceModal 
          orders={activeOrders} 
          onClose={() => setShowQuickInvoice(false)} 
        />
      )}

      {showQuickCollection && (
        <QuickCollectionModal 
          orders={activeOrders} 
          onClose={() => setShowQuickCollection(false)} 
        />
      )}

      {showQuickPay && (
        <QuickPayModal 
          orders={activeOrders} 
          onClose={() => setShowQuickPay(false)} 
        />
      )}

      <Suspense fallback={null}>
        {showBackupsModal && (
          <CloudBackupsModal 
            onClose={() => setShowBackupsModal(false)}
            cloudBackups={cloudBackups as any}
            backupBusy={backupBusy}
            handleCreateBackup={handleCreateBackup}
            handleRestoreBackup={handleRestoreBackup as any}
          />
        )}

        {showChangelogModal && (
          <ChangelogModalComponent onClose={() => setShowChangelogModal(false)} />
        )}

        {showLiveLogsModal && (
          <LiveLogsModal 
            onClose={() => setShowLiveLogsModal(false)}
            liveLogs={liveLogs as any}
          />
        )}
      </Suspense>
    </>
  );
}
