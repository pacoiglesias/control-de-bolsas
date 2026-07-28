import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { KpiCard, Card, Empty, Spinner, StatusBadge } from '../components/ui';
import { fmtDate, kilos, money, monthKey, monthLabel, percent, toDate } from '../lib/format';
import { daysLate } from '../lib/finance';

export default function Dashboard() {
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const nav = useNavigate();

  const k = useMemo(() => {
    const live = orders.filter((o) => o.creditCycle?.status !== 'manual_review');
    const pending = orders.filter((o) => o.creditCycle?.status === 'pending');
    const overdue = orders.filter((o) => o.creditCycle?.status === 'overdue');
    const paid = orders.filter((o) => o.creditCycle?.status === 'paid');
    const review = orders.filter((o) => o.creditCycle?.status === 'manual_review');
    const sale = (o: (typeof orders)[number]) =>
      o.financials?.saleTotal ?? (o.totalKilograms ?? 0) * (o.financials?.salePricePerKg ?? 0);

    const totalKilos = live.reduce((a, o) => a + (o.totalKilograms ?? 0), 0);
    const totalVendido = live.reduce((a, o) => a + sale(o), 0);
    const netoTotal = live.reduce((a, o) => a + (o.financials?.netCashFlow ?? 0), 0);
    const porCobrar = [...pending, ...overdue].reduce((a, o) => a + sale(o), 0);
    const vencido = overdue.reduce((a, o) => a + sale(o), 0);
    const cobrado = paid.reduce((a, o) => a + sale(o), 0);
    const netoCobrado = paid.reduce((a, o) => a + (o.financials?.netCashFlow ?? 0), 0);

    const meses: Record<string, { venta: number; cobrado: number }> = {};
    live.forEach((o) => {
      const d = toDate(o.creditCycle?.issueDate) ?? toDate(o.processedAt);
      if (!d) return;
      const key = monthKey(d);
      meses[key] = meses[key] ?? { venta: 0, cobrado: 0 };
      meses[key].venta += sale(o);
      if (o.creditCycle?.status === 'paid') meses[key].cobrado += sale(o);
    });
    const mesesKeys = Object.keys(meses).sort().slice(-6);
    const maxMes = Math.max(1, ...mesesKeys.map((m) => meses[m].venta));

    const proximos = pending
      .map((o) => ({ o, d: daysLate(toDate(o.creditCycle?.dueDate)) }))
      .filter((x) => x.d !== null && x.d > -8)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

    return {
      totalKilos, totalVendido, netoTotal, porCobrar, vencido, cobrado, netoCobrado,
      pending, overdue, paid, review, meses, mesesKeys, maxMes, proximos,
    };
  }, [orders]);

  if (loading) return <Spinner label="Conectando con Firestore…" />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Panel de control</h1>
        <p>
          Todo se calcula en vivo desde <code>purchaseOrders</code>. Precio de venta{' '}
          {money(config.salePricePerKg)}/kg, costo {money(config.costPricePerKg)}/kg, comisión{' '}
          {percent(config.commissionRate)}, crédito a {config.creditDays} días.
        </p>
      </div>

      <div className="kpi-grid">
        <KpiCard hero label="TOTAL VENDIDO" value={money(k.totalVendido)}
          sub={`${kilos(k.totalKilos)} procesados en ${orders.length} órdenes`} />
        <KpiCard tone="ok" label="Ganancia neta (flujo)" value={money(k.netoTotal)}
          sub="venta − costo − comisión" />
        <KpiCard tone={k.porCobrar > 0 ? 'warn' : 'ok'} label="Te deben" value={money(k.porCobrar)}
          sub={`${k.pending.length + k.overdue.length} órdenes abiertas`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone={k.overdue.length ? 'bad' : undefined} label="Vencido" value={money(k.vencido)}
          sub={`${k.overdue.length} factura${k.overdue.length === 1 ? '' : 's'} pasada${k.overdue.length === 1 ? '' : 's'} de fecha`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone="cash" label="Cobrado" value={money(k.cobrado)}
          sub={`neto ${money(k.netoCobrado)}`} />
        <KpiCard tone={k.review.length ? 'warn' : undefined} label="Esperan captura manual"
          value={k.review.length} sub="la IA no pudo leer el PDF"
          onClick={() => nav('/ordenes?filtro=manual_review')} />
      </div>

      {k.mesesKeys.length > 0 && (
        <Card title="Vendido contra cobrado, mes a mes">
          <div style={{ padding: '12px 16px 16px' }}>
            <div className="bar-legend">
              <span>▬ Vendido</span>
              <span style={{ color: 'var(--ok)' }}>▬ Cobrado</span>
            </div>
            {k.mesesKeys.map((m) => (
              <div className="bar-row" key={m}>
                <span className="mono">{monthLabel(m)}</span>
                <div className="bar-track" title={`Vendido ${money(k.meses[m].venta)} · Cobrado ${money(k.meses[m].cobrado)}`}>
                  <div className="bar-fill fact" style={{ width: `${(k.meses[m].venta / k.maxMes) * 100}%` }} />
                  <div className="bar-fill cob" style={{ width: `${(k.meses[m].cobrado / k.maxMes) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Qué vence pronto o ya venció" hint={`${k.proximos.length}`}>
        {k.proximos.length === 0 ? (
          <Empty>Nada urgente por cobrar.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folio</th><th>Cliente</th><th>Vence</th><th className="num">Días</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.proximos.slice(0, 8).map(({ o, d }) => (
                  <tr key={o.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}>
                    <td className="mono">{o.folio ?? '—'}</td>
                    <td>{o.client ?? '—'}</td>
                    <td className="mono">{fmtDate(o.creditCycle?.dueDate)}</td>
                    <td className="num mono">{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                    <td className="num mono">{money(o.financials?.saleTotal)}</td>
                    <td><StatusBadge status={o.creditCycle?.status ?? 'pending'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
