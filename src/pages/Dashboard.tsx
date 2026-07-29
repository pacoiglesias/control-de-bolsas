import { useMemo, useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { usePurchases } from '../hooks/usePurchases';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useToast } from '../context/ToastContext';
import { KpiCard, Card, Empty, StatusBadge, Skeleton, ResponsiveMoney, Modal } from '../components/ui';
import { fmtDate, kilos, money, monthKey, monthLabel, percent, toDate } from '../lib/format';
import { daysLate, getOrderSummary } from '../lib/finance';
import { seedInitialDatabase, INITIAL_SEED_DATA } from '../lib/seedData';
import { logAction } from '../lib/logger';
import { createCloudBackup, listCloudBackups, restoreCloudBackup, type CloudSnapshotMeta } from '../lib/cloudBackup';

export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const SYSTEM_CHANGELOG: SystemRelease[] = [
  {
    version: 'v5.4.0',
    date: '28 de Julio de 2026',
    time: '09:25 PM',
    summary: 'Paquete Consolidado PDF (Remisión + CR + Factura), Rentabilidad Líquida Real por CR, Optimización O(1) Cloud Functions y Seguridad Zero-Trust.',
    highlights: [
      'Paquete de Impresión Consolidado (Remisión + CR + Factura) en 1-clic con firmantes',
      'Tabla de Rentabilidad Líquida Real por Contrarecibo ($ y %) sin mermas para Andrés',
      'Indexación O(1) de invoiceFolios en Cloud Functions eliminando Full Table Scans',
      'Edición interactiva de expedientes directamente desde Seguimiento de OC (/oc)',
      'Seguridad Zero-Trust: email_verified == true en Firestore & Storage Rules',
    ]
  },
  {
    version: 'v5.3.0',
    date: '28 de Julio de 2026',
    time: '06:10 PM',
    summary: 'Seguimiento OC, Flujo de Cobro en 3 Estados y Sincronización HTML Offline.',
    highlights: [
      'Vista de Seguimiento OC (/oc) para comparar kilos contratados vs surtidos',
      'Flujo de Cobranza de 3 Estados (Por Cobrar -> Con Contador -> Recibido en Caja)',
      'Widget "Por Recibir del Contador" en Dashboard',
      'Sincronización en la nube con plantilla HTML Offline (bridge.ts)',
    ]
  },
  {
    version: 'v5.2.0',
    date: '28 de Julio de 2026',
    time: '02:40 PM',
    summary: 'Sistema de Respaldos Rodantes en la Nube (5 Máx) y Comisión Editable por Factura.',
    highlights: [
      'Poda automática de snapshots reteniendo exactamente los 5 más recientes',
      'Restauración a 1-clic desde la interfaz del Dashboard',
      'Campo de comisión del contador editable por factura individual',
    ]
  }
];

