import { useMemo, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../context/AuthContext';
import { db, PATHS } from '../lib/firebase';
import { doc, collection } from 'firebase/firestore';
import { Card, Empty, StatusBadge, Skeleton } from '../components/ui';
import OrderModal from '../components/OrderModal';
import KanbanBoard from '../components/Orders/KanbanBoard';
import { kilos, money, nombreClienteVisible } from '../lib/format';
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
  const [initialModalTab, setInitialModalTab] = useState<'resumen' | 'productos'>('resumen');
  const [viewMode, setViewMode] = useState<'list'|'kanban'>('kanban');
  
  const [page, setPage] = useState(1);
  const pageSize = 30;
  const observerTarget = useRef(null);

  useEffect(() => {
    const q = params.get('q');
    if (q !== null && q !== search) setSearch(q);
  }, [params, search]);

  const filter = (params.get('filtro') as 'all' | OrderStatus) ?? 'all';

  useEffect(() => {
    if (params.get('nueva') === '1') {
      setInitialModalTab(params.get('tab') === 'productos' ? 'productos' : 'resumen');
      setSelected({
        id: doc(collection(db, PATHS.orders)).id,
        creditCycle: { status: 'pedido' }
      } as PurchaseOrder);
      const newParams = new URLSearchParams(params);
      newParams.delete('nueva');
      newParams.delete('tab');
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

  const [sortBy, setSortBy] = useState<'folio' | 'client' | 'deuda' | null>(null);
  // La celda de CR mostraba TODOS los contrarecibos de un expediente como
  // un solo parrafo de texto separado por comas -- con 12, se vuelve
  // ilegible de un vistazo. Se compacta a los primeros 3 + un contador,
  // expandible por fila individualmente.
  const [crExpandido, setCrExpandido] = useState<Set<string>>(new Set());
  const toggleCr = (orderId: string) => {
    setCrExpandido(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId); else next.add(orderId);
      return next;
    });
  };
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const toggleSort = (campo: 'folio' | 'client' | 'deuda') => {
    if (sortBy === campo) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(campo); setSortDir('asc'); }
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtradas = conResumen.filter(({ o, s }) => {
      // El estatus sale del resumen, igual que el contador del chip y que la
      // columna Estado. Antes el filtro leia o.creditCycle.status (el campo
      // viejo de la raiz): el chip decia "Vencidas (5)" y la tabla salia vacia.
      // "Pendiente de Facturar" antes significaba "cero facturas
      // capturadas todavia" (status === 'pedido') -- un significado
      // distinto al mismo nombre en el KPI del Dashboard, que cuenta
      // kilos entregados sin facturar sin importar si ya existe una
      // factura parcial. Con eso, un expediente facturado a medias
      // (como una OC con una factura parcial real ya capturada, con
      // saldo genuino pendiente) nunca aparecia aqui. Ahora el filtro
      // significa lo mismo en los dos lugares: hay kilos entregados que
      // todavia no se han facturado.
      if (filter === 'pedido') {
        if (s.kilosDelivered <= s.kilosInvoiced) return false;
      } else if (filter !== 'all' && s.status !== filter) {
        return false;
      }
      // El Dashboard ya excluye a los expedientes migrados (cliente
      // "MIGRACION") del calculo de "Pendiente por Facturar", porque son
      // datos historicos sin trazabilidad de facturas individuales -- no
      // es que genuinamente falte facturar algo hoy. Esta lista no tenia
      // esa misma exclusion, asi que mostraba a HIST-001 como pendiente
      // cuando el Dashboard, correctamente, no lo contaba.
      if (filter === 'pedido' && o.client === 'MIGRACION') return false;
      if (!q) return true;
      return [o.folio, o.client, o.fileName, o.collection?.contrareciboNumber, String(o.totalKilograms ?? '')]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
    // Antes esta lista no tenia NINGUN orden propio -- dependia
    // completamente del orden en que llegaran los datos, sin que el
    // usuario pudiera controlarlo. Ahora, si eligio ordenar por una
    // columna, se aplica aqui; si no, se deja el orden de llegada.
    if (!sortBy) return filtradas;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtradas].sort((a, b) => {
      if (sortBy === 'folio') return dir * (a.o.folio || a.o.oc || '').localeCompare(b.o.folio || b.o.oc || '');
      if (sortBy === 'client') return dir * (a.o.client || '').localeCompare(b.o.client || '');
      const deudaA = a.s.invoiceTotal - a.s.paidAmount;
      const deudaB = b.s.invoiceTotal - b.s.paidAmount;
      return dir * (deudaA - deudaB);
    });
  }, [conResumen, filter, search, sortBy, sortDir]);

  const paginatedRows = useMemo(() => {
    return rows.slice(0, page * pageSize);
  }, [rows, page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && rows.length > page * pageSize) {
          setPage(p => p + 1);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [observerTarget, page, rows.length]);

  // Resetear página al cambiar filtro o búsqueda
  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: conResumen.length };
    let pendienteFacturar = 0;
    conResumen.forEach(({ o, s }) => {
      if (s.kilosDelivered > s.kilosInvoiced && o.client !== 'MIGRACION') pendienteFacturar++;
      c[s.status] = (c[s.status] ?? 0) + 1;
    });
    c.pedido = pendienteFacturar;
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
                <button className="btn btn-primary" onClick={() => {
                  setInitialModalTab('productos');
                  setSelected({
                    id: doc(collection(db, PATHS.orders)).id,
                    creditCycle: { status: 'pedido' }
                  } as PurchaseOrder);
                }}>
                  📥 Subir / Pegar OC
                </button>
                <button className="btn" onClick={() => {
                  setInitialModalTab('resumen');
                  setSelected({
                    id: doc(collection(db, PATHS.orders)).id,
                    creditCycle: { status: 'pedido' }
                  } as PurchaseOrder);
                }}>
                  + Expediente Manual
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
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-body)', padding: 4, borderRadius: 8, marginRight: 12 }}>
            <button 
              className={`btn-small ${viewMode === 'list' ? 'btn-primary' : ''}`} 
              style={{ background: viewMode === 'list' ? 'var(--brand)' : 'transparent', color: viewMode === 'list' ? '#fff' : 'var(--ink-soft)', border: 'none', fontWeight: 600 }}
              onClick={() => setViewMode('list')}
            >
              ☰ Lista
            </button>
            <button 
              className={`btn-small ${viewMode === 'kanban' ? 'btn-primary' : ''}`} 
              style={{ background: viewMode === 'kanban' ? 'var(--brand)' : 'transparent', color: viewMode === 'kanban' ? '#fff' : 'var(--ink-soft)', border: 'none', fontWeight: 600 }}
              onClick={() => setViewMode('kanban')}
            >
              ◫ Tablero
            </button>
          </div>
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
        ) : viewMode === 'kanban' ? (
          <div style={{ padding: '20px 16px' }}>
            <KanbanBoard items={rows} onSelect={setSelected} />
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sticky-col" onClick={() => toggleSort('folio')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Expediente / OC {sortBy === 'folio' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => toggleSort('client')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Cliente {sortBy === 'client' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
                  <th>Prov.</th>
                  <th className="num">Kilos Pedidos</th><th className="num">Kilos Entregados</th><th className="num">Kilos Pendientes</th><th className="num">Kilos Facturados</th>
                  <th className="num">Facturado (c/IVA)</th><th className="num">Cobrado</th>
                  <th className="num" onClick={() => toggleSort('deuda')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Deuda Restante {sortBy === 'deuda' && (sortDir === 'asc' ? '▲' : '▼')}
                  </th>
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
                      onClick={() => { setInitialModalTab('resumen'); setSelected(o); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); { setInitialModalTab('resumen'); setSelected(o); } } }}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono sticky-col" style={{ lineHeight: '1.5' }}>
                        {o.oc && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.03em' }}>OC</span>
                            <strong>{o.oc}</strong>
                          </div>
                        )}
                        {o.folio && o.folio !== o.oc && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: o.oc ? 3 : 0 }}>
                            <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.03em' }}>FOLIO</span>
                            {o.oc ? <span className="hint" style={{ fontSize: '0.85em' }}>{o.folio}</span> : <strong>{o.folio}</strong>}
                          </div>
                        )}
                        {!o.oc && !o.folio && (
                          <div className="hint" style={{ fontSize: '0.85em' }}>Ref: #{o.id.slice(0, 6)}</div>
                        )}
                        {summary.invoices.some((i: any) => i.collection?.contrareciboNumber) && (() => {
                          const conCr = summary.invoices.filter((i: any) => i.collection?.contrareciboNumber);
                          const expandido = crExpandido.has(o.id);
                          const ESTADO_LABEL: Record<string, { texto: string; color: string }> = {
                            overdue: { texto: 'Vencido', color: 'var(--bad)' },
                            pending: { texto: 'Por cobrar', color: 'var(--ink-soft)' },
                            paid: { texto: 'Con contador', color: 'var(--warn)' },
                            collected: { texto: 'Cobrado', color: 'var(--ok)' },
                          };
                          if (!expandido) {
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleCr(o.id); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                              >
                                <span style={{ fontSize: '0.72em', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '1px 6px', borderRadius: 4, letterSpacing: '0.03em' }}>CR</span>
                                <span style={{ fontSize: '0.85em', color: 'var(--accent)', textDecoration: 'underline' }}>
                                  {conCr.length === 1 ? conCr[0].collection?.contrareciboNumber : `${conCr.length} contrarecibos — ver cada uno`}
                                </span>
                              </button>
                            );
                          }
                          return (
                            <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 220 }}>
                              {conCr.map((inv: any) => {
                                const estado = ESTADO_LABEL[inv.creditCycle?.status] || ESTADO_LABEL.pending;
                                return (
                                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: '0.8em', padding: '3px 6px', background: 'var(--paper-sunk)', borderRadius: 4 }}>
                                    <span style={{ fontWeight: 700, color: '#047857' }}>{inv.collection.contrareciboNumber}</span>
                                    <span className="mono">{money(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0)}</span>
                                    <span style={{ color: estado.color, fontWeight: 600 }}>{estado.texto}</span>
                                  </div>
                                );
                              })}
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleCr(o.id); }}
                                style={{ fontSize: '0.8em', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: '2px 0', textAlign: 'left' }}
                              >
                                ▲ ver compacto
                              </button>
                            </div>
                          );
                        })()}
                      </td>
                      <td>{nombreClienteVisible(o.client)}</td>
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
              
              {rows.length > page * pageSize && (
                <div ref={observerTarget} style={{ height: 20, display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
                  <div className="skeleton" style={{ width: 40, height: 40, borderRadius: '50%' }}></div>
                </div>
              )}
            </div>
        )}
        
      </Card>

      {selected && (
        <OrderModal
          order={orders.find((o) => o.id === selected.id) ?? selected}
          config={config}
          onClose={() => setSelected(null)}
          readOnly={role === 'viewer'}
          initialTab={initialModalTab}
        />
      )}
    </>
  );
}
