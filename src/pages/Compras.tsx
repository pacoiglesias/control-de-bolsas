import { useState, useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAndresStats } from '../hooks/useAndresStats';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useToast } from '../context/ToastContext';
import { ComprasKpiGrid } from '../components/Compras/ComprasKpiGrid';
import { PagarAndresModal } from '../components/Compras/PagarAndresModal';
import { AndresLedgerTable } from '../components/Compras/AndresLedgerTable';
import { PurchaseDrawer } from '../components/Compras/PurchaseDrawer';
import { RegistrarEntregaModal, AjusteModal } from '../components/Compras/OrderModals';
import { ComprasKanban } from '../components/Compras/ComprasKanban';
import { exportToCsv, getPrintHeaderHtml, fmtDate, nombreClienteVisible } from '../lib/format';
import { Skeleton, Empty, Card } from '../components/ui';
import { generateAndresAuditStatementPdf } from '../lib/andresStatementPdf';
import type { Purchase, PurchaseOrder } from '../lib/types';
import { money } from '../lib/format';
import { doc, setDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { triggerHaptic } from '../lib/hapticEngine';
import { promptDialog } from '../lib/promptDialog';
import { generateAndresWhatsAppSummary, openWhatsAppMessage } from '../lib/whatsappReminder';

export default function Compras() {
  const { role } = useAuth();
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';
  const toast = useToast();
  
  const selectedProvider = 'Andres';
  const {
    loading,
    error,
    stats: { totalReceivedKilos, totalPurchasesCost, totalPagado, saldoProveedor, ledger },
    entregasAtrasadas,
    currentCostPerKg,
    provPurchases,
    orderById,
    deudaHistorica,
  } = useAndresStats(selectedProvider);

  const [selected, setSelected] = useState<Purchase | null>(null);
  const [deliveryOrder, setDeliveryOrder] = useState<PurchaseOrder | null>(null);
  const [pagarModalAmount, setPagarModalAmount] = useState<number | null>(null);
  const [ajusteModal, setAjusteModal] = useState(false);
  const [tab, setTab] = useState<'estado' | 'ordenes' | 'revision'>('estado');
  const [filter, setFilter] = useState<'activas'|'completadas'|'todas'>('activas');
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'lista' | 'tablero'>('lista');
  const [params, setParams] = useSearchParams();

  // Vinculo cruzado Andres <-> Providencia (2026-08-11): permite abrir la
  // compra ligada a un expediente especifico desde fuera de esta pantalla
  // (el boton "Ver compra en Andrés" del expediente en Órdenes) sin tener
  // que buscarla a mano en la lista.
  useEffect(() => {
    const abrirId = params.get('abrir');
    if (!abrirId || provPurchases.length === 0) return;
    const found = provPurchases.find((p) => p.id === abrirId);
    if (found) {
      setTab('ordenes');
      setSelected(found);
      const newParams = new URLSearchParams(params);
      newParams.delete('abrir');
      setParams(newParams, { replace: true });
    }
  }, [params, provPurchases, setParams]);

  if (error) return <div className="alert bad">{error}</div>;
  if (!loading && role !== 'admin') return <Navigate to="/" replace />;
  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Skeleton style={{ height: 100 }} />
      <Skeleton style={{ height: 100 }} />
      <Skeleton style={{ height: 100 }} />
    </div>
  );

  // Ledger calc for printing & rendering
  // ANTES: `const deudaHistorica = 0` fijo aqui, ignorando el ajuste
  // historico real configurado (-$123,175.56). El saldo principal (arriba)
  // SI lo usaba via useAndresStats(), pero esta tabla de movimientos
  // arrancaba su acumulado en $0 — cada renglon quedaba desfasado por el
  // monto completo del ajuste historico, sin coincidir con el numero
  // principal de la pantalla.
  // El libro mayor (ledger) ya viene ordenado y con su balance acumulado calculado cronológicamente
  const ledgerWithBalance = ledger;

  function exportComprasCsv() {
    const headers = ['Fecha', 'Concepto', 'Cargo (Deuda)', 'Abono (Pago)', 'Origen'];
    const rows = ledger.map(e => [
      fmtDate(e.date),
      e.concept,
      e.cargo ? e.cargo.toFixed(2) : '0.00',
      e.abono ? e.abono.toFixed(2) : '0.00',
      e.source === 'purchase' ? 'Material' : 'Pago'
    ]);
    exportToCsv(`Estado_Cuenta_${provName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('✅ Excel exportado', 'ok');
  }

  function printComprasReport() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Estado de Cuenta - ${provName}</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 32px; font-size: 12px; border: 1px solid #ccc; }
            th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ccc; }
            th { background: #eee; font-weight: bold; }
            .num { text-align: right; font-family: monospace; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Estado de Cuenta Proveedor")}
          <div style="display: flex; gap: 20px; margin-bottom: 20px;">
            <div>Total Pagado: $${totalPagado.toFixed(2)}</div>
            <div>Total Entregado: $${totalPurchasesCost.toFixed(2)}</div>
            <div><strong>Saldo Actual: ${saldoProveedor < 0 ? '-' : '+'}$${Math.abs(saldoProveedor).toFixed(2)}</strong></div>
          </div>
          <table>
            <thead><tr><th>Fecha</th><th>Concepto</th><th class="num">Cargo</th><th class="num">Abono</th><th class="num">Balance</th></tr></thead>
            <tbody>
              ${ledgerWithBalance.map(e => `
                <tr>
                  <td>${fmtDate(e.date) || '-'}</td>
                  <td>${e.concept || '-'}</td>
                  <td class="num">${e.cargo ? e.cargo.toFixed(2) : '-'}</td>
                  <td class="num">${e.abono ? e.abono.toFixed(2) : '-'}</td>
                  <td class="num">${e.balance.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onafterprint = () => window.close();
            window.onload = () => window.print();
          </script>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
  }

  async function handleCalibrateSaldo() {
    const inputStr = await promptDialog({
      title: '🔧 Calibrar Saldo con Andrés',
      message: `¿Cuál es el saldo real actual con Andrés en tus registros?\n\n` +
               `- Ingresa un valor POSITIVO (ej. 227628.94) si Andrés tiene saldo a favor por anticipos.\n` +
               `- Ingresa un valor NEGATIVO si la empresa le debe a Andrés.\n\n` +
               `Saldo calculado actual en sistema: ${money(saldoProveedor)}`,
      defaultValue: '',
      placeholder: 'Ej. 40800.00'
    });
    if (inputStr === null) return;
    const realBalance = parseFloat(inputStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(realBalance)) {
      toast('❌ Por favor ingresa un número válido.', 'bad');
      return;
    }

    try {
      const diff = realBalance - (totalPagado - totalPurchasesCost);
      await setDoc(doc(db, PATHS.config, 'financials'), { historicalDebtAndres: diff }, { merge: true });
      triggerHaptic('success');
      toast(`✅ Saldo calibrado con éxito. Nueva deuda histórica ajustada a ${money(diff)}.`, 'ok');
    } catch (e) {
      toast(`❌ Error al calibrar: ${(e as Error).message}`, 'bad');
    }
  }

  function handleSendWhatsApp() {
    const msg = generateAndresWhatsAppSummary({
      providerName: provName,
      totalPagado,
      totalPurchasesCost,
      totalReceivedKilos,
      saldoProveedor,
      costPricePerKg: currentCostPerKg,
    });
    openWhatsAppMessage(msg);
    triggerHaptic('success');
    toast(`📲 Abriendo WhatsApp con el Estado de Cuenta de ${provName}`, 'ok');
  }

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Módulo de Compras & Cuenta Corriente con {provName}</h1>
          <p>Control de anticipos, entregas en báscula, costo de compra y estado de cuenta con el proveedor ({provName}).</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => void handleCalibrateSaldo()} style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700 }}>🔧 Calibrar Saldo</button>
          <button className="btn" onClick={handleSendWhatsApp} style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', fontWeight: 700 }}>📲 Enviar WhatsApp</button>
          <button className="btn" onClick={() => setAjusteModal(true)}>⚖️ Ajuste Manual</button>
          <button className="btn" onClick={() => setSelected({} as Purchase)}>➕ Nuevo Anticipo / OC</button>
        </div>
      </div>

      <ComprasKpiGrid 
        totalReceivedKilos={totalReceivedKilos}
        saldoProveedor={saldoProveedor}
        entregasAtrasadasCount={entregasAtrasadas.length}
        onPayAtrasadas={() => { setTab('ordenes'); setFilter('activas'); }}
        onPayDebt={(amount) => setPagarModalAmount(amount || 0.01)}
      />

      <div className="tabs" style={{ marginBottom: 24, display: 'flex', gap: 8, borderBottom: '1px solid var(--line-soft)', paddingBottom: 12 }}>
        <button className={`btn ${tab === 'estado' ? 'btn-primary' : ''}`} onClick={() => setTab('estado')}>⚖️ Libro Mayor y Pagos</button>
        <button className={`btn ${tab === 'ordenes' ? 'btn-primary' : ''}`} onClick={() => setTab('ordenes')}>📦 Órdenes de Compra</button>
      </div>

      {tab === 'estado' && (
        <Card 
          title="Libro Mayor Cronológico" 
          actions={
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-icon"
                onClick={async () => {
                  toast('📄 Generando Estado de Cuenta y Entregas Auditado...', 'info');
                  const deliveriesList = provPurchases.map(p => {
                    const ord = orderById.get(p.id);
                    const orderedKg = p.expectedKilos || Number(ord?.totalKilograms) || 0;
                    const receivedKg = p.receivedKilos || 0;
                    const costKg = p.pricePerKg || currentCostPerKg || 42;
                    return {
                      folio: ord?.folio || ord?.oc || p.id,
                      client: ord?.client ? nombreClienteVisible(ord.client) : 'Providencia',
                      orderedKg,
                      receivedKg,
                      costPerKg: costKg,
                      totalCost: receivedKg * costKg,
                      status: p.status || 'pedido',
                      deliveryDate: p.date,
                    };
                  });

                  await generateAndresAuditStatementPdf({
                    totalReceivedKilos,
                    totalPurchasesCost,
                    totalPagado,
                    saldoProveedor,
                    deudaHistorica,
                    currentCostPerKg,
                    ledger: ledgerWithBalance as any,
                    deliveriesList,
                  });
                  toast('✅ Estado de cuenta y entregas PDF generado', 'ok');
                }}
                title="Generar Estado de Cuenta Oficial con Detalle de Entregas en PDF"
                style={{ background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 700 }}
              >
                📄 PDF Auditado
              </button>
              <button className="btn btn-icon" onClick={exportComprasCsv} title="Descargar CSV">📊 CSV</button>
              <button className="btn btn-icon" onClick={printComprasReport} title="Imprimir Reporte">🖨️ Imprimir</button>
            </div>
          }
        >
          <AndresLedgerTable ledgerWithBalance={ledgerWithBalance} deudaHistorica={deudaHistorica} />
        </Card>
      )}

      {tab === 'ordenes' && (
        <Card title="Control de Órdenes (OC)">
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16, justifyContent: 'space-between' }}>
              <div className="chip-row">
                <button 
                  className={`chip ${filter === 'todas' ? 'active' : ''}`}
                  onClick={() => setFilter('todas')}
                >
                  Todas
                </button>
                <button 
                  className={`chip ${filter === 'activas' ? 'active' : ''}`}
                  onClick={() => setFilter('activas')}
                >
                  🔴 Pendientes
                </button>
                <button 
                  className={`chip ${filter === 'completadas' ? 'active' : ''}`}
                  onClick={() => setFilter('completadas')}
                >
                  ✅ Completadas
                </button>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input 
                  className="search-input" 
                  placeholder="Buscar proveedor o referencia..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  style={{ maxWidth: 300 }}
                />
                <button className={`btn ${view === 'lista' ? 'btn-primary' : ''}`} onClick={() => setView('lista')}>☰ Lista</button>
                <button className={`btn ${view === 'tablero' ? 'btn-primary' : ''}`} onClick={() => setView('tablero')}>🗂️ Tablero</button>
              </div>
            </div>
          {view === 'tablero' ? (
            <ComprasKanban purchases={provPurchases} orderById={orderById} onSelect={setSelected} />
          ) : provPurchases.length === 0 ? <Empty>No hay órdenes registradas.</Empty> : (() => {
            // ANTES: `search` y `filter` existian como controles visuales
            // pero nunca se aplicaban a la lista — cambiarlos no hacia
            // absolutamente nada. Se corrigen aqui, al mismo tiempo que se
            // convierte la tabla en tarjetas.
            const q = search.trim().toLowerCase();
            const visibles = provPurchases.filter((p) => {
              const o = orderById.get(p.id);
              const faltan = (p.expectedKilos ?? 0) - (p.receivedKilos ?? 0);
              if (filter === 'activas' && faltan <= 0.01) return false;
              if (filter === 'completadas' && faltan > 0.01) return false;
              if (q && !(o?.folio ?? '').toLowerCase().includes(q) && !(o?.client ?? '').toLowerCase().includes(q)) return false;
              return true;
            });
            if (visibles.length === 0) return <Empty>Sin resultados para este filtro/búsqueda.</Empty>;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                {visibles.map((p) => {
                  const o = orderById.get(p.id);
                  const pedidos = p.expectedKilos ?? 0;
                  const recibidos = p.receivedKilos ?? 0;
                  const pct = pedidos > 0 ? Math.min(100, Math.round((recibidos / pedidos) * 100)) : 0;
                  const completo = pedidos > 0 && recibidos >= pedidos - 0.01;
                  return (
                    <div
                      key={p.id}
                      className="clickable"
                      onClick={() => setSelected(p)}
                      style={{
                        border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: 16,
                        background: 'var(--paper)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{o?.folio || 'S/F'}</div>
                          <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{o?.client || '—'}</div>
                        </div>
                        <span className="badge" style={{ background: completo ? 'var(--ok)' : 'var(--warn)' }}>{completo ? '✅ Completa' : '⏳ Activa'}</span>
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>
                          <span>{recibidos.toFixed(2)} de {pedidos.toFixed(2)} kg</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ width: '100%', height: 8, background: 'var(--bg-inset)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: completo ? 'var(--ok)' : 'var(--accent)' }} />
                        </div>
                      </div>

                      <div className="mono num" style={{ fontSize: 18, fontWeight: 700 }}>
                        ${p.totalAmount?.toFixed(2) || '0.00'}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ink-soft)' }}> anticipo/costo</span>
                      </div>

                      {o && (
                        <button
                          className="btn btn-primary"
                          style={{ marginTop: 4 }}
                          onClick={(e) => { e.stopPropagation(); setDeliveryOrder(o); }}
                        >
                          📦 Recibir Kilos Rápidos
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </Card>
      )}

      {selected && (
        <PurchaseDrawer 
          purchase={selected} 
          folio={orderById.get(selected.id)?.folio} 
          onClose={() => setSelected(null)} 
        />
      )}
      {pagarModalAmount !== null && <PagarAndresModal initialAmount={pagarModalAmount} onClose={() => setPagarModalAmount(null)} />}
      {ajusteModal && <AjusteModal selectedProvider={selectedProvider} onClose={() => setAjusteModal(false)} />}
      {deliveryOrder && <RegistrarEntregaModal order={deliveryOrder} onClose={() => setDeliveryOrder(null)} costPricePerKg={currentCostPerKg} />}
    </>
  );
}
