import { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../context/AuthContext';
import { db, PATHS } from '../lib/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, Empty, StatusBadge, Skeleton } from '../components/ui';
import OrderModal from './OrderModal';
import { kilos, money } from '../lib/format';
import { getOrderSummary } from '../lib/finance';
import type { OrderStatus, PurchaseOrder } from '../lib/types';

const FILTERS: { key: 'all' | OrderStatus; label: string }[] = [
  { key: 'all', label: 'Todas' },
  // "pedido" es el expediente sin ninguna factura creada todavia: es
  // literalmente "lo que falta por facturar". Se llamaba "Pedidos", que no
  // decia nada de eso.
  { key: 'pedido', label: '📝 Pendiente de Facturar' },
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
  
  const [page, setPage] = useState(1);
  const pageSize = 50;

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

  // El resumen de cada expediente se calcula UNA vez y se reutiliza en el
  // filtro, en los contadores, en la tabla y en los totales. Antes
  // getOrderSummary corria ~10 veces por renglon en cada tecla escrita.
  const conResumen = useMemo(
    () => orders.map((o) => ({ o, s: getOrderSummary(o) })),
    [orders],
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conResumen.filter(({ o, s }) => {
      // El estatus sale del resumen, igual que el contador del chip y que la
      // columna Estado. Antes el filtro leia o.creditCycle.status (el campo
      // viejo de la raiz): el chip decia "Vencidas (5)" y la tabla salia vacia.
      if (filter !== 'all' && s.status !== filter) return false;
      if (!q) return true;
      return [o.folio, o.client, o.fileName, o.collection?.contrareciboNumber, String(o.totalKilograms ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [conResumen, filter, search]);

  const paginatedRows = useMemo(() => {
    return rows.slice((page - 1) * pageSize, page * pageSize);
  }, [rows, page]);

  // Resetear página al cambiar filtro o búsqueda
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: conResumen.length };
    conResumen.forEach(({ s }) => {
      c[s.status] = (c[s.status] ?? 0) + 1;
    });
    return c;
  }, [conResumen]);

  const totals = useMemo(() => {
    const t = {
      kilos: 0, kilosEntregados: 0, kilosPendientes: 0, kilosFacturados: 0,
      venta: 0, cobrado: 0, comision: 0, neto: 0, deuda: 0,
    };
    for (const { o, s } of rows) {
      const pedidos = o.totalKilograms ?? 0;
      t.kilos += pedidos;
      t.kilosEntregados += s.kilosDelivered;
      t.kilosPendientes += Math.max(0, pedidos - s.kilosDelivered);
      t.kilosFacturados += s.kilosInvoiced;
      t.venta += s.invoiceTotal;
      t.cobrado += s.paidAmount;
      t.comision += s.commission;
      t.neto += s.netCashFlow;
      // La deuda se mide contra el total facturado con IVA, que es lo que el
      // cliente debe. Asi el pie de tabla suma exactamente la columna.
      t.deuda += s.invoiceTotal - s.paidAmount;
    }
    return t;
  }, [rows]);

  function exportCSV() {
    // Excel ejecuta como formula cualquier celda que empiece con = + - @. Los
    // nombres de cliente los extrae la IA de PDFs de terceros, asi que se
    // neutralizan antes de escribir el archivo.
    const seguro = (v: unknown) => {
      const txt = String(v ?? '');
      return /^[=+\-@\t\r]/.test(txt) ? `'${txt}` : txt;
    };
    const head = ['Folio','Cliente','Archivo','Kilos Pedidos','Kilos Entregados','Kilos Facturados','Subtotal','Facturado c/IVA','Comision','Neto','Estado','Cobrado','Deuda'];
    const lines = rows.map(({ o, s: summary }) => [
      o.folio ?? '', o.client ?? '', o.fileName ?? '', o.totalKilograms ?? 0,
      summary.kilosDelivered, summary.kilosInvoiced,
      summary.saleTotal, summary.invoiceTotal,
      summary.commission, summary.netCashFlow,
      summary.status, summary.paidAmount,
      summary.invoiceTotal - summary.paidAmount,
    ]);
    const csv = [head, ...lines]
      .map((l) => l.map((c) => `"${seguro(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordenes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <>
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 200, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: 300, height: 16 }} />
        </div>
        <Card>
          <div style={{ padding: 20 }}>
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 48, marginBottom: 8 }} />)}
          </div>
        </Card>
      </>
    );
  }
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Expedientes</h1>
        <p>
          Una fila por expediente, con filtros por estatus de cobro. Haz clic en cualquier renglón
          para abrir la ficha, corregir datos o registrar el cobro. ¿Buscas ver el avance de una
          Orden de Compra con todas sus facturas juntas? Esa vista está en <strong>Por Orden de Compra</strong>.
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
                  <th>Expediente / OC</th><th>Cliente</th><th>Prov.</th>
                  <th className="num">Kilos Pedidos</th><th className="num">Kilos Entregados</th><th className="num">Kilos Pendientes</th><th className="num">Kilos Facturados</th>
                  <th className="num">Facturado (c/IVA)</th><th className="num">Cobrado</th>
                  <th className="num">Deuda Restante</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map(({ o, s: summary }) => {
                  const st = summary.status;
                  const deuda = summary.invoiceTotal - summary.paidAmount;
                  return (
                    <tr
                      key={o.id}
                      className={st === 'overdue' ? 'row-bad' : st === 'manual_review' ? 'row-warn' : st === 'paid' ? 'row-done' : ''}
                      onClick={() => setSelected(o)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(o); } }}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono" style={{ lineHeight: '1.4' }}>
                        <div>
                          <strong>{o.oc || o.folio || 'Sin Folio'}</strong>
                        </div>
                        {o.oc && o.folio && o.oc !== o.folio && (
                          <div className="hint" style={{ fontSize: '0.85em' }}>Folio: {o.folio}</div>
                        )}
                        {!o.oc && !o.folio && (
                          <div className="hint" style={{ fontSize: '0.85em' }}>Ref: #{o.id.slice(0, 6)}</div>
                        )}
                        {summary.invoices.some(i => i.collection?.contrareciboNumber) && (
                          <div style={{ fontSize: '0.8em', color: 'var(--brand)', marginTop: '4px' }}>
                            CR: {Array.from(new Set(summary.invoices.map(i => i.collection?.contrareciboNumber).filter(Boolean))).join(', ')}
                          </div>
                        )}
                      </td>
                      <td>{o.client ?? '—'}</td>
                      <td>{o.provider ?? '—'}</td>
                      <td className="num mono">{o.totalKilograms ? kilos(o.totalKilograms) : '—'}</td>
                      <td className="num mono">{summary.kilosDelivered > 0 ? kilos(summary.kilosDelivered) : '—'}</td>
                      <td className="num mono" style={{ color: (o.totalKilograms ?? 0) - summary.kilosDelivered > 0 ? 'var(--bad)' : 'inherit' }}>
                        {((o.totalKilograms ?? 0) - summary.kilosDelivered > 0) ? kilos((o.totalKilograms ?? 0) - summary.kilosDelivered) : '—'}
                      </td>
                      <td className="num mono">{summary.kilosInvoiced > 0 ? kilos(summary.kilosInvoiced) : '—'}</td>
                      <td className="num mono">{money(summary.invoiceTotal)}</td>
                      <td className="num mono">{money(summary.paidAmount)}</td>
                      <td className="num mono" style={{ color: deuda > 0 ? 'var(--bad)' : 'inherit' }}>{money(deuda)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                          <StatusBadge status={st} />
                          {summary.maxDaysLate !== null && (st === 'overdue' || st === 'pending') && (
                            <span style={{ fontSize: '0.8em', color: summary.maxDaysLate > 0 ? 'var(--bad)' : 'var(--ok)' }}>
                              {summary.maxDaysLate > 0 ? `Vencido ${summary.maxDaysLate} días` : summary.maxDaysLate === 0 ? 'Vence hoy' : `Faltan ${Math.abs(summary.maxDaysLate)} días`}
                            </span>
                          )}
                        </div>
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
                  <td className="num">{money(totals.deuda)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        
        {rows.length > pageSize && (
          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'center', gap: '8px' }}>
            <button className="btn" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
            <span style={{ padding: '4px 12px', fontSize: '0.9em' }}>Página {page} de {Math.ceil(rows.length / pageSize)}</span>
            <button className="btn" disabled={page >= Math.ceil(rows.length / pageSize)} onClick={() => setPage(p => p + 1)}>Siguiente</button>
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
