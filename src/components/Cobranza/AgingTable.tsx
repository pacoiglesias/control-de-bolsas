import { useCobranza } from './CobranzaContext';
import { Card, Empty } from '../ui';

const AGING_BUCKETS = [
  { key: 'd1_30', label: '1-30 días' },
  { key: 'd31_60', label: '31-60 días' },
  { key: 'd61_90', label: '61-90 días' },
  { key: 'd90p', label: '> 90 días' },
];

export default function AgingTable() {
  const { data, money } = useCobranza();
  return (
    <Card title="Antigüedad de saldos">
        {data.clientes.length === 0 ? (
          <Empty>Nadie te debe nada ahora mismo.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  {AGING_BUCKETS.map((b) => (
                    <th key={b.key} className="num">{b.label}</th>
                  ))}
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {(data?.clientes || []).map((c: string) => {
                  const clientBucket = data?.porCliente?.[c] || { d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0, total: 0 };
                  return (
                    <tr key={c}>
                      <td><strong>{c}</strong></td>
                      {AGING_BUCKETS.map((b) => (
                        <td key={b.key} className="num mono"
                          style={b.key === 'd90p' && (clientBucket as any)[b.key] > 0 ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>
                          {(clientBucket as any)[b.key] ? money((clientBucket as any)[b.key]) : '—'}
                        </td>
                      ))}
                      <td className="num mono" style={{ fontWeight: 700 }}>{money(clientBucket.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className="num">{money(data?.totalPorBucket?.[b.key] || 0)}</td>
                  ))}
                  <td className="num">{money(data?.meDeben || 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
  );
}