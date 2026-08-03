import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAndresStats } from '../hooks/useAndresStats';
import { useSystemSettings } from '../hooks/useSystemSettings';
import { useToast } from '../context/ToastContext';
import { ComprasKpiGrid } from '../components/Compras/ComprasKpiGrid';
import { PagarAndresModal } from '../components/Compras/PagarAndresModal';
import { AndresLedgerTable } from '../components/Compras/AndresLedgerTable';
import { OrderModal, RegistrarEntregaModal, AjusteModal } from '../components/Compras/OrderModals';
import { exportToCsv, getPrintHeaderHtml, fmtDate } from '../lib/format';
import { Skeleton, Empty, Card } from '../components/ui';
import type { Purchase, PurchaseOrder } from '../lib/types';

export default function Compras() {
  const { role } = useAuth();
  const { settings } = useSystemSettings();
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
  let currentBalance = deudaHistorica;
  const ledgerWithBalance = ledger.map(e => {
    currentBalance += (e.cargo - e.abono);
    return { ...e, balance: currentBalance };
  });

  function exportComprasCsv() {
    const headers = ['Fecha', 'Concepto', 'Cargo (Deuda)', 'Abono (Pago)', 'Origen'];
    const rows = ledger.map(e => [
      fmtDate(e.date),
      e.concept,
      e.cargo ? e.cargo.toFixed(2) : '0.00',
      e.abono ? e.abono.toFixed(2) : '0.00',
      e.source === 'purchase' ? 'Material' : 'Pago'
    ]);
    exportToCsv(`Estado_Cuenta_Andres_${new Date().toISOString().slice(0, 10)}`, headers, rows);
    toast('✅ Excel exportado', 'ok');
  }

  function printComprasReport() {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Estado de Cuenta - Andrés</title>
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

  return (
    <>
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1>Módulo de Compras</h1>
          <p>Control de anticipos, inventario en tránsito y estado de cuenta con el fabricante.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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
              <button className="btn btn-icon" onClick={exportComprasCsv} title="Descargar CSV">📊 CSV</button>
              <button className="btn btn-icon" onClick={printComprasReport} title="Imprimir Reporte">🖨️ PDF</button>
            </div>
          }
        >
          <AndresLedgerTable ledgerWithBalance={ledgerWithBalance} deudaHistorica={deudaHistorica} />
        </Card>
      )}

      {tab === 'ordenes' && (
        <Card title="Control de Órdenes (OC)">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input 
              type="search" 
              className="input boxed" 
              placeholder="Buscar por folio o concepto..." 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              style={{ maxWidth: 300 }}
            />
            <select className="input boxed" value={filter} onChange={e => setFilter(e.target.value as 'activas'|'completadas'|'todas')}>
              <option value="activas">Solo Activas (Pendientes de llegar)</option>
              <option value="completadas">Solo Completadas (Llegó el 100%)</option>
              <option value="todas">Mostrar Todas</option>
            </select>
          </div>
          {provPurchases.length === 0 ? <Empty>No hay órdenes registradas.</Empty> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Folio OC</th><th>Anticipo</th><th>Kg Pedidos</th><th>Kg Recibidos</th><th>Estado</th></tr></thead>
                <tbody>
                  {provPurchases.map(p => {
                    const o = orderById.get(p.id);
                    return (
                      <tr key={p.id} className="clickable" onClick={() => setSelected(p)}>
                        <td className="mono">{o?.folio || 'S/F'}</td>
                        <td className="mono num">${p.totalAmount?.toFixed(2) || '0.00'}</td>
                        <td className="mono num">{p.expectedKilos?.toFixed(2) || '0.00'}</td>
                        <td className="mono num">{p.receivedKilos?.toFixed(2) || '0.00'}</td>
                        <td>
                          {o ? <button className="btn" onClick={(e) => { e.stopPropagation(); setDeliveryOrder(o); }}>🚚 Registrar Entrega</button> : '-'}
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

      {selected && <OrderModal purchase={selected} onClose={() => setSelected(null)} costPricePerKg={currentCostPerKg} />}
      {pagarModalAmount !== null && <PagarAndresModal initialAmount={pagarModalAmount} onClose={() => setPagarModalAmount(null)} />}
      {ajusteModal && <AjusteModal selectedProvider={selectedProvider} onClose={() => setAjusteModal(false)} />}
      {deliveryOrder && <RegistrarEntregaModal order={deliveryOrder} onClose={() => setDeliveryOrder(null)} costPricePerKg={currentCostPerKg} />}
    </>
  );
}
