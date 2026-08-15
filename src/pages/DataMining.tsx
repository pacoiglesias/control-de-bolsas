import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { getOrderSummary } from '../lib/finance';
import { money, kilos, percent, fmtDate } from '../lib/format';
import { Skeleton, StatusBadge } from '../components/ui';
import { useConfig } from '../hooks/useConfig';

export default function DataMining() {
  const { orders, loading, error } = useOrders();
  const { config, loading: configLoading } = useConfig();
  const [filterText, setFilterText] = useState('');

  const processedData = useMemo(() => {
    if (!config) return [];
    
    return orders.map((order: any) => {
      const summary = getOrderSummary(order);
      const kilosPedidos = order.totalKilograms || 0;
      const kilosEntregados = summary.kilosDelivered || 0;
      const diffKilos = kilosPedidos - kilosEntregados;
      const diffPct = kilosPedidos > 0 ? (diffKilos / kilosPedidos) : 0;
      
      const isClosedShort = order.isClosedShort || false;

      return {
        id: order.id,
        folio: order.folio,
        client: order.client,
        fechaPedido: order.createdAt, // Timestamp
        kilosPedidos,
        kilosEntregados,
        diffKilos,
        diffPct,
        status: summary.status,
        isClosedShort,
        facturado: summary.invoiceTotal,
        cobrado: summary.paidAmount,
        gananciaNeta: summary.realizedProfit,
        diasAtraso: summary.maxDaysLate || 0
      };
    }).filter((row: any) => {
      if (!filterText) return true;
      const q = filterText.toLowerCase();
      // order.folio y order.client pueden venir undefined en expedientes
      // viejos migrados -- .toLowerCase() sobre undefined tronaba toda la
      // pantalla, el mismo tipo de error que fechaPedido de abajo.
      return (row.folio || '').toLowerCase().includes(q) || (row.client || '').toLowerCase().includes(q);
    }).sort((a: any, b: any) => {
      // order.createdAt puede venir undefined en expedientes migrados —
      // .toMillis() sobre undefined tronaba toda la pantalla de Sabana
      // Maestra con "Cannot read properties of undefined". Los que no
      // tienen fecha se ordenan al final en vez de tronar la pagina.
      const ta = a.fechaPedido?.toMillis?.() ?? 0;
      const tb = b.fechaPedido?.toMillis?.() ?? 0;
      return tb - ta;
    });
  }, [orders, config, filterText]);

  const handleExport = async () => {
    const dataToExport = processedData.map((row: any) => ({
      'Folio OC': row.folio,
      'Cliente': row.client,
      'Fecha Pedido': fmtDate(row.fechaPedido),
      'Kilos Pedidos': row.kilosPedidos,
      'Kilos Entregados': row.kilosEntregados,
      'Diferencia Kilos': row.diffKilos,
      'Diferencia %': row.diffPct,
      'Estatus': row.status.toUpperCase(),
      'Cierre Forzado': row.isClosedShort ? 'SI' : 'NO',
      'Facturado ($)': row.facturado,
      'Cobrado ($)': row.cobrado,
      'Ganancia Neta ($)': row.gananciaNeta,
      'Días Atraso': row.diasAtraso
    }));

    // ANTES: (exportToExcel as any)(dataToExport, 'Sabana_Maestra') — esa
    // funcion no acepta parametros (export async function exportToExcel()),
    // asi que ambos argumentos se ignoraban en silencio y el boton
    // descargaba el volcado generico de ordenes/compras/gastos en vez de
    // esta tabla de analisis ya calculada (diferencias de kilos, cierres
    // forzados, dias de atraso...). El "as any" escondia el error de tipos
    // que hubiera delatado el problema.
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sabana_Maestra');
    XLSX.writeFile(wb, `Sabana_Maestra_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportPdf = async () => {
    // Dynamic import to avoid bloating the initial bundle
    const html2pdf = (await import('html2pdf.js')).default;
    
    // Generar el HTML para el Reporte Ejecutivo
    const html = `
      <div style="font-family: 'Inter', sans-serif; padding: 40px; color: #1a1a1a;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #1e3a8a; padding-bottom: 20px; margin-bottom: 30px;">
          <div>
            <h1 style="margin: 0; color: #1e3a8a; font-size: 28px;">Reporte Ejecutivo Integral</h1>
            <p style="margin: 5px 0 0; color: #64748b;">Sábana Maestra de Operaciones · Data Mining</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-weight: bold; font-size: 18px; color: #1e3a8a;">Control de Órdenes</p>
            <p style="margin: 5px 0 0; color: #64748b; font-size: 14px;">Fecha: ${new Date().toLocaleDateString('es-MX')}</p>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; margin-right: 15px; border-left: 4px solid #1e3a8a;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">TOTAL FACTURADO (REPORTE)</p>
            <h2 style="margin: 0; font-size: 24px;">${money(processedData.reduce((acc: any, r: any) => acc + r.facturado, 0))}</h2>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; margin-right: 15px; border-left: 4px solid #10b981;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">GANANCIA NETA (REPORTE)</p>
            <h2 style="margin: 0; font-size: 24px; color: #10b981;">${money(processedData.reduce((acc: any, r: any) => acc + r.gananciaNeta, 0))}</h2>
          </div>
          <div style="background: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; border-left: 4px solid #f59e0b;">
            <p style="margin: 0 0 5px; font-size: 12px; color: #64748b;">ÓRDENES VISIBLES</p>
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
              <tr style="border-bottom: 1px solid #e2e8f0; page-break-inside: avoid;">
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
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(html).save();
  };

  if (loading || configLoading) return (
    <div className="p-8">
      <Skeleton className="skeleton-card" style={{ height: '80vh' }} />
    </div>
  );
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  // KPIs Rápidos
  const totalFacturado = processedData.reduce((acc: any, r: any) => acc + r.facturado, 0);
  const totalGanancia = processedData.reduce((acc: any, r: any) => acc + r.gananciaNeta, 0);

  return (
    <div className="p-8 pb-32 animate-fade-in" style={{ maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: '0 0 8px 0' }}>Sábana Maestra (Data Mining)</h1>
          <p className="hint" style={{ margin: 0, maxWidth: 600 }}>
            Auditoría global de todas las operaciones cruzando datos de kilos, financiero y estatus de cobranza.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn" onClick={() => void handleExport()} style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }}>
            📊 Exportar Sábana (Excel)
          </button>
          <button className="btn btn-primary" onClick={() => void handleExportPdf()} style={{ background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', border: 'none', color: '#fff', boxShadow: 'var(--shadow-md)' }}>
            📄 Reporte Ejecutivo (PDF)
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
        <div className="card" style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Total Facturado (Filtrado)</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{money(totalFacturado)}</div>
        </div>
        <div className="card" style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Ganancia Neta (Filtrada)</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ok)' }}>{money(totalGanancia)}</div>
        </div>
        <div className="card" style={{ flex: 1, padding: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Órdenes Visibles</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{processedData.length}</div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
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
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center', color: row.diasAtraso > 0 ? 'var(--bad)' : 'var(--ink-soft)' }}>
                    {row.diasAtraso > 0 ? `${row.diasAtraso} días` : '—'}
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
      </div>
    </div>
  );
}
