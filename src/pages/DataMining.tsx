import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { getOrderSummary } from '../lib/finance';
import { money, kilos, percent, fmtDate } from '../lib/format';
import { StatusBadge } from '../components/ui';
import { exportToExcel } from '../lib/export';
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
      return row.folio.toLowerCase().includes(q) || row.client.toLowerCase().includes(q);
    }).sort((a: any, b: any) => b.fechaPedido.toMillis() - a.fechaPedido.toMillis());
  }, [orders, config, filterText]);

  const handleExport = () => {
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
    
    (exportToExcel as any)(dataToExport, 'Sabana_Maestra');
  };

  if (loading || configLoading) return <div className="p-8">Cargando Sábana Maestra...</div>;
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
          <button className="btn btn-primary" onClick={handleExport}>
            📊 Exportar a Excel
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
                  <td><StatusBadge status={row.status} /></td>
                  <td style={{ textAlign: 'center', color: row.diasAtraso > 0 ? 'var(--bad)' : 'var(--ink-soft)' }}>
                    {row.diasAtraso > 0 ? `${row.diasAtraso} días` : '—'}
                  </td>
                </tr>
              ))}
              {processedData.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--ink-soft)' }}>
                    No hay resultados que coincidan con la búsqueda.
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
