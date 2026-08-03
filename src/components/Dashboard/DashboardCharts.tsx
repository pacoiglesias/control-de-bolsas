import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { Card } from '../ui';
import { money, monthLabel } from '../../lib/format';

export function DashboardCharts({ k }: { k: any }) {
  if (!k.mesesKeys || k.mesesKeys.length === 0) return null;

  return (
    <Card title="Ganancias Estimadas por Fecha de Factura">
      <div className="table-scroll">
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Mes de Emisión</th>
              <th className="num">Venta Facturada</th>
              <th className="num">Ganancia Comercial</th>
              <th className="num">Ganancia por Cobros</th>
            </tr>
          </thead>
          <tbody>
            {k.mesesKeys.map((m: string) => {
              const data = k.meses[m];
              return (
                <tr key={m}>
                  <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{monthLabel(m)}</td>
                  <td className="num mono">{money(data.venta)}</td>
                  <td className="num mono" style={{ color: 'var(--ok)' }}>{money(data.margen || 0)}</td>
                  <td className="num mono" style={{ color: 'var(--ok)' }}>{money(data.gananciaRealizada || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ width: '100%', height: 320, padding: '16px 20px', marginTop: '16px' }}>
        <ResponsiveContainer>
          <AreaChart
            data={k.mesesKeys.map((m: string) => ({ name: monthLabel(m), vendido: k.meses[m].venta, ganancia: k.meses[m].ganancia, cobrado: k.meses[m].cobrado }))}
            margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorVendido" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--ok)" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="var(--ok)" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-soft)" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-soft)', fontFamily: 'Outfit' }} dy={10} />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 12, fill: 'var(--ink-soft)', fontFamily: 'Outfit' }}
              tickFormatter={(val: any) => `$${(Number(val)/1000).toFixed(0)}k`}
            />
            <Tooltip
              cursor={{ stroke: 'var(--line)', strokeWidth: 1, strokeDasharray: '4 4' }}
              contentStyle={{ backgroundColor: 'var(--glass)', backdropFilter: 'blur(10px)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius)', color: 'var(--ink)', fontSize: 13, boxShadow: 'var(--shadow-hover)' }}
              formatter={(value: any) => money(Number(value))}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10, fontFamily: 'Outfit' }} />
            <Area type="monotone" dataKey="vendido" name="Total Vendido" stroke="var(--accent)" strokeWidth={3} fillOpacity={1} fill="url(#colorVendido)" />
            <Area type="monotone" dataKey="ganancia" name="Utilidad Neta" stroke="var(--ok)" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