export default function Dashboard() {
  const { orders, loading, error } = useOrders();
  const { purchases } = usePurchases();
  const { expenses, loading: loadingExp } = useExpenses();
  const { role, user } = useAuth();
  const { config } = useConfig();
  const nav = useNavigate();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);
  const [health, setHealth] = useState<{ snapshotDate: Date | null; recentLogs: number; dbStatus: string }>({ snapshotDate: null, recentLogs: 0, dbStatus: '...' });
  const [showBackupsModal, setShowBackupsModal] = useState(false);
  const [showChangelogModal, setShowChangelogModal] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudSnapshotMeta[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);

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
      } catch(e) {
        setHealth({ snapshotDate: null, recentLogs: 0, dbStatus: 'Sin conexión' });
      }
    };
    fetchHealth();
  }, [role]);

  async function handleCreateBackup() {
    setBackupBusy(true);
    try {
      const res = await createCloudBackup(user?.email, orders, purchases, expenses, config);
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

  const k = useMemo(() => {
    const live: any[] = [];
    const pending: any[] = [];
    const overdue: any[] = [];
    const paid: any[] = [];
    const review: any[] = [];

    let totalKilos = 0;
    let totalVendido = 0;
    let netoTotal = 0;
    let porCobrar = 0;
    let vencido = 0;
    let cobrado = 0;
    let netoCobrado = 0;
    const meses: Record<string, { venta: number; cobrado: number; ganancia: number }> = {};
    const proximos: any[] = [];

    orders.forEach(o => {
      const status = o.creditCycle?.status;
      if (status === 'manual_review') review.push(o);
      else live.push(o);

      if (status === 'pending') pending.push(o);
      if (status === 'overdue') overdue.push(o);
      if (status === 'paid') paid.push(o);

      if (status !== 'manual_review') {
        const s = getOrderSummary(o);
        totalKilos += o.totalKilograms ?? 0;
        
        s.invoices.forEach(inv => {
          const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          const invNet = inv.financials?.netCashFlow ?? 0;
          const paidAmt = inv.collection?.paidAmount ?? 0;
          const saldo = Math.max(invTotal - paidAmt, 0);
          
          totalVendido += invTotal;
          netoTotal += invNet;
          
          if (inv.creditCycle.status === 'paid') {
            cobrado += paidAmt > 0 ? paidAmt : invTotal;
            netoCobrado += invNet;
          } else if (inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') {
            porCobrar += saldo;
            if (inv.creditCycle.status === 'overdue') {
              vencido += saldo;
            }
          }

          const d = toDate(inv.creditCycle.issueDate) ?? toDate(o.processedAt);
          if (d) {
            const key = monthKey(d);
            meses[key] = meses[key] ?? { venta: 0, cobrado: 0, ganancia: 0 };
            meses[key].venta += invTotal;
            meses[key].ganancia += invNet;
            if (inv.creditCycle.status === 'paid') meses[key].cobrado += invTotal;
          }

          if (inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') {
            const late = daysLate(toDate(inv.creditCycle.dueDate));
            if (late !== null && late > -8) proximos.push({ o, inv, d: late });
          }
        });
      }
    });

    // Facturas en estado 'paid': el cliente pagó pero el contador aún no te da el efectivo
    const porRecibir: { folio: string; cr: string; invoiceTotal: number; commission: number; net: number }[] = [];
    orders.forEach(o => {
      (o.invoices ?? []).forEach(inv => {
        if (inv.creditCycle?.status === 'paid') {
          const invTotal = inv.financials?.invoiceTotal ?? 0;
          const commission = inv.financials?.commission ?? 0;
          porRecibir.push({
            folio: inv.folio ?? '?',
            cr: inv.collection?.contrareciboNumber ?? '—',
            invoiceTotal: invTotal,
            commission,
            net: invTotal - commission,
          });
        }
      });
    });
    const totalPorRecibir = porRecibir.reduce((s, x) => s + x.net, 0);

    const mesesKeys = Object.keys(meses).sort().slice(-6);
    const maxMes = mesesKeys.length > 0 ? Math.max(1, ...mesesKeys.map((m) => meses[m].venta)) : 1;
    proximos.sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

    return {
      totalKilos, totalVendido, netoTotal, porCobrar, vencido, cobrado, netoCobrado,
      pending, overdue, paid, review, meses, mesesKeys, maxMes, proximos,
      porRecibir, totalPorRecibir,
    };
  }, [orders]);

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

  return (
    <>
      <div className="page-head">
        <h1>Panel Principal</h1>
        <p>Centro de mando operativo y financiero. {role !== 'viewer' && `Precio de venta ${money(config.salePricePerKg)}/kg, costo ${money(config.costPricePerKg)}/kg, comisión ${percent(config.commissionRate)}.`}</p>
      </div>

      {/* WIDGET ÚLTIMO CAMBIO Y SALUD DEL SISTEMA */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, padding: 16, background: 'var(--paper-sunk)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: 280, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: 'var(--accent-sunk)', color: 'var(--accent-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
            🚀
          </div>
          <div>
            <div style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Último Cambio del Sistema
              <span className="badge badge-ok" style={{ fontSize: 11 }}>{SYSTEM_CHANGELOG[0].version}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600, marginTop: 2 }}>
              🕒 {SYSTEM_CHANGELOG[0].date} a las {SYSTEM_CHANGELOG[0].time}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              {SYSTEM_CHANGELOG[0].summary}
            </div>
          </div>
        </div>

        <button className="btn" onClick={() => setShowChangelogModal(true)} style={{ fontSize: 12, background: 'var(--surface)', borderColor: 'var(--line)', fontWeight: 600, padding: '8px 12px' }}>
          📜 Bitácora de Cambios
        </button>

        {role === 'admin' && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderLeft: '1px solid var(--line)', paddingLeft: 16 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--ink)' }}>Último Respaldo (Nube)</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginBottom: 4 }}>{health.snapshotDate ? fmtDate(health.snapshotDate) : 'No detectado'}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 11, padding: '3px 7px' }}>
                  {backupBusy ? 'Guardando…' : '☁ Respaldar'}
                </button>
                <button className="btn" onClick={() => void handleOpenBackupsModal()} disabled={backupBusy} style={{ fontSize: 11, padding: '3px 7px' }}>
                  📋 5 Máx
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ALERTAS URGENTES */}
      {(k.overdue.length > 0 || k.review.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {k.overdue.length > 0 && (
            <div className="alert bad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Atención:</strong> Tienes {k.overdue.length} factura{k.overdue.length > 1 ? 's' : ''} vencida{k.overdue.length > 1 ? 's' : ''} por <strong>{money(k.vencido)}</strong>.
              </div>
              <button className="btn btn-danger" onClick={() => nav('/cobranza')}>Ir a Cobranza</button>
            </div>
          )}
          {k.review.length > 0 && (
            <div className="alert warn" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <strong>Revisión manual:</strong> {k.review.length} PDF{k.review.length > 1 ? 's' : ''} no pudieron ser leídos por la IA y esperan captura.
              </div>
              <button className="btn" onClick={() => nav('/ordenes?filtro=manual_review')} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)' }}>Revisar Ahora</button>
            </div>
          )}
        </div>
      )}

      {/* 💼 POR RECIBIR DEL CONTADOR */}
      {k.porRecibir.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1a3a2a 0%, #0d2218 100%)',
          border: '1px solid var(--ok)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 22,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>
                💼 Por Recibir del Contador
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                Estas facturas ya fueron cobradas por el cliente — el contador aún no te da el efectivo
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Total neto a recibir</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--ok)' }}>{money(k.totalPorRecibir)}</div>
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
              </tr>
            </thead>
            <tbody>
              {k.porRecibir.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <td style={{ padding: '8px 8px', color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>#{r.folio}</td>
                  <td style={{ padding: '8px 8px', color: 'rgba(255,255,255,0.7)', fontFamily: 'monospace' }}>{r.cr}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'rgba(255,255,255,0.8)' }}>{money(r.invoiceTotal)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--bad)' }}>-{money(r.commission)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: 'var(--ok)', fontWeight: 700 }}>{money(r.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Abre la factura → "💵 Recibida del Contador → Caja Chica" para mover el dinero automáticamente.
          </div>
        </div>
      )}

      {/* ACCIONES RÁPIDAS */}
      {role !== 'viewer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <button className="btn" onClick={() => nav('/subir')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>📥</span>
            <span style={{ fontWeight: 600 }}>Subir PDF</span>
          </button>
          <button className="btn" onClick={() => nav('/ordenes?nueva=1')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>🛒</span>
            <span style={{ fontWeight: 600 }}>Nueva Venta Manual</span>
          </button>
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
        </div>
      )}

      {orders.length === 0 && INITIAL_SEED_DATA.length > 0 && (
        <div className="alert info" style={{ marginBottom: 22, padding: '16px 20px', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            El sistema no tiene órdenes registradas aún
          </div>
          <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Puedes cargar la base inicial con {INITIAL_SEED_DATA.length} registro{INITIAL_SEED_DATA.length === 1 ? '' : 's'} de ejemplo.
          </div>
          <button
            className="btn btn-primary"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                await seedInitialDatabase();
                logAction(user?.email, 'Base Inicial Cargada', { registros: INITIAL_SEED_DATA.length });
                toast(`Base inicial cargada: ${INITIAL_SEED_DATA.length} registros`, 'ok');
              } catch (e) {
                toast(`Error al cargar datos: ${(e as Error).message}`, 'bad');
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? 'Cargando datos…' : `📥 Cargar base inicial (${INITIAL_SEED_DATA.length} registros)`}
          </button>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard hero label="TOTAL VENDIDO" value={<ResponsiveMoney value={k.totalVendido} />}
          sub={`${kilos(k.totalKilos)} procesados en ${orders.length} órdenes`} />
        {role !== 'viewer' && (
          <KpiCard tone="ok" label="Ganancia neta (flujo)" value={<ResponsiveMoney value={k.netoTotal} />}
            sub="venta − costo − comisión" />
        )}
        <KpiCard tone={k.porCobrar > 0 ? 'warn' : 'ok'} label="Te deben" value={<ResponsiveMoney value={k.porCobrar} />}
          sub={`${k.pending.length + k.overdue.length} órdenes abiertas`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone={k.overdue.length ? 'bad' : undefined} label="Vencido" value={<ResponsiveMoney value={k.vencido} />}
          sub={`${k.overdue.length} factura${k.overdue.length === 1 ? '' : 's'} pasada${k.overdue.length === 1 ? '' : 's'} de fecha`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone="cash" label="Cobrado" value={<ResponsiveMoney value={k.cobrado} />}
          sub={role !== 'viewer' ? `neto ${money(k.netoCobrado)}` : undefined} />
        {role === 'admin' && (
          <KpiCard tone={saldoCaja < 0 ? "bad" : "ok"} label="Caja Chica" value={<ResponsiveMoney value={saldoCaja} />}
            sub="flujo líquido" onClick={() => nav('/caja-chica')} />
        )}
        <KpiCard tone={k.review.length ? 'warn' : undefined} label="Esperan captura manual"
          value={k.review.length} sub="la IA no pudo leer el PDF"
          onClick={() => nav('/ordenes?filtro=manual_review')} />
      </div>

      {k.mesesKeys.length > 0 && (
        <Card title="Ganancias Estimadas por Fecha de Factura">
          <div className="table-scroll">
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Mes de Emisión</th>
                  <th className="num">Venta Facturada</th>
                  <th className="num">Ganancia Neta Estimada</th>
                  <th className="num">Margen de Utilidad</th>
                </tr>
              </thead>
              <tbody>
                {k.mesesKeys.map(m => {
                  const data = k.meses[m];
                  const margen = data.venta > 0 ? (data.ganancia / data.venta) * 100 : 0;
                  return (
                    <tr key={m}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel(m)}</td>
                      <td className="num mono">{money(data.venta)}</td>
                      <td className="num mono" style={{ color: 'var(--ok)', fontWeight: 700 }}>{money(data.ganancia)}</td>
                      <td className="num mono">{margen.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ width: '100%', height: 320, padding: '16px 20px', marginTop: '16px' }}>
            <ResponsiveContainer>
              <BarChart
                data={k.mesesKeys.map(m => ({ name: monthLabel(m), vendido: k.meses[m].venta, ganancia: k.meses[m].ganancia, cobrado: k.meses[m].cobrado }))}
                margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-soft)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--ink-soft)' }}
                  tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--paper-sunk)' }}
                  contentStyle={{ backgroundColor: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--ink)', fontSize: 13, boxShadow: 'var(--shadow)' }}
                  formatter={(value: any) => money(Number(value))}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="vendido" name="Total Vendido" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="ganancia" name="Utilidad Neta" fill="var(--ok)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="Qué vence pronto o ya venció" hint={`${k.proximos.length}`}>
        {k.proximos.length === 0 ? (
          <Empty>Nada urgente por cobrar.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th><th>Cliente</th><th>Vence</th><th className="num">Días</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.proximos.slice(0, 8).map(({ o, inv, d }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  return (
                  <tr key={inv.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}>
                    <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono">{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                    <td className="num mono">{money(saldo)}</td>
                    <td><StatusBadge status={inv.creditCycle.status} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showBackupsModal && (
        <Modal title="☁ Respaldos en la Nube (Máximo 5 rodantes)" onClose={() => setShowBackupsModal(false)}>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
              El sistema mantiene automáticamente los <strong>5 respaldos más recientes</strong> en Firestore. Si creas uno nuevo, el más antiguo se elimina de la nube para no saturar.
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Respaldos activos: {cloudBackups.length} de 5</span>
              <button className="btn btn-primary" onClick={() => void handleCreateBackup()} disabled={backupBusy} style={{ fontSize: 12 }}>
                {backupBusy ? 'Guardando…' : '➕ Crear Nuevo Respaldo Ahora'}
              </button>
            </div>
            {cloudBackups.length === 0 ? (
              <Empty>No hay respaldos guardados aún en la nube.</Empty>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cloudBackups.map((snap, idx) => (
                  <div key={snap.id} style={{ padding: 14, background: 'var(--paper-sunk)', borderRadius: 8, border: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span>📅 {snap.createdAt ? snap.createdAt.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }) : snap.id}</span>
                        {idx === 0 && <span style={{ fontSize: 11, background: 'var(--ok)', color: '#fff', padding: '2px 6px', borderRadius: 4 }}>Más reciente</span>}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 4 }}>
                        Creado por: <strong>{snap.createdBy}</strong> · Expedientes: <strong>{snap.totalOrders}</strong>
                      </div>
                    </div>
                    <button className="btn" onClick={() => void handleRestoreBackup(snap)} disabled={backupBusy} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', fontSize: 12 }}>
                      🔄 Restaurar este respaldo
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {showChangelogModal && (
        <Modal title="📜 Bitácora Histórica de Cambios del Sistema" onClose={() => setShowChangelogModal(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '65vh', overflowY: 'auto', paddingRight: 8 }}>
            {SYSTEM_CHANGELOG.map((item) => (
              <div key={item.version} style={{ padding: 16, background: 'var(--paper-sunk)', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexWrap: 'wrap', gap: 8 }}>
                  <span className="badge badge-ok" style={{ fontSize: 13, fontWeight: 700 }}>Versión {item.version}</span>
                  <span style={{ fontSize: 12, color: 'var(--accent-deep)', fontWeight: 600 }}>🕒 {item.date} — {item.time}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)', marginBottom: 8 }}>{item.summary}</div>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--ink-soft)' }}>
                  {item.highlights.map((h, i) => (
                    <li key={i} style={{ marginBottom: 4 }}>{h}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
