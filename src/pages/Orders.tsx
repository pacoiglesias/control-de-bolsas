import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../context/AuthContext';
import { db, PATHS } from '../lib/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, Empty, Spinner, StatusBadge } from '../components/ui';
import OrderModal from './OrderModal';
import { kilos, money } from '../lib/format';
import { getOrderSummary } from '../lib/finance';
import type { OrderStatus, PurchaseOrder } from '../lib/types';

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'pedido', label: 'Pedidos' },
  { key: 'facturado', label: 'Facturado' },
  { key: 'pending', label: 'Con CR' },
  { key: 'overdue', label: 'Vencidas' },
  { key: 'paid', label: 'Cobradas' },
  { key: 'manual_review', label: 'Revisión' },
];

export default function Orders() {
  const { orders, loading, error } = useOrders();
  const { role } = useAuth();
  const { config } = useConfig();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  useEffect(() => {
    const q = params.get('q');
    if (q !== null && q !== search) setSearch(q);
  }, [params, search]);

  const filter = (params.get('filtro') as 'all' | OrderStatus) ?? 'all';

  useEffect(() => {
    if (params.get('nueva') === '1') {
      setSelected({
        id: doc(collection(db, PATHS.orders)).id,
        creditCycle: { status: 'pedido' }
      } as PurchaseOrder);
      const newParams = new URLSearchParams(params);
      newParams.delete('nueva');
      setParams(newParams, { replace: true });
    }
  }, [params, setParams]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.creditCycle?.status !== filter) return false;
      if (!q) return true;
      return [o.folio, o.client, o.fileName, o.collection?.contrareciboNumber, String(o.totalKilograms ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      const summary = getOrderSummary(o);
      const s = summary.status;
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [orders]);

  const totals = useMemo(
    () => ({
      kilos: rows.reduce((a, o) => a + (o.totalKilograms ?? 0), 0),
      kilosEntregados: rows.reduce((a, o) => a + getOrderSummary(o).kilosDelivered, 0),
      kilosPendientes: rows.reduce((a, o) => a + Math.max(0, (o.totalKilograms ?? 0) - getOrderSummary(o).kilosDelivered), 0),
      kilosFacturados: rows.reduce((a, o) => a + getOrderSummary(o).kilosInvoiced, 0),
      venta: rows.reduce((a, o) => a + getOrderSummary(o).saleTotal, 0),
      cobrado: rows.reduce((a, o) => a + getOrderSummary(o).paidAmount, 0),
      comision: rows.reduce((a, o) => a + getOrderSummary(o).commission, 0),
      neto: rows.reduce((a, o) => a + getOrderSummary(o).netCashFlow, 0),
    }),
    [rows],
  );

  function exportCSV() {
    const head = ['Folio','Cliente','Archivo','Kilos Pedidos','Kilos Entregados','Kilos Facturados','Venta','Costo','Comision','Neto','Estado','Cobrado','Deuda'];
    const lines = rows.map((o) => {
      const summary = getOrderSummary(o);
      return [
        o.folio ?? '', o.client ?? '', o.fileName ?? '', o.totalKilograms ?? 0,
        summary.kilosDelivered, summary.kilosInvoiced,
        summary.saleTotal, 0, // Costo total might not be easily available if aggregated, but we can compute it if needed. Let's just put 0 or compute it inside finance.ts. Wait, we don't track aggregated costTotal yet. Let's keep it as 0 for now.
        summary.commission, summary.netCashFlow,
        summary.status, summary.paidAmount,
        summary.saleTotal - summary.paidAmount,
      ];
    });
    const csv = [head, ...lines]
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <Spinner />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Órdenes</h1>
        <p>
          Tabla en vivo de <code>purchaseOrders</code>. Haz clic en cualquier renglón para abrir la
          ficha, corregir datos o registrar el cobro.
        </p>
      </div>

      <Card
        actions={
          <>
            {role !== 'viewer' && (
              <>
                <button className="btn btn-primary" onClick={() => setSelected({
                  id: doc(collection(db, PATHS.orders)).id,
                  creditCycle: { status: 'pedido' }
                } as PurchaseOrder)}>
                  + Nuevo Pedido
                </button>
                <span className="spacer" />
                <button className="btn no-print" onClick={exportCSV}>⭳ CSV</button>
              </>
            )}
            {role === 'viewer' && <span className="spacer" />}
            <button className="btn no-print" onClick={() => window.print()}>🖨️ Imprimir</button>
          </>
        }
        title="Listado"
        hint={`${rows.length} de ${orders.length}`}
      >
        <div className="card-head no-print">
          <div className="chip-row">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                className={`chip ${filter === f.key ? 'active' : ''}`}
                onClick={() => setParams(f.key === 'all' ? {} : { filtro: f.key })}
              >
                {f.label} ({counts[f.key] ?? 0})
              </button>
            ))}
          </div>
          <span className="spacer" />
          <input
            className="search-input"
            type="search"
            placeholder="Buscar folio, cliente, archivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {rows.length === 0 ? (
          <Empty>No hay órdenes en este filtro.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expediente</th><th>Cliente</th><th>Prov.</th>
                  <th className="num">Kilos Pedidos</th><th className="num">Kilos Entregados</th><th className="num">Kilos Pendientes</th><th className="num">Kilos Facturados</th>
                  <th className="num">Venta Acum.</th><th className="num">Cobrado</th>
                  <th className="num">Deuda Restante</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const summary = getOrderSummary(o);
                  const st = summary.status;
                  const deuda = summary.invoiceTotal - summary.paidAmount;
                  return (
                    <tr
                      key={o.id}
                      className={st === 'overdue' ? 'row-bad' : st === 'manual_review' ? 'row-warn' : st === 'paid' ? 'row-done' : ''}
                      onClick={() => setSelected(o)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono">{o.folio ?? <span className="hint">#{o.id.slice(0, 6)}</span>}</td>
                      <td>{o.client ?? '—'}</td>
                      <td>{o.provider ?? '—'}</td>
                      <td className="num mono">{o.totalKilograms ? kilos(o.totalKilograms) : '—'}</td>
                      <td className="num mono">{summary.kilosDelivered > 0 ? kilos(summary.kilosDelivered) : '—'}</td>
                      <td className="num mono" style={{ color: (o.totalKilograms ?? 0) - summary.kilosDelivered > 0 ? 'var(--bad)' : 'inherit' }}>
                        {((o.totalKilograms ?? 0) - summary.kilosDelivered > 0) ? kilos((o.totalKilograms ?? 0) - summary.kilosDelivered) : '—'}
                      </td>
                      <td className="num mono">{summary.kilosInvoiced > 0 ? kilos(summary.kilosInvoiced) : '—'}</td>
                      <td className="num mono">{money(summary.saleTotal)}</td>
                      <td className="num mono">{money(summary.paidAmount)}</td>
                      <td className="num mono" style={{ color: deuda > 0 ? 'var(--bad)' : 'inherit' }}>{money(deuda)}</td>
                      <td>
                        <StatusBadge status={st} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Totales de la vista</td>
                  <td className="num">{kilos(totals.kilos)}</td>
                  <td className="num">{kilos(totals.kilosEntregados)}</td>
                  <td className="num">{kilos(totals.kilosPendientes)}</td>
                  <td className="num">{kilos(totals.kilosFacturados)}</td>
                  <td className="num">{money(totals.venta)}</td>
                  <td className="num">{money(totals.cobrado)}</td>
                  <td className="num">{money(totals.venta - totals.cobrado)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => setSelected(null)}
          readOnly={role === 'viewer'}
        />
      )}
    </>
  );
}
