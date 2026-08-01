import { useState, useMemo } from 'react';
import { doc, collection, setDoc, serverTimestamp, Timestamp, addDoc, runTransaction } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { usePurchases } from '../hooks/usePurchases';
import { useExpenses } from '../hooks/useExpenses';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { Card, Empty, Field, Modal, Skeleton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { logAction } from '../lib/logger';
import { useToast } from '../context/ToastContext';
import { fmtDate, money, exportToCsv, getPrintHeaderHtml, kilos, toInputDate, fromInputDate } from '../lib/format';
import { round2 } from '../lib/finance';
import {
  newDeliveryEvent,
  updateDeliveryField,
  updateDeliveryItemQuantity,
  computeDeliveredTotals,
  migrateLegacyDeliveries,
  upsertAndresPurchase,
} from '../lib/deliveries';
import type { Purchase, PurchaseOrder } from '../lib/types';
import { safeDeleteDoc } from '../lib/logger';

export default function Compras() {
  const { role } = useAuth();
  const { purchases, loading: loadingP, error: errorP } = usePurchases();
  const { expenses, loading: loadingE, error: errorE } = useExpenses();
  const { orders } = useOrders();
  const [selected, setSelected] = useState<Purchase | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<PurchaseOrder | null>(null);
  const [pagarModal, setPagarModal] = useState(false);
  const [ajusteModal, setAjusteModal] = useState(false);
  const [tab, setTab] = useState<'ordenes' | 'pagos' | 'facturar' | 'revision' | 'estado'>('ordenes');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'activas'|'completadas'|'todas'>('activas');
  const selectedProvider = 'Andres';

  const toast = useToast();
  const { config } = useConfig();
  const { settings } = useSystemSettings();

  const isLoading = loadingP || loadingE;

  

  const [pagoAbono, setPagoAbono] = useState({ amount: '', concept: 'Abono a Cuenta / Anticipo', date: toInputDate(new Date()) });
  const [busyPago, setBusyPago] = useState(false);

  async function registrarAbono() {
    if (busyPago) return;
    const val = Number(pagoAbono.amount);
    if (isNaN(val) || val <= 0) return toast('El monto debe ser mayor a cero.', 'bad');
    if (!pagoAbono.concept.trim()) return toast('El concepto es obligatorio.', 'bad');
    
    if (!confirm(`¿Confirmas registrar un abono de $${val.toLocaleString('es-MX')} a Andrés?`)) return;
    
    setBusyPago(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        amount: val,
        concept: pagoAbono.concept.trim(),
        date: fromInputDate(pagoAbono.date)?.getTime() || Date.now(),
        provider: 'Andrés', // Hardcoded provider to guarantee consistency
        type: 'egreso' // Dinero que sale de caja
      });
      setPagarModal(false);
      setPagoAbono({ amount: '', concept: 'Abono a Cuenta / Anticipo', date: toInputDate(new Date()) });
      toast(`Abono por $${val.toLocaleString('es-MX')} registrado correctamente.`, 'ok');
    } catch (e: any) {
      toast(e.message, 'bad');
    } finally {
      setBusyPago(false);
    }
  }

  const orderById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);

  const provPurchases = useMemo(() => purchases.filter(p => p.provider.toLowerCase() === selectedProvider.toLowerCase()), [purchases, selectedProvider]);
  const provExpenses = useMemo(() => expenses.filter(e => e.provider?.toLowerCase() === selectedProvider.toLowerCase()), [expenses, selectedProvider]);

  const hoy = Date.now();
  
  // Financial logic (Dinero)
  const totalReceivedKilos = provPurchases.reduce((acc, p) => acc + (p.receivedKilos ?? 0), 0);
  const currentCostPerKg = config?.costPricePerKg || 42;
  
  // Bugfix (Ciclo 42): Valor Entregado histórico. Si p.pricePerKg no existe (registros muy viejos),
  // se usa currentCostPerKg por seguridad, pero los nuevos siempre tendrán su precio histórico congelado.
  const totalPurchasesCost = round2(provPurchases.reduce((acc, p) => acc + ((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)), 0));
  
  const totalPagado = provExpenses.reduce((acc, e) => {
    if (e.type === 'egreso') return acc + e.amount; // Anticipos/Pagos
    if (e.type === 'ingreso') return acc - e.amount; // Devoluciones o Ajustes a favor
    return acc;
  }, 0);
  
  const deudaHistorica = config?.historicalDebtAndres || 0;
  const deudaReal = totalPurchasesCost - totalPagado + deudaHistorica;

  // Filter Logic
  const searchedPurchases = search.trim()
    ? provPurchases.filter((p) => {
        const o = orderById.get(p.id);
        const q = search.trim().toLowerCase();
        return (o?.folio ?? '').toLowerCase().includes(q) || (o?.client ?? '').toLowerCase().includes(q) || (p.id.toLowerCase().includes(q));
      })
    : provPurchases;

  const filteredPurchases = searchedPurchases.filter(p => {
    const montoOC = p.totalAmount || 0;
    const isCompleted = montoOC > 0 && (p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg) >= montoOC;
    if (filter === 'activas') return !isCompleted;
    if (filter === 'completadas') return isCompleted;
    return true;
  });

  const entregasAtrasadas = provPurchases.filter((p) => {
    const o = orderById.get(p.id);
    if (!o?.estimatedDeliveryDate) return false;
    const kilosFaltan = (p.expectedKilos ?? 0) - (p.receivedKilos ?? 0);
    return kilosFaltan > 0.01 && o.estimatedDeliveryDate.toMillis() < hoy;
  });

  // Ledger for State of Account
  type LedgerEntry = { id: string; date: Timestamp | null; concept: string; cargo: number; abono: number; balance: number; source: 'purchase' | 'expense' };
  
  const ledger: LedgerEntry[] = useMemo(() => {
    return [
      ...provPurchases.map(p => ({
        id: p.id,
        date: p.date,
        concept: `Entrega (Amortización) OC-${orderById.get(p.id)?.folio || 'S/F'}`,
        cargo: round2((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg)), // Sube la deuda (respeta precio histórico)
        abono: 0,
        balance: 0,
        source: 'purchase' as const
      })).filter(x => x.cargo > 0),
      ...provExpenses.map(e => ({
        id: e.id,
        date: e.date,
        concept: e.concept,
        cargo: e.type === 'ingreso' ? e.amount : 0, 
        abono: e.type === 'egreso' ? e.amount : 0, 
        balance: 0,
        source: 'expense' as const
      }))
    ].sort((a, b) => (a.date?.toMillis() ?? 0) - (b.date?.toMillis() ?? 0));
  }, [provPurchases, provExpenses, currentCostPerKg, orderById]);

  // Compute accumulated balance
  let currentBalance = -deudaHistorica;
  
  const historicalEntry = deudaHistorica !== 0 ? [{
    id: 'historical',
    date: null,
    concept: 'Saldo Histórico (Antes del Sistema)',
    cargo: deudaHistorica < 0 ? -deudaHistorica : 0,
    abono: deudaHistorica > 0 ? deudaHistorica : 0,
    balance: -deudaHistorica,
    source: 'historical' as const
  }] : [];

  const ledgerWithBalance = [
    ...historicalEntry,
    ...ledger.map(e => {
      currentBalance += (e.cargo - e.abono);
      return { ...e, balance: currentBalance };
    })
  ];

  if (errorP || errorE) return <div className="alert bad">{errorP || errorE}</div>;
  if (!loadingP && !loadingE && role !== 'admin') return <Navigate to="/" replace />;

  function exportComprasCsv() {
    const headers = ['Fecha', 'Concepto', 'Valor Entregado (Material)', 'Pagos/Adelantos', 'Origen'];
    const rows = ledger.map(e => [
      fmtDate(e.date),
      e.concept,
      e.cargo ? e.cargo.toFixed(2) : '0.00',
      e.abono ? e.abono.toFixed(2) : '0.00',
      e.source === 'purchase' ? 'Entrega Material' : 'CAJA (Adelanto)'
    ]);
    exportToCsv(`Estado_Cuenta_Andres_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('📥 Archivo de Excel (CSV) descargado con éxito.', 'ok');
  }

  function sendWhatsAppStatement() {
    const texto = `Hola Andrés, te comparto el estado de cuenta a la fecha:\n\n📦 *Entregas recibidas:* ${totalReceivedKilos.toLocaleString()} kg\n💰 *Valor del material:* $${totalPurchasesCost.toLocaleString('es-MX', {minimumFractionDigits:2})}\n\n💳 *Anticipos pagados:* $${totalPagado.toLocaleString('es-MX', {minimumFractionDigits:2})}\n${deudaHistorica ? `🕰️ *Saldo histórico:* ${deudaHistorica > 0 ? '+' : '-'}$${Math.abs(deudaHistorica).toLocaleString('es-MX', {minimumFractionDigits:2})}\n` : ''}\n📊 *Saldo actual:* $${Math.abs(deudaReal).toLocaleString('es-MX', {minimumFractionDigits:2})} ${deudaReal > 0 ? 'a tu favor (te debemos)' : 'a mi favor (me debes)'}\n\nCualquier duda quedo a la orden.`;
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank');
  }

  function printComprasReport() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Estado de Cuenta Proveedor - Andrés</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
            h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
            .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
            .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
            .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Estado de Cuenta Proveedor: Fabricante de Bolsas")}

          <div class="kpis">
            <div class="kpi"><div class="kpi-title">💰 TOTAL ADELANTADO</div><div class="kpi-val" style="color: #047857;">$${totalPagado.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">📦 VALOR ENTREGADO</div><div class="kpi-val">$${totalPurchasesCost.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
            <div class="kpi"><div class="kpi-title">⚖️ SALDO PENDIENTE</div><div class="kpi-val" style="color: ${deudaReal > 0 ? '#b91c1c' : '#047857'};">$${deudaReal.toLocaleString('es-MX', {minimumFractionDigits:2})}</div></div>
          </div>

          <h3>Libro Mayor Cronológico</h3>
          <table>
            <thead>
              <tr>
                <th>Fecha</th><th>Movimiento / Concepto</th><th class="num">Cargo (Sube Deuda)</th><th class="num">Abono (Baja Deuda)</th><th class="num">Saldo Acumulado</th>
              </tr>
            </thead>
            <tbody>
              ${ledgerWithBalance.map(e => `
                <tr>
                  <td>${fmtDate(e.date) || '—'}</td>
                  <td>${e.concept || '—'}</td>
                  <td class="num" style="font-weight:700; color: #b91c1c">${e.cargo ? `$${e.cargo.toLocaleString('es-MX', {minimumFractionDigits:2})}` : '—'}</td>
                  <td class="num" style="font-weight:700; color: #047857">${e.abono ? `$${e.abono.toLocaleString('es-MX', {minimumFractionDigits:2})}` : '—'}</td>
                  <td class="num" style="font-weight:700; color: ${e.balance > 0 ? '#b91c1c' : '#047857'}">$${e.balance.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onafterprint = () => window.close();
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <>
      <div className="page-head">
        <h1>Proveedor (Andrés)</h1>
        <p>Control financiero: Anticipos, entregas físicas de material y saldo real.</p>
        <div className="tabs" style={{ marginTop: 16 }}>
          <button className={tab === 'ordenes' ? 'active' : ''} onClick={() => setTab('ordenes')}>Entregas (Acopio)</button>
          <button className={tab === 'pagos' ? 'active' : ''} onClick={() => setTab('pagos')}>💳 Pagos a Andrés</button>
          <button className={tab === 'estado' ? 'active' : ''} onClick={() => setTab('estado')}>Auditoría Financiera</button>
        </div>
      </div>

      <div className="kpi-grid">
        <Card title="💰 Pagos y Anticipos (Nuestro favor)">
          {isLoading ? <Skeleton style={{ height: 32, width: '60%' }} /> : (
            <div className="num" style={{ fontSize: 24, color: 'var(--ok)' }}>{money(totalPagado - deudaHistorica)}</div>
          )}
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>Dinero depositado a Andrés.</p>
        </Card>
        <Card title="📦 Material Entregado (Su favor)">
          {isLoading ? <Skeleton style={{ height: 32, width: '60%' }} /> : (
            <div className="num" style={{ fontSize: 24 }}>{money(totalPurchasesCost)}</div>
          )}
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>{kilos(totalReceivedKilos)} kgs entregados a ${currentCostPerKg}/kg.</p>
        </Card>
        <Card title="⚖️ Deuda Real al Día de Hoy">
          {isLoading ? <Skeleton style={{ height: 32, width: '60%' }} /> : (
            <div className="num" style={{ fontSize: 24, color: deudaReal < 0 ? 'var(--ok)' : deudaReal > 0 ? 'var(--bad)' : 'var(--ink)' }}>
              {deudaReal < 0 ? `- ${money(Math.abs(deudaReal))}` : money(deudaReal)}
            </div>
          )}
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>
             {deudaReal < 0 ? 'A tu favor (Andrés te debe bolsas).' : deudaReal > 0 ? 'Le debes dinero a Andrés.' : 'Saldos cuadrados al centavo.'}
          </p>
        </Card>
        <Card title={entregasAtrasadas.length > 0 ? '⚠️ Entregas Atrasadas' : '✅ Entregas al Día'}>
          {isLoading ? <Skeleton style={{ height: 32, width: '60%' }} /> : (
            <div className="num" style={{ fontSize: 24, color: entregasAtrasadas.length > 0 ? 'var(--bad)' : 'var(--ink)' }}>
              {entregasAtrasadas.length} OCs
            </div>
          )}
          <p className="hint" style={{ marginTop: 4, marginBottom: 0 }}>Órdenes que pasaron su fecha estimada.</p>
        </Card>
      </div>

      {tab === 'ordenes' && (
        <Card
          actions={
            <>
              <button className="btn btn-primary no-print" onClick={() => setPagarModal(true)}>💸 Registrar Anticipo / Pago</button>
              <button className="btn btn-primary no-print" onClick={() => setSelected({
                id: doc(collection(db, PATHS.purchases)).id,
                date: Timestamp.fromDate(new Date()),
                provider: selectedProvider,
                expectedKilos: 0,
                receivedKilos: 0,
                pricePerKg: currentCostPerKg,
                totalAmount: 0,
                paidAmount: 0,
                status: 'pedido',
                createdAt: null,
                items: [],
              } as unknown as Purchase)}>
                + Nuevo Pedido a Andrés
              </button>
            </>
          }
          title="Entregas de Material (Acopio y Avance Físico)"
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="input boxed"
              style={{ maxWidth: 320 }}
              placeholder="Buscar por folio o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="btn-group">
              <button className={`btn-small ${filter === 'activas' ? 'active' : ''}`} onClick={() => setFilter('activas')}>Activas</button>
              <button className={`btn-small ${filter === 'completadas' ? 'active' : ''}`} onClick={() => setFilter('completadas')}>Completadas</button>
              <button className={`btn-small ${filter === 'todas' ? 'active' : ''}`} onClick={() => setFilter('todas')}>Todas</button>
            </div>
          </div>
          
          {isLoading ? (
            <div style={{ display: 'grid', gap: 12 }}>
               <Skeleton style={{ height: 40 }} />
               <Skeleton style={{ height: 40 }} />
               <Skeleton style={{ height: 40 }} />
            </div>
          ) : filteredPurchases.length === 0 ? (
            <Empty>No hay órdenes en este estado.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Folio / OC</th>
                    <th>Cliente</th>
                    <th>Fecha OC</th>
                    <th className="num">Anticipo (Monto OC)</th>
                    <th className="num">Valor Entregado</th>
                    <th className="num">Saldo (Dinero)</th>
                    <th>Progreso (Kilos)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((p) => {
                    const o = orderById.get(p.id);
                    const montoOC = p.totalAmount || 0;
                    const valorEntregado = round2((p.receivedKilos ?? 0) * (p.pricePerKg || currentCostPerKg));
                    const saldoOC = montoOC - valorEntregado;
                    
                    const progress = montoOC > 0 ? Math.min(100, Math.round((valorEntregado / montoOC) * 100)) : 0;
                    const isCompleted = progress >= 100;
                    
                    return (
                      <tr key={p.id} style={isCompleted ? { opacity: 0.6 } : undefined}>
                        <td className="mono" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>{o?.folio || '—'}</td>
                        <td style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>{o?.client || '—'}</td>
                        <td className="mono" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>{fmtDate(p.date)}</td>
                        <td className="num mono" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                          <strong>{money(montoOC)}</strong>
                        </td>
                        <td className="num mono" style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>{money(valorEntregado)}</td>
                        <td className="num mono" style={{ cursor: 'pointer', color: saldoOC > 0 ? 'var(--bad)' : 'var(--ok)' }} onClick={() => setSelected(p)}>
                          {money(saldoOC)}
                        </td>
                        <td style={{ cursor: 'pointer' }} onClick={() => setSelected(p)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${progress}%`, height: '100%', background: isCompleted ? 'var(--ok)' : 'var(--info)' }} />
                            </div>
                            <span className="mono" style={{ fontSize: 11, width: 35, textAlign: 'right' }}>{progress}%</span>
                          </div>
                          <div className="hint" style={{ fontSize: 10, marginTop: 2 }}>{kilos(p.receivedKilos)} de {kilos(p.expectedKilos)}</div>
                        </td>
                        <td>
                          {!isCompleted && o && (
                            <button className="btn-small" onClick={(e) => { e.stopPropagation(); setDeliveryOrder(o); }} title="Registrar una entrega de Andrés" style={{ background: 'var(--ok)', color: '#fff', fontWeight: 600, border: 'none' }}>
                              📦 Registrar Entrega
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      
        {tab === 'pagos' && (
          <div className="tab-content active">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <p className="hint" style={{ margin: 0 }}>Historial de abonos y anticipos entregados a Andrés. Estos movimientos salen de Caja Chica.</p>
              <button className="btn btn-primary" onClick={() => setPagarModal(true)}>💵 Registrar Abono a Andrés</button>
            </div>
            
            {provExpenses.length === 0 ? (
              <Empty>No hay abonos registrados para Andrés.</Empty>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Concepto</th>
                      <th>Tipo</th>
                      <th className="num">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provExpenses.sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0)).map(e => (
                      <tr key={e.id}>
                        <td className="mono">{fmtDate(e.date)}</td>
                        <td>{e.concept}</td>
                        <td>
                          <span className={`badge ${e.type === 'ingreso' ? 'badge-ok' : 'badge-bad'}`}>
                            {e.type === 'ingreso' ? 'Devolución (Entra)' : 'Pago (Sale)'}
                          </span>
                        </td>
                        <td className="num mono">
                          <strong>{money(e.amount)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      {tab === 'estado' && (
        <Card
          title="Auditoría Financiera y Libro Mayor"
          actions={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary no-print" onClick={() => setAjusteModal(true)}>⚖️ Registrar Ajuste Manual</button>
              <button className="btn no-print" onClick={sendWhatsAppStatement} style={{ background: '#25D366', color: '#fff', borderColor: '#25D366' }}>📱 Enviar por WhatsApp</button>
              <button className="btn no-print" onClick={exportComprasCsv}>📥 Exportar CSV</button>
              <button className="btn no-print" onClick={printComprasReport}>🖨️ Imprimir Estado</button>
            </div>
          }
        >
          {isLoading ? <Skeleton style={{ height: 300 }} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16 }}>
                 <h4 style={{ margin: '0 0 12px 0', color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                   <span>🕵️‍♂️</span> Fórmula de Auditoría Financiera
                 </h4>
                 <p className="hint" style={{ margin: '0 0 16px 0' }}>El "Valor Entregado" suma el historial congelado de kilos multiplicados por el precio acordado en el momento exacto de cada entrega, blindando la matemática contra cambios futuros de precio.</p>
                 
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, textAlign: 'center' }}>
                   <div>
                     <div className="hint" style={{ fontSize: 11 }}>Kilos Históricos</div>
                     <div className="mono" style={{ fontSize: 16 }}>{totalReceivedKilos.toLocaleString()} kg</div>
                   </div>
                   <div style={{ fontSize: 20, color: '#991b1b', paddingTop: 16 }}></div>
                   <div>
                   </div>
                   <div style={{ fontSize: 20, color: '#991b1b', paddingTop: 16 }}>→</div>
                   <div>
                     <div className="hint" style={{ fontSize: 11 }}>1. Valor Entregado</div>
                     <div className="mono" style={{ fontSize: 16 }}>{money(totalPurchasesCost)}</div>
                   </div>
                 </div>
                 
                 <div style={{ borderTop: '1px dashed #fecaca', margin: '16px 0' }} />
                 
                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, textAlign: 'center' }}>
                   <div>
                     <div className="hint" style={{ fontSize: 11 }}>1. Valor Entregado</div>
                     <div className="mono" style={{ fontSize: 16 }}>{money(totalPurchasesCost)}</div>
                   </div>
                   <div style={{ fontSize: 20, color: '#991b1b', paddingTop: 16 }}>-</div>
                   <div>
                     <div className="hint" style={{ fontSize: 11 }}>4. Total Pagado</div>
                     <div className="mono" style={{ fontSize: 16 }}>{money(totalPagado)}</div>
                   </div>
                   <div style={{ fontSize: 20, color: '#991b1b', paddingTop: 16 }}>=</div>
                   <div>
                     <div className="hint" style={{ fontSize: 11 }}>Deuda Matemática</div>
                     <div className="mono" style={{ fontSize: 18, fontWeight: 'bold' }}>{money(totalPurchasesCost - totalPagado)}</div>
                   </div>
                 </div>
                 {deudaHistorica !== 0 && (
                   <p className="hint" style={{ marginTop: 12, textAlign: 'center', color: '#991b1b' }}>
                     * Nota: Existe una deuda/ajuste histórico configurado por {money(deudaHistorica)} que afecta el balance final.
                   </p>
                 )}
              </div>

              {ledger.length === 0 ? (
                <Empty>No hay movimientos registrados.</Empty>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Origen</th>
                        <th>Movimiento / Concepto</th>
                        <th className="num">Cargo (Sube Deuda)</th>
                        <th className="num">Abono (Baja Deuda)</th>
                        <th className="num">Saldo Acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerWithBalance.map((e, i) => (
                        <tr key={`${e.id}-${i}`}>
                          <td className="mono">{fmtDate(e.date)}</td>
                          <td>
                            {e.source === 'purchase' ? (
                              <span className="badge b-ok">Entregado</span>
                            ) : (
                              <span className="badge b-warn">Pago</span>
                            )}
                          </td>
                          <td>{e.concept}</td>
                          <td className="num mono" style={{ color: e.cargo ? 'var(--bad)' : 'inherit', fontWeight: e.cargo ? 600 : 'normal' }}>
                            {e.cargo ? money(e.cargo) : '—'}
                          </td>
                          <td className="num mono" style={{ color: e.abono ? 'var(--ok)' : 'inherit', fontWeight: e.abono ? 600 : 'normal' }}>
                            {e.abono ? money(e.abono) : '—'}
                          </td>
                          <td className="num mono" style={{ color: e.balance > 0 ? 'var(--bad)' : 'var(--ok)', fontWeight: 700 }}>
                            {money(e.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {selected && <OrderModal purchase={selected} onClose={() => setSelected(null)} costPricePerKg={currentCostPerKg} />}
      {pagarModal && <RegistrarPagoModal selectedProvider={selectedProvider} onClose={() => setPagarModal(false)} />}
      {ajusteModal && <AjusteModal selectedProvider={selectedProvider} onClose={() => setAjusteModal(false)} />}
      
      {pagarModal && (
        <Modal title="Registrar Abono a Andrés" onClose={() => setPagarModal(false)}>
          <div style={{ display: 'grid', gap: 16 }}>
            <p className="hint" style={{ marginTop: 0 }}>
              Este pago saldrá automáticamente de <strong>Caja Chica</strong> y se abonará al saldo de Andrés.
            </p>
            <Field label="Fecha del Abono">
              <input type="date" className="input boxed mono" value={pagoAbono.date} onChange={e => setPagoAbono({...pagoAbono, date: e.target.value})} />
            </Field>
            <Field label="Concepto / Razón">
              <input type="text" className="input boxed" placeholder="Ej. Anticipo Folio 10" value={pagoAbono.concept} onChange={e => setPagoAbono({...pagoAbono, concept: e.target.value})} />
            </Field>
            <Field label="Monto ($)">
              <input type="number" step="0.01" className="input boxed mono" placeholder="0.00" value={pagoAbono.amount} onChange={e => setPagoAbono({...pagoAbono, amount: e.target.value})} />
            </Field>
            <div className="modal-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setPagarModal(false)} disabled={busyPago}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarAbono} disabled={busyPago}>
                {busyPago ? 'Registrando...' : '💳 Registrar Abono'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {deliveryOrder && <RegistrarEntregaModal order={deliveryOrder} onClose={() => setDeliveryOrder(null)} costPricePerKg={currentCostPerKg} />}
    </>
  );
}

function OrderModal({ purchase, onClose, costPricePerKg }: { purchase: Purchase, onClose: () => void, costPricePerKg: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [montoOC, setMontoOC] = useState(purchase.totalAmount > 0 ? String(purchase.totalAmount) : '');
  const [fecha, setFecha] = useState(toInputDate(purchase.date ?? Timestamp.now()) || '');
  
  // No products needed in this specific simplified logic, they are in the order if anything
  const monto = Number(montoOC) || 0;
  const kilosCalculados = monto / costPricePerKg;

  async function save() {
    if (!monto || monto <= 0) return toast('El monto debe ser mayor a 0', 'bad');
    setBusy(true);
    try {
      const d = fromInputDate(fecha) ?? new Date();
      await setDoc(doc(db, PATHS.purchases, purchase.id), {
        date: Timestamp.fromDate(d),
        provider: purchase.provider,
        expectedKilos: kilosCalculados,
        receivedKilos: purchase.receivedKilos ?? 0,
        pricePerKg: costPricePerKg,
        totalAmount: monto,
        paidAmount: purchase.paidAmount ?? 0,
        status: purchase.status ?? 'pedido',
        createdAt: purchase.createdAt ?? serverTimestamp(),
      }, { merge: true });
      
      await logAction('Sistema', purchase.createdAt ? 'Edición de Anticipo/OC a Andrés' : 'Nuevo Anticipo/OC a Andrés', {
        id: purchase.id,
        montoOC: monto
      });

      toast('Orden guardada correctamente', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm('¿Borrar esta orden?')) return;
    setBusy(true);
    try {
      await safeDeleteDoc(user?.email, doc(db, PATHS.purchases, purchase.id), purchase);
      toast('Borrada', 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={purchase.createdAt ? 'Editar Anticipo / OC' : 'Nueva Orden (Anticipo)'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Fecha">
          <input className="input boxed mono" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </Field>
        
        <Field label="Monto Anticipado / OC ($)">
          <input 
            className="input boxed mono" 
            type="number" 
            step="0.01" 
            value={montoOC} 
            onChange={(e) => setMontoOC(e.target.value)} 
            placeholder="Ej. 145000"
            style={{ fontSize: 20, padding: 12, width: '100%' }}
          />
        </Field>
        
        <div style={{ background: 'var(--bg-card)', padding: 16, borderRadius: 8, border: '1px dashed var(--border)' }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)' }}>
            💡 Con el costo actual de <strong>${costPricePerKg.toFixed(2)}/kg</strong>, este monto ampara automáticamente:
          </p>
          <div className="mono" style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--ok)', marginTop: 8 }}>
            {kilosCalculados > 0 ? kilosCalculados.toLocaleString('es-MX', { maximumFractionDigits: 2 }) : '0.00'} kg
          </div>
        </div>
      </div>
      
      <div className="modal-actions" style={{ marginTop: 24 }}>
        {purchase.createdAt && <button className="btn btn-danger" onClick={remove} disabled={busy}>Eliminar</button>}
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={save} disabled={busy || monto <= 0}>Guardar</button>
      </div>
    </Modal>
  );
}

function RegistrarEntregaModal({ order, onClose, costPricePerKg }: { order: PurchaseOrder, onClose: () => void, costPricePerKg: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [baselineUpdatedAt] = useState(() => order.updatedAt ?? null);
  const [existingDeliveries] = useState(() => migrateLegacyDeliveries(order, order.deliveries ?? []));
  const [nueva, setNueva] = useState(() => newDeliveryEvent(order.items ?? []));
  const { kilosEntregados } = computeDeliveredTotals(existingDeliveries);
  
  const kilosDeEsta = round2((nueva.items ?? []).reduce((a, x) => a + (Number(x.quantity) || 0), 0));
  const kilosPedidos = (order.items ?? []).reduce((a, x) => a + x.quantity, 0);

  function setQty(itemId: string, qty: number) {
    const nextList = updateDeliveryItemQuantity([nueva], 0, itemId, qty);
    setNueva(nextList[0]);
  }

  function setFecha(v: string) {
    const date = fromInputDate(v);
    const nextList = updateDeliveryField([nueva], 0, 'date', date ? Timestamp.fromDate(date) : null);
    setNueva(nextList[0]);
  }

  async function guardar() {
    if (kilosDeEsta <= 0) return toast('Captura al menos una cantidad mayor a cero.', 'bad');
    setBusy(true);
    try {
      const ref = doc(db, PATHS.orders, order.id);
      const nuevasDeliveries = [...existingDeliveries, nueva];
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const freshUpdatedAt = (snap.data().updatedAt as Timestamp | undefined) ?? null;
        if (baselineUpdatedAt && freshUpdatedAt && freshUpdatedAt.toMillis() !== baselineUpdatedAt.toMillis()) {
          throw new Error('Este expediente fue modificado. Ciérralo y vuelve a intentarlo.');
        }
        tx.set(ref, { deliveries: nuevasDeliveries, updatedAt: serverTimestamp() }, { merge: true });
      });
      
      const { kilosEntregados: totalEntregadoAhora } = computeDeliveredTotals(nuevasDeliveries);
      
      await upsertAndresPurchase({
        orderId: order.id,
        provider: order.provider || 'Andrés',
        expectedKilos: kilosPedidos,
        receivedKilos: totalEntregadoAhora,
        costPerKg: order.customCostPrice ?? costPricePerKg,
      });
      
      toast(`Entrega de ${kilosDeEsta} kg registrada.`, 'ok');
      onClose();
    } catch (e) {
      toast(`No se pudo registrar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Registrar Entrega — ${order.folio || '(sin folio)'}`} onClose={onClose}>
      <p className="hint">Entregado a la fecha: {kilosEntregados} kg de {kilosPedidos} kg pedidos</p>
      <Field label="Fecha de esta entrega">
        <input type="date" className="input boxed mono" defaultValue={toInputDate(nueva.date) || ''} onChange={e => setFecha(e.target.value)} />
      </Field>
      
      {(order.items ?? []).length === 0 ? <Empty>Este expediente no tiene productos capturados.</Empty> : (
        <table className="data-table" style={{ width: '100%', marginTop: 12 }}>
          <thead><tr><th>Producto</th><th className="num">Esta entrega (kg)</th></tr></thead>
          <tbody>
            {(order.items ?? []).map(it => {
              const qty = (nueva.items ?? []).find((x) => x.itemId === it.id)?.quantity ?? 0;
              return (
                <tr key={it.id}>
                  <td>{it.description || it.code}</td>
                  <td className="num">
                    <input className="input boxed mono" type="number" step="0.01" style={{ width: 100 }} defaultValue={qty || ''} placeholder="0" onBlur={e => setQty(it.id, Number(e.target.value))} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="modal-actions" style={{ marginTop: 16 }}>
        <button className="btn" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={busy || kilosDeEsta <= 0}>Guardar {kilosDeEsta} kg</button>
      </div>
    </Modal>
  );
}

function RegistrarPagoModal({ onClose, selectedProvider }: { onClose: () => void, selectedProvider: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('Pago / Adelanto');
  const [fecha, setFecha] = useState(toInputDate(Timestamp.now()) || '');

  async function guardar() {
    const amount = Number(monto);
    if (!amount || amount <= 0) return toast('Ingresa un monto válido.', 'bad');
    if (!concepto.trim()) return toast('El concepto es obligatorio.', 'bad');

    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.fromDate(fromInputDate(fecha) ?? new Date()),
        concept: concepto.trim(),
        amount,
        type: 'egreso', // Salida de dinero hacia el proveedor
        category: 'proveedores',
        provider: selectedProvider,
        createdAt: serverTimestamp(),
      });
      toast(`Pago de ${money(amount)} a ${selectedProvider} registrado en Caja.`, 'ok');
      onClose();
    } catch (e) {
      toast(`Error: ${(e as Error).message}`, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Registrar Pago a ${selectedProvider}`} onClose={onClose}>
      <p className="hint" style={{ marginBottom: 16 }}>Este pago se reflejará automáticamente en la <strong>Caja Chica</strong> como un egreso y abonará al saldo de {selectedProvider}.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Monto a pagar ($)"><input className="input boxed mono" type="number" step="0.01" value={monto} onChange={e => setMonto(e.target.value)} placeholder="0.00" /></Field>
        <Field label="Concepto"><input className="input boxed" type="text" value={concepto} onChange={e => setConcepto(e.target.value)} placeholder="Ej. Adelanto transferencia" /></Field>
        <Field label="Fecha"><input className="input boxed mono" type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={busy}>Registrar Pago</button></div>
    </Modal>
  );
}

function AjusteModal({ onClose, selectedProvider }: { onClose: () => void, selectedProvider: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [monto, setMonto] = useState('');
  const [tipo, setTipo] = useState<'favor'|'contra'>('favor');
  const [concepto, setConcepto] = useState('Ajuste de conciliación');

  async function guardar() {
    const amount = Number(monto);
    if (!amount || amount <= 0) return toast('Monto inválido', 'bad');
    setBusy(true);
    try {
      await addDoc(collection(db, PATHS.expenses), {
        date: Timestamp.now(),
        concept: `[AJUSTE] ${concepto.trim()}`,
        amount,
        type: tipo === 'favor' ? 'ingreso' : 'egreso', // Ingreso virtual baja la deuda (a favor nuestro).
        category: 'ajuste',
        provider: selectedProvider,
        createdAt: serverTimestamp(),
      });
      toast('Ajuste registrado con éxito', 'ok');
      onClose();
    } catch {
      toast('Error al guardar el ajuste', 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Ajuste de Saldo Manual" onClose={onClose}>
      <p className="hint" style={{ marginBottom: 16 }}>Inyecta un movimiento de conciliación para cuadrar el saldo por diferencias, mermas o devoluciones.</p>
      <div style={{ display: 'grid', gap: 12 }}>
        <Field label="Tipo de Ajuste">
          <select className="input boxed" value={tipo} onChange={e => setTipo(e.target.value as 'favor'|'contra')}>
            <option value="favor">A nuestro favor (Baja nuestra deuda con el proveedor)</option>
            <option value="contra">En contra (Sube nuestra deuda con el proveedor)</option>
          </select>
        </Field>
        <Field label="Monto del Ajuste ($)"><input className="input boxed mono" type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej. 3500" /></Field>
        <Field label="Justificación"><input className="input boxed" value={concepto} onChange={e => setConcepto(e.target.value)} /></Field>
      </div>
      <div className="modal-actions" style={{ marginTop: 24 }}><button className="btn" onClick={onClose} disabled={busy}>Cancelar</button><button className="btn btn-primary" onClick={guardar} disabled={busy}>Guardar Ajuste</button></div>
    </Modal>
  );
}
