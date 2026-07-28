import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { db, PATHS } from '../lib/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, Empty, Spinner, StatusBadge } from '../components/ui';
import OrderModal from './OrderModal';
import { fmtDate, kilos, money, toDate } from '../lib/format';
import { daysLate } from '../lib/finance';
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
  const { config } = useConfig();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  const filter = (params.get('filtro') as 'all' | OrderStatus) ?? 'all';

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
      const s = o.creditCycle?.status ?? 'pending';
      c[s] = (c[s] ?? 0) + 1;
    });
    return c;
  }, [orders]);

  const totals = useMemo(
    () => ({
      kilos: rows.reduce((a, o) => a + (o.totalKilograms ?? 0), 0),
      venta: rows.reduce((a, o) => a + (o.financials?.saleTotal ?? 0), 0),
      comision: rows.reduce((a, o) => a + (o.financials?.commission ?? 0), 0),
      neto: rows.reduce((a, o) => a + (o.financials?.netCashFlow ?? 0), 0),
    }),
    [rows],
  );

  function exportCSV() {
    const head = ['Folio','Cliente','Archivo','Kilos','Venta','Costo','Comision','Neto','Emision','Vence','Estado','Contrarecibo','Cobrado'];
    const lines = rows.map((o) => [
      o.folio ?? '', o.client ?? '', o.fileName ?? '', o.totalKilograms ?? 0,
      o.financials?.saleTotal ?? 0, o.financials?.costTotal ?? 0,
      o.financials?.commission ?? 0, o.financials?.netCashFlow ?? 0,
      fmtDate(o.creditCycle?.issueDate), fmtDate(o.creditCycle?.dueDate),
      o.creditCycle?.status ?? '', o.collection?.contrareciboNumber ?? '',
      o.collection?.paidAmount ?? 0,
    ]);
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
            <button className="btn btn-primary" onClick={() => setSelected({
              id: doc(collection(db, PATHS.orders)).id,
              creditCycle: { status: 'pedido' }
            } as PurchaseOrder)}>
              + Nuevo Pedido
            </button>
            <span className="spacer" />
            <button className="btn" onClick={exportCSV}>⭳ CSV</button>
            <button className="btn" onClick={() => window.print()}>🖨 Imprimir</button>
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
                  <th>Folio</th><th>Cliente</th><th>Depto.</th><th>Prov.</th><th className="num">Kilos</th>
                  <th className="num">Venta</th><th className="num">Comisión</th>
                  <th className="num">Neto</th><th>Emisión</th><th>Vence</th>
                  <th className="num">Días</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const st = o.creditCycle?.status ?? 'pending';
                  const d = st === 'paid' ? null : daysLate(toDate(o.creditCycle?.dueDate));
                  return (
                    <tr
                      key={o.id}
                      className={st === 'overdue' ? 'row-bad' : st === 'manual_review' ? 'row-warn' : st === 'paid' ? 'row-done' : ''}
                      onClick={() => setSelected(o)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono">{o.folio ?? <span className="hint">sin folio</span>}</td>
                      <td>{o.client ?? '—'}</td>
                      <td>{o.department ?? '—'}</td>
                      <td>{o.provider ?? '—'}</td>
                      <td className="num mono">{o.totalKilograms ? kilos(o.totalKilograms) : '—'}</td>
                      <td className="num mono">{money(o.financials?.saleTotal)}</td>
                      <td className="num mono">{money(o.financials?.commission)}</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{money(o.financials?.netCashFlow)}</td>
                      <td className="mono">{fmtDate(o.creditCycle?.issueDate)}</td>
                      <td className="mono">{fmtDate(o.creditCycle?.dueDate)}</td>
                      <td className="num mono">{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                      <td><StatusBadge status={st} /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>Totales de la vista</td>
                  <td className="num">{kilos(totals.kilos)}</td>
                  <td className="num">{money(totals.venta)}</td>
                  <td className="num">{money(totals.comision)}</td>
                  <td className="num">{money(totals.neto)}</td>
                  <td colSpan={4} />
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
        />
      )}
    </>
  );
}
