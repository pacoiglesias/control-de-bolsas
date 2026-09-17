/**
 * TendenciasTab — chunk lazy-loaded independiente.
 * Contiene recharts (BarChart + LineChart) + export a Excel.
 */
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import type { MonthlyStat } from './useAnalytics';
import { money, kilos, percent } from '../../lib/format';

async function exportTendenciasExcel(ventasPorMes: MonthlyStat[]) {
  const XLSX = await import('xlsx');
  const data = [...ventasPorMes].reverse().map(m => ({
    'Mes': m.mes,
    'Ventas ($)': m.ventas,
    'Ganancia ($)': m.ganancia,
    'Margen (%)': m.ventas > 0 ? +(m.ganancia / m.ventas * 100).toFixed(2) : 0,
    'Kilos': m.kilos,
    'Ordenes': m.ordenes,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tendencias');
  XLSX.writeFile(wb, `Tendencias_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function TendenciasTab({ ventasPorMes }: { ventasPorMes: MonthlyStat[] }) {
  if (ventasPorMes.length === 0) return (
    <div className="empty">
      <span className="empty-icon">📈</span>
      Sin datos para el período seleccionado.
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn"
          onClick={() => void exportTendenciasExcel(ventasPorMes)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', fontSize: 13 }}
        >
          📊 Exportar Excel
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--ink-soft)' }}>Ventas vs Ganancia ($)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={ventasPorMes} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
            <Tooltip
              formatter={(v: any, name: any) => [money(Number(v ?? 0)), name === 'ventas' ? 'Ventas' : 'Ganancia']}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
            />
            <Legend formatter={v => v === 'ventas' ? 'Ventas' : 'Ganancia'} />
            <Bar dataKey="ventas"   fill="var(--accent)" radius={[4, 4, 0, 0]} name="ventas" />
            <Bar dataKey="ganancia" fill="var(--ok)"     radius={[4, 4, 0, 0]} name="ganancia" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--ink-soft)' }}>Kilos Entregados por Mes</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={ventasPorMes} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
            <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} />
            <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}t`} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
            <Tooltip
              formatter={(v: any) => [`${Number(v ?? 0).toLocaleString('es-MX')} kg`, 'Kilos']}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
            />
            <Line type="monotone" dataKey="kilos" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h3 style={{ fontSize: 14, marginBottom: 12, color: 'var(--ink-soft)' }}>Detalle por Mes</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Mes</th>
                <th style={{ textAlign: 'right' }}>Ventas</th>
                <th style={{ textAlign: 'right' }}>Ganancia</th>
                <th style={{ textAlign: 'right' }}>Margen</th>
                <th style={{ textAlign: 'right' }}>Kilos</th>
                <th style={{ textAlign: 'right' }}>Ordenes</th>
              </tr>
            </thead>
            <tbody>
              {[...ventasPorMes].reverse().map(m => (
                <tr key={m.mes}>
                  <td><strong>{m.mes}</strong></td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{money(m.ventas)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--ok)' }}>{money(m.ganancia)}</td>
                  <td style={{ textAlign: 'right', color: m.ventas > 0 && (m.ganancia / m.ventas) > 0.1 ? 'var(--ok)' : 'var(--warn)' }}>
                    {m.ventas > 0 ? percent(m.ganancia / m.ventas) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{kilos(m.kilos)}</td>
                  <td style={{ textAlign: 'right' }}>{m.ordenes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
