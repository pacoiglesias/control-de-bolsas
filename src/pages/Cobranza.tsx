import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { Card, Empty, KpiCard, Spinner, StatusBadge } from '../components/ui';
import OrderModal from './OrderModal';
import { AGING_BUCKETS, agingBucket, daysLate, type AgingKey } from '../lib/finance';
import { fmtDate, money, toDate } from '../lib/format';
import type { PurchaseOrder } from '../lib/types';

export default function Cobranza() {
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);

  const data = useMemo(() => {
    const open = orders.filter(
      (o) => o.creditCycle?.status === 'pending' || o.creditCycle?.status === 'overdue',
    );
    const saldo = (o: PurchaseOrder) =>
      Math.max((o.financials?.saleTotal ?? 0) - (o.collection?.paidAmount ?? 0), 0);

    const porCliente: Record<string, Record<AgingKey, number> & { total: number }> = {};
    open.forEach((o) => {
      const c = `${o.client?.trim() || '(sin cliente)'}${o.department ? ` - ${o.department}` : ''}`;
      porCliente[c] = porCliente[c] ?? { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 };
      const b = agingBucket(toDate(o.creditCycle?.dueDate));
      porCliente[c][b] += saldo(o);
      porCliente[c].total += saldo(o);
    });
    const clientes = Object.keys(porCliente).sort((a, b) => porCliente[b].total - porCliente[a].total);

    const totalPorBucket = AGING_BUCKETS.reduce(
      (acc, b) => ({ ...acc, [b.key]: clientes.reduce((a, c) => a + porCliente[c][b.key], 0) }),
      {} as Record<AgingKey, number>,
    );

    const lista = open
      .map((o) => ({ o, d: daysLate(toDate(o.creditCycle?.dueDate)), saldo: saldo(o) }))
      .sort((a, b) => (b.d ?? -999) - (a.d ?? -999));

    return {
      open,
      lista,
      clientes,
      porCliente,
      totalPorBucket,
      meDeben: open.reduce((a, o) => a + saldo(o), 0),
      vencido: open
        .filter((o) => o.creditCycle?.status === 'overdue')
        .reduce((a, o) => a + saldo(o), 0),
      cobrado: orders
        .filter((o) => o.creditCycle?.status === 'paid')
        .reduce((a, o) => a + (o.collection?.paidAmount ?? o.financials?.saleTotal ?? 0), 0),
      comisiones: orders
        .filter((o) => o.creditCycle?.status === 'paid')
        .reduce((a, o) => a + (o.financials?.commission ?? 0), 0),
    };
  }, [orders]);

  if (loading) return <Spinner />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Cobranza</h1>
        <p>
          Lo que te deben, ordenado por antigüedad. Una orden deja de contar aquí en cuanto la
          marcas como cobrada; la comisión de contabilidad ya viene descontada del flujo neto.
        </p>
      </div>

      <div className="kpi-grid">
        <KpiCard hero tone={data.meDeben > 0 ? 'warn' : 'ok'} label="TE DEBEN" value={money(data.meDeben)}
          sub={`${data.open.length} órdenes abiertas`} />
        <KpiCard tone={data.vencido > 0 ? 'bad' : undefined} label="De eso, vencido" value={money(data.vencido)} />
        <KpiCard tone="cash" label="Ya cobrado" value={money(data.cobrado)} />
        <KpiCard label="Comisiones pagadas" value={money(data.comisiones)}
          sub={`${(config.commissionRate * 100).toFixed(1)}% sobre la venta`} />
      </div>

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
                {data.clientes.map((c) => (
                  <tr key={c}>
                    <td><strong>{c}</strong></td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className="num mono"
                        style={b.key === 'd90p' && data.porCliente[c][b.key] > 0 ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>
                        {data.porCliente[c][b.key] ? money(data.porCliente[c][b.key]) : '—'}
                      </td>
                    ))}
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(data.porCliente[c].total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className="num">{money(data.totalPorBucket[b.key])}</td>
                  ))}
                  <td className="num">{money(data.meDeben)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <Card title="Qué cobrar primero" hint={`${data.lista.length}`}>
        {data.lista.length === 0 ? (
          <Empty>No hay nada pendiente de cobro.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th><th>Cliente</th><th>Contrarecibo</th><th>Vence</th>
                  <th className="num">Días</th><th className="num">Saldo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.lista.map(({ o, d, saldo }) => (
                  <tr key={o.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}
                    onClick={() => setSelected(o)} style={{ cursor: 'pointer' }}>
                    <td className="mono">{o.folio ?? '—'}</td>
                    <td>{o.client ?? '—'}</td>
                    <td className="mono">{o.collection?.contrareciboNumber || '—'}</td>
                    <td className="mono">{fmtDate(o.creditCycle?.dueDate)}</td>
                    <td className="num mono">{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(saldo)}</td>
                    <td><StatusBadge status={o.creditCycle?.status ?? 'pending'} /></td>
                  </tr>
                ))}
              </tbody>
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
