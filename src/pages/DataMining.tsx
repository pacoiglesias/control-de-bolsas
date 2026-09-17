import { lazy, Suspense, useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { getOrderSummary } from '../lib/finance';
import { money, kilos, percent, fmtDate, toDate } from '../lib/format';
import { Skeleton, StatusBadge } from '../components/ui';
import { useConfig } from '../hooks/useConfig';
import { useAnalytics } from '../features/analytics/useAnalytics';

// ── Lazy-loaded chart tabs (code-splitting) ───────────────────────────────────
const TendenciasTab = lazy(() => import('../features/analytics/TendenciasTab'));
const AgingTab      = lazy(() => import('../features/analytics/AgingTab'));

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de pestañas
// ─────────────────────────────────────────────────────────────────────────────
type Tab = 'sabana' | 'clientes' | 'tendencias' | 'aging';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'sabana',     label: 'Sabana Maestra',           emoji: '📋' },
  { id: 'clientes',   label: 'Rentabilidad por Cliente', emoji: '🏆' },
  { id: 'tendencias', label: 'Tendencias Mensuales',     emoji: '📈' },
  { id: 'aging',      label: 'Aging Report de Cartera',  emoji: '⏳' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function DataMining() {
  const { orders, loading, error } = useOrders();
  const { config, loading: configLoading } = useConfig();
  const [activeTab, setActiveTab]       = useState<Tab>('sabana');
  const [filterText, setFilterText]     = useState('');
  const [yearFilter, setYearFilter]     = useState<number | 'all'>('all');

  // ── Años disponibles en el historial ─────────────────────────────────────
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    orders.forEach(o => {
      const d = toDate((o as any).createdAt || (o as any).processedAt || o.audit?.createdAt);
      if (d) years.add(d.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [orders]);

  // ── Órdenes filtradas por año (para BI engine) ────────────────────────────
  const filteredOrdersForBI = useMemo(() => {
    if (yearFilter === 'all') return orders;
    return orders.filter(o => {
      const d = toDate((o as any).createdAt || (o as any).processedAt || o.audit?.createdAt);
      return d?.getFullYear() === yearFilter;
    });
  }, [orders, yearFilter]);

  // ── Analytics (BI engine) ─────────────────────────────────────────────────
  const { ventasPorMes, rentabilidadCliente, agingReport, kpiGlobal } =
    useAnalytics(filteredOrdersForBI);

  // ── Sabana Maestra (tabla completa, sin filtro de año) ────────────────────
  const processedData = useMemo(() => {
    if (!config) return [];
    return orders.map((order: any) => {
      const summary = getOrderSummary(order);
      const kilosPedidos    = order.totalKilograms || 0;
      const kilosEntregados = summary.kilosDelivered || 0;
      const diffKilos = kilosPedidos - kilosEntregados;
      const diffPct   = kilosPedidos > 0 ? diffKilos / kilosPedidos : 0;
      return {
        id: order.id,
        folio: order.folio,
        client: order.client,
        fechaPedido: order.createdAt,
        kilosPedidos,
        kilosEntregados,
        diffKilos,
        diffPct,
        status: summary.status,
        isClosedShort: order.isClosedShort || false,
        facturado:    summary.invoiceTotal,
        cobrado:      summary.paidAmount,
        gananciaNeta: summary.realizedProfit,
        diasAtraso:   summary.maxDaysLate || 0,
      };
    }).filter((row: any) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      return (row.folio  || '').toLowerCase().includes(q)
          || (row.client || '').toLowerCase().includes(q);
    }).sort((a: any, b: any) => {
      const ta = toDate(a.fechaPedido)?.getTime() ?? 0;
      const tb = toDate(b.fechaPedido)?.getTime() ?? 0;
      return tb - ta;
    });
  }, [orders, config, filterText]);

  // ── Exportar Sabana a Excel ───────────────────────────────────────────────
  const handleExport = async () => {
    const dataToExport = processedData.map((row: any) => ({
      'Folio OC':         row.folio,
      'Cliente':          row.client,
      'Fecha Pedido':     fmtDate(row.fechaPedido),
      'Kilos Pedidos':    row.kilosPedidos,
      'Kilos Entregados': row.kilosEntregados,
      'Diferencia Kilos': row.diffKilos,
      'Diferencia %':     row.diffPct,
      'Estatus':          row.status.toUpperCase(),
      'Cierre Forzado':   row.isClosedShort ? 'SI' : 'NO',
      'Facturado ($)':    row.facturado,
      'Cobrado ($)':      row.cobrado,
      'Ganancia Neta ($)': row.gananciaNeta,
      'Dias Atraso':      row.diasAtraso,
    }));
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sabana_Maestra');
    XLSX.writeFile(wb, `Sabana_Maestra_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ── Exportar Reporte Ejecutivo PDF ────────────────────────────────────────
  const handleExportPdf = async () => {
    const html2pdf = (await import('html2pdf.js')).default;
    const html = `
      <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 28px;">Reporte Ejecutivo Integral</h1>
            <p style="margin: 5px 0 0; color: #64748b;">Sabana Maestra de Operaciones</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: bold; font-size: 18px; color: #1e3a8a;">Control de Ordenes</p>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Fecha: ${new Date().toLocaleDateString('es-MX')}</p>
          </div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; margin-right: 15px; border-left: 4px solid #1e3a8a;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">TOTAL FACTURADO</p>
            <h2 style="margin: 0; font-size: 24px;">${money(processedData.reduce((acc: any, r: any) => acc + r.facturado, 0))}</h2>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; margin-right: 15px; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">GANANCIA NETA</p>
            <h2 style="margin: 0; font-size: 24px; color: #10b981;">${money(processedData.reduce((acc: any, r: any) => acc + r.gananciaNeta, 0))}</h2>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">ORDENES</p>
            <h2 style="margin: 0; font-size: 24px;">${processedData.length}</h2>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f1f5f9; color: #475569; text-align: left;">
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Folio</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Cliente</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1;">Fecha</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Ped / Ent (kg)</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Facturado</th>
              <th style="padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: right;">Ganancia Neta</th>
            </tr>
          </thead>
          <tbody>
            ${processedData.map((row: any) => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px;"><strong>${row.folio || 'N/A'}</strong></td>
                <td style="padding: 10px;">${row.client || 'N/A'}</td>
                <td style="padding: 10px;">${fmtDate(row.fechaPedido)}</td>
                <td style="padding: 10px; text-align: right;">${kilos(row.kilosPedidos)} / ${kilos(row.kilosEntregados)}</td>
                <td style="padding: 10px; text-align: right; font-family: monospace;">${money(row.facturado)}</td>
                <td style="padding: 10px; text-align: right; font-family: monospace; color: #10b981;">${money(row.gananciaNeta)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    const opt: any = {
      margin: 10,
      filename: `Reporte_Ejecutivo_${new Date().toISOString().slice(0, 10)}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    html2pdf().set(opt).from(html).save();
  };

  // ── Exportar Rentabilidad a Excel ─────────────────────────────────────────
  const handleExportClientes = async () => {
    const XLSX = await import('xlsx');
    const data = rentabilidadCliente.map((c, i) => ({
      'Ranking':      i + 1,
      'Cliente':      c.client,
      'Facturado ($)': c.facturado,
      'Ganancia ($)': c.ganancia,
      'Margen (%)':   +(c.margen * 100).toFixed(2),
      'Ordenes':      c.ordenes,
      'Kilos':        c.kilos,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rentabilidad_Clientes');
    XLSX.writeFile(wb, `Rentabilidad_Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Loading / Error
  // ─────────────────────────────────────────────────────────────────────────
  if (loading || configLoading) return (
    <div className="p-8">
      <Skeleton className="skeleton-card" style={{ height: '80vh' }} />
    </div>
  );
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  const totalFacturado = processedData.reduce((acc: any, r: any) => acc + r.facturado, 0);
  const totalGanancia  = processedData.reduce((acc: any, r: any) => acc + r.gananciaNeta, 0);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 pb-32 animate-fade-in" style={{ maxWidth: 1600, margin: '0 auto' }}>

      {/* ── Cabecera ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: '0 0 8px 0' }}>Data Mining & BI</h1>
          <p className="hint" style={{ margin: 0, maxWidth: 600 }}>
            Analitica integral de operaciones: rentabilidad, tendencias, cartera y sabana de auditoria.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* Filtro de año */}
          <select
            value={yearFilter}
            onChange={e => setYearFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            style={{
              padding: '8px 12px',
              background: 'var(--bg-card)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              color: 'var(--ink)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos los años</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {activeTab === 'sabana' && (
            <>
              <button className="btn" onClick={() => void handleExport()} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
                📊 Excel
              </button>
              <button className="btn btn-primary" onClick={() => void handleExportPdf()} style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', border: 'none', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
                📄 PDF
              </button>
            </>
          )}
          {activeTab === 'clientes' && rentabilidadCliente.length > 0 && (
            <button className="btn" onClick={() => void handleExportClientes()} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
              📊 Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* ── KPI Cards Globales ─────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Total Facturado" value={money(kpiGlobal.totalVentas)} />
        <KpiCard label="Ganancia Neta" value={money(kpiGlobal.totalGanancia)} color="var(--ok)" />
        <KpiCard label="Margen Promedio" value={percent(kpiGlobal.margenPromedio)} color="var(--accent)" />
        <KpiCard label="Kilos Entregados" value={kilos(kpiGlobal.totalKilos)} />
        <KpiCard label="Ordenes Activas" value={String(kpiGlobal.ordenesActivas)} />
        <KpiCard label="Ordenes Cobradas" value={String(kpiGlobal.ordenesCobradas)} color="var(--ok)" />
        <KpiCard
          label="Atraso Promedio"
          value={kpiGlobal.diasAtrasoPromedio > 0 ? `${kpiGlobal.diasAtrasoPromedio} dias` : '—'}
          color={kpiGlobal.diasAtrasoPromedio > 0 ? 'var(--bad)' : undefined}
        />
      </div>

      {/* Indicador de filtro activo */}
      {yearFilter !== 'all' && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', padding: '4px 10px', borderRadius: 20, border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
            📅 Filtrando por año: <strong>{yearFilter}</strong>
          </span>
          <button
            style={{ fontSize: 12, color: 'var(--ink-soft)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => setYearFilter('all')}
          >
            Limpiar filtro
          </button>
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 0, borderBottom: '2px solid var(--line)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              cursor: 'pointer',
              fontWeight: activeTab === t.id ? 700 : 400,
              color: activeTab === t.id ? 'var(--accent)' : 'var(--ink-soft)',
              fontSize: 14,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* ── Contenido de pestanas ──────────────────────────────────────────── */}
      <div className="card" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, overflow: 'hidden', marginTop: 0 }}>

        {/* ── Tab: Sabana Maestra ─────────────────────────────────────────── */}
        {activeTab === 'sabana' && (
          <>
            <div style={{ display: 'flex', gap: 16, padding: '16px 16px 0' }}>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Facturado: <strong>{money(totalFacturado)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Ganancia: <strong style={{ color: 'var(--ok)' }}>{money(totalGanancia)}</strong>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                Ordenes: <strong>{processedData.length}</strong>
              </div>
            </div>
            <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
              <input
                type="text"
                className="input boxed"
                placeholder="Buscar por Folio o Cliente..."
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{ maxWidth: 400 }}
              />
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: 1200 }}>
                <thead>
                  <tr>
                    <th>Folio</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'right' }}>Ped/Ent (kg)</th>
                    <th style={{ textAlign: 'right' }}>Dif (%)</th>
                    <th style={{ textAlign: 'right' }}>Facturado</th>
                    <th style={{ textAlign: 'right' }}>Ganancia Neta</th>
                    <th>Estatus</th>
                    <th style={{ textAlign: 'center' }}>Atraso</th>
                  </tr>
                </thead>
                <tbody>
                  {processedData.map((row: any) => (
                    <tr key={row.id}>
                      <td><strong>{row.folio}</strong></td>
                      <td>{fmtDate(row.fechaPedido)}</td>
                      <td>{row.client}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12 }}>Ped: {kilos(row.kilosPedidos)}</div>
                        <div style={{ fontSize: 12, color: 'var(--accent)' }}>Ent: {kilos(row.kilosEntregados)}</div>
                      </td>
                      <td style={{ textAlign: 'right', color: row.diffPct > 0.05 ? 'var(--bad)' : 'var(--ink)' }}>
                        {percent(row.diffPct)}
                        {row.isClosedShort && <div style={{ fontSize: 10, color: 'var(--warn)' }}>🔒 Forzado</div>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(row.facturado)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--ok)' }}>{money(row.gananciaNeta)}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <StatusBadge status={row.status} />
                          <div style={{ background: 'var(--line-soft)', width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{
                              width: `${row.status === 'ordered' || row.status === 'draft' ? 25 : row.status === 'delivered' ? 50 : row.status === 'invoiced' ? 75 : row.status === 'collected' ? 100 : 0}%`,
                              background: row.status === 'collected' ? 'var(--ok)' : 'var(--accent)',
                              height: '100%',
                              transition: 'width 0.3s ease',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', color: row.diasAtraso > 0 ? 'var(--bad)' : 'var(--ink-soft)' }}>
                        {row.diasAtraso > 0 ? `${row.diasAtraso} dias` : '—'}
                      </td>
                    </tr>
                  ))}
                  {processedData.length === 0 && (
                    <tr>
                      <td colSpan={9}>
                        <div className="empty">
                          <span className="empty-icon">🔍</span>
                          <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>No hay resultados</strong>
                          Intenta con otro folio o nombre de cliente.
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Tab: Rentabilidad por Cliente ───────────────────────────────── */}
        {activeTab === 'clientes' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 20px 0' }}>🏆 Top 15 Clientes por Ganancia</h2>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}>#</th>
                    <th>Cliente</th>
                    <th style={{ textAlign: 'right' }}>Facturado</th>
                    <th style={{ textAlign: 'right' }}>Ganancia</th>
                    <th style={{ textAlign: 'right' }}>Margen</th>
                    <th style={{ textAlign: 'right' }}>Ordenes</th>
                    <th style={{ textAlign: 'right' }}>Kilos</th>
                    <th style={{ minWidth: 140 }}>Barra</th>
                  </tr>
                </thead>
                <tbody>
                  {rentabilidadCliente.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="empty">
                          <span className="empty-icon">📊</span>
                          Sin datos para el período seleccionado.
                        </div>
                      </td>
                    </tr>
                  ) : (() => {
                    const maxGanancia = rentabilidadCliente[0]?.ganancia ?? 1;
                    return rentabilidadCliente.map((c, i) => (
                      <tr key={c.client}>
                        <td style={{ color: 'var(--ink-soft)', fontSize: 13 }}>{i + 1}</td>
                        <td><strong>{c.client}</strong></td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(c.facturado)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--ok)', fontWeight: 600 }}>{money(c.ganancia)}</td>
                        <td style={{ textAlign: 'right', color: c.margen > 0.15 ? 'var(--ok)' : c.margen > 0.05 ? 'var(--warn)' : 'var(--bad)' }}>
                          {percent(c.margen)}
                        </td>
                        <td style={{ textAlign: 'right' }}>{c.ordenes}</td>
                        <td style={{ textAlign: 'right' }}>{kilos(c.kilos)}</td>
                        <td>
                          <div style={{ background: 'var(--line-soft)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${maxGanancia > 0 ? (c.ganancia / maxGanancia) * 100 : 0}%`,
                              height: '100%',
                              background: i === 0 ? '#f59e0b' : i < 3 ? 'var(--accent)' : 'var(--ok)',
                              borderRadius: 4,
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Tab: Tendencias (lazy) ──────────────────────────────────────── */}
        {activeTab === 'tendencias' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 8px 0' }}>📈 Tendencias Mensuales</h2>
            <p className="hint" style={{ margin: '0 0 24px' }}>Ventas, ganancia y kilos entregados por mes.</p>
            <Suspense fallback={<Skeleton style={{ height: 400 }} />}>
              <TendenciasTab ventasPorMes={ventasPorMes} />
            </Suspense>
          </div>
        )}

        {/* ── Tab: Aging Report (lazy) ────────────────────────────────────── */}
        {activeTab === 'aging' && (
          <div style={{ padding: 24 }}>
            <h2 style={{ fontSize: 18, margin: '0 0 8px 0' }}>⏳ Aging Report de Cartera</h2>
            <p className="hint" style={{ margin: '0 0 24px' }}>
              Saldos pendientes por antiguedad. Solo expedientes con saldo {'>'} 0.
            </p>
            <Suspense fallback={<Skeleton style={{ height: 300 }} />}>
              <AgingTab agingReport={agingReport} />
            </Suspense>
          </div>
        )}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KpiCard helper
// ─────────────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="card" style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color ?? 'var(--ink)' }}>{value}</div>
    </div>
  );
}
