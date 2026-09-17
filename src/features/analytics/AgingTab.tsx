/**
 * AgingTab — chunk lazy-loaded independiente.
 * Contiene recharts BarChart con Cell coloreado + export a Excel.
 */
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import type { AgingBucket } from './useAnalytics';
import { money, percent } from '../../lib/format';

const AGING_COLORS = ['#22c55e', '#f59e0b', '#f97316', '#ef4444', '#7f1d1d'];

async function exportAgingExcel(agingReport: AgingBucket[]) {
  const XLSX = await import('xlsx');
  const total = agingReport.reduce((s, b) => s + b.monto, 0);
  const data = agingReport.map(b => ({
    'Rango': b.rango,
    'Expedientes': b.count,
    'Saldo Pendiente ($)': b.monto,
    '% del Total': total > 0 ? +(b.monto / total * 100).toFixed(2) : 0,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aging_Report');
  XLSX.writeFile(wb, `Aging_Report_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export default function AgingTab({ agingReport }: { agingReport: AgingBucket[] }) {
  if (agingReport.every(b => b.monto === 0)) return (
    <div className="empty">
      <span className="empty-icon">✅</span>
      <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Cartera limpia</strong>
      No hay saldos pendientes en el período seleccionado.
    </div>
  );

  const totalAging = agingReport.reduce((s, b) => s + b.monto, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn"
          onClick={() => void exportAgingExcel(agingReport)}
          style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', fontSize: 13 }}
        >
          📊 Exportar Excel
        </button>
      </div>

      <div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={agingReport} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line-soft)" />
            <XAxis dataKey="rango" tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
            <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'var(--ink-soft)' }} />
            <Tooltip
              formatter={(v: any, _name: any, entry: any) => [
                `${money(Number(v ?? 0))} (${entry?.payload?.count ?? 0} exp.)`,
                'Saldo Pendiente',
              ]}
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 13 }}
            />
            <Bar dataKey="monto" radius={[4, 4, 0, 0]} name="Saldo Pendiente">
              {agingReport.map((_e, i) => (
                <Cell key={`cell-${i}`} fill={AGING_COLORS[i % AGING_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Rango</th>
              <th style={{ textAlign: 'right' }}>Expedientes</th>
              <th style={{ textAlign: 'right' }}>Saldo Pendiente</th>
              <th style={{ minWidth: 160 }}>% del Total</th>
            </tr>
          </thead>
          <tbody>
            {agingReport.map((bucket, idx) => {
              const pct = totalAging > 0 ? bucket.monto / totalAging : 0;
              return (
                <tr key={bucket.rango}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 2, background: AGING_COLORS[idx % AGING_COLORS.length], flexShrink: 0 }} />
                      <strong>{bucket.rango}</strong>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>{bucket.count}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: idx > 1 ? 'var(--bad)' : idx === 1 ? 'var(--warn)' : 'var(--ok)' }}>
                    {money(bucket.monto)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ background: 'var(--line-soft)', flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${pct * 100}%`, height: '100%', background: AGING_COLORS[idx % AGING_COLORS.length], borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)', minWidth: 36, textAlign: 'right' }}>
                        {percent(pct)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
