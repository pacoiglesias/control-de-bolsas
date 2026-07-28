import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useAuth } from '../context/AuthContext';
import { useExpenses } from '../hooks/useExpenses';
import { useToast } from '../context/ToastContext';
import { KpiCard, Card, Empty, Spinner, StatusBadge } from '../components/ui';
import { fmtDate, kilos, money, monthKey, monthLabel, percent, toDate } from '../lib/format';
import { daysLate, getOrderSummary } from '../lib/finance';
import { seedInitialDatabase, INITIAL_SEED_DATA } from '../lib/seedData';
import { logAction } from '../lib/logger';

export default function Dashboard() {
  const { orders, loading, error } = useOrders();
  const { expenses, loading: loadingExp } = useExpenses();
  const { role, user } = useAuth();
  const { config } = useConfig();
  const nav = useNavigate();
  const toast = useToast();
  const [seeding, setSeeding] = useState(false);

  const k = useMemo(() => {
    const live = orders.filter((o) => o.creditCycle?.status !== 'manual_review');
    const pending = orders.filter((o) => o.creditCycle?.status === 'pending');
    const overdue = orders.filter((o) => o.creditCycle?.status === 'overdue');
    const paid = orders.filter((o) => o.creditCycle?.status === 'paid');
    const review = orders.filter((o) => o.creditCycle?.status === 'manual_review');
    let totalKilos = 0;
    let totalVendido = 0;
    let netoTotal = 0;
    let porCobrar = 0;
    let vencido = 0;
    let cobrado = 0;
    let netoCobrado = 0;

    live.forEach(o => {
      const s = getOrderSummary(o);
      totalKilos += o.totalKilograms ?? 0;
      
      s.invoices.forEach(inv => {
        const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        const invNet = inv.financials?.netCashFlow ?? 0;
        const paid = inv.collection?.paidAmount ?? 0;
        const saldo = Math.max(invTotal - paid, 0);
        
        totalVendido += invTotal;
        netoTotal += invNet;
        
        if (inv.creditCycle.status === 'paid') {
          cobrado += paid > 0 ? paid : invTotal;
          netoCobrado += invNet;
        } else if (inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue') {
          // Solo se suma a "por cobrar" lo que está en ciclo activo de cobro
          porCobrar += saldo;
          if (inv.creditCycle.status === 'overdue') {
            vencido += saldo;
          }
        }
      });
    });

    const meses: Record<string, { venta: number; cobrado: number }> = {};
    live.forEach(o => {
      const s = getOrderSummary(o);
      s.invoices.forEach(inv => {
        const d = toDate(inv.creditCycle.issueDate) ?? toDate(o.processedAt);
        if (!d) return;
        const key = monthKey(d);
        const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
        meses[key] = meses[key] ?? { venta: 0, cobrado: 0 };
        meses[key].venta += invTotal;
        if (inv.creditCycle.status === 'paid') meses[key].cobrado += invTotal;
      });
    });
    const mesesKeys = Object.keys(meses).sort().slice(-6);
    const maxMes = Math.max(1, ...mesesKeys.map((m) => meses[m].venta));

    const proximos = live
      .flatMap(o => {
        const s = getOrderSummary(o);
        return s.invoices
          .filter(inv => inv.creditCycle.status === 'pending' || inv.creditCycle.status === 'overdue')
          .map(inv => ({ o, inv, d: daysLate(toDate(inv.creditCycle.dueDate)) }));
      })
      .filter(x => x.d !== null && x.d > -8)
      .sort((a, b) => (b.d ?? 0) - (a.d ?? 0));

    return {
      totalKilos, totalVendido, netoTotal, porCobrar, vencido, cobrado, netoCobrado,
      pending, overdue, paid, review, meses, mesesKeys, maxMes, proximos,
    };
  }, [orders]);

  const saldoCaja = expenses.reduce((acc, e) => acc + (e.type === 'ingreso' ? e.amount : -e.amount), 0);

  if (loading || loadingExp) return <Spinner label="Conectando con Firestore…" />;
  if (error) return <div className="alert bad">{error}</div>;

  return (
    <>
      <div className="page-head">
        <h1>Panel Principal</h1>
        <p>Centro de mando operativo y financiero. {role !== 'viewer' && `Precio de venta ${money(config.salePricePerKg)}/kg, costo ${money(config.costPricePerKg)}/kg, comisión ${percent(config.commissionRate)}.`}</p>
      </div>

      {/* ALERTAS URGENTES */}
      {(k.overdue.length > 0 || k.review.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {k.overdue.length > 0 && (
            <div className="alert bad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong>Atención:</strong> Tienes {k.overdue.length} factura{k.overdue.length > 1 ? 's' : ''} vencida{k.overdue.length > 1 ? 's' : ''} por <strong>{money(k.vencido)}</strong>.
              </div>
              <button className="btn btn-danger" onClick={() => nav('/cobranza')}>Ir a Cobranza</button>
            </div>
          )}
          {k.review.length > 0 && (
            <div className="alert warn" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <div style={{ flex: 1 }}>
                <strong>Revisión manual:</strong> {k.review.length} PDF{k.review.length > 1 ? 's' : ''} no pudieron ser leídos por la IA y esperan captura.
              </div>
              <button className="btn" onClick={() => nav('/ordenes?filtro=manual_review')} style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)' }}>Revisar Ahora</button>
            </div>
          )}
        </div>
      )}

      {/* ACCIONES RÁPIDAS */}
      {role !== 'viewer' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <button className="btn" onClick={() => nav('/subir')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>📥</span>
            <span style={{ fontWeight: 600 }}>Subir PDF</span>
          </button>
          <button className="btn" onClick={() => nav('/ordenes?nueva=1')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>🛒</span>
            <span style={{ fontWeight: 600 }}>Nueva Venta Manual</span>
          </button>
          {role === 'admin' && (
            <button className="btn" onClick={() => nav('/compras')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
              <span style={{ fontSize: 24 }}>🏭</span>
              <span style={{ fontWeight: 600 }}>Comprar al Fabricante</span>
            </button>
          )}
          <button className="btn" onClick={() => nav('/cobranza')} style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'center', height: '100px' }}>
            <span style={{ fontSize: 24 }}>💰</span>
            <span style={{ fontWeight: 600 }}>Registrar Cobro</span>
          </button>
        </div>
      )}

      {orders.length === 0 && INITIAL_SEED_DATA.length > 0 && (
        <div className="alert info" style={{ marginBottom: 22, padding: '16px 20px', borderRadius: 'var(--radius)' }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            El sistema no tiene órdenes registradas aún
          </div>
          <div style={{ fontSize: 13, marginBottom: 12, lineHeight: 1.5 }}>
            Puedes cargar la base inicial con {INITIAL_SEED_DATA.length} registro{INITIAL_SEED_DATA.length === 1 ? '' : 's'} de ejemplo.
          </div>
          <button
            className="btn btn-primary"
            disabled={seeding}
            onClick={async () => {
              setSeeding(true);
              try {
                await seedInitialDatabase();
                logAction(user?.email, 'Base Inicial Cargada', { registros: INITIAL_SEED_DATA.length });
                toast(`Base inicial cargada: ${INITIAL_SEED_DATA.length} registros`, 'ok');
              } catch (e) {
                toast(`Error al cargar datos: ${(e as Error).message}`, 'bad');
              } finally {
                setSeeding(false);
              }
            }}
          >
            {seeding ? 'Cargando datos…' : `📥 Cargar base inicial (${INITIAL_SEED_DATA.length} registros)`}
          </button>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard hero label="TOTAL VENDIDO" value={money(k.totalVendido)}
          sub={`${kilos(k.totalKilos)} procesados en ${orders.length} órdenes`} />
        {role !== 'viewer' && (
          <KpiCard tone="ok" label="Ganancia neta (flujo)" value={money(k.netoTotal)}
            sub="venta − costo − comisión" />
        )}
        <KpiCard tone={k.porCobrar > 0 ? 'warn' : 'ok'} label="Te deben" value={money(k.porCobrar)}
          sub={`${k.pending.length + k.overdue.length} órdenes abiertas`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone={k.overdue.length ? 'bad' : undefined} label="Vencido" value={money(k.vencido)}
          sub={`${k.overdue.length} factura${k.overdue.length === 1 ? '' : 's'} pasada${k.overdue.length === 1 ? '' : 's'} de fecha`}
          onClick={() => nav('/cobranza')} />
        <KpiCard tone="cash" label="Cobrado" value={money(k.cobrado)}
          sub={role !== 'viewer' ? `neto ${money(k.netoCobrado)}` : undefined} />
        {role === 'admin' && (
          <KpiCard tone={saldoCaja < 0 ? "bad" : "ok"} label="Caja Chica" value={money(saldoCaja)}
            sub="flujo líquido" onClick={() => nav('/caja-chica')} />
        )}
        <KpiCard tone={k.review.length ? 'warn' : undefined} label="Esperan captura manual"
          value={k.review.length} sub="la IA no pudo leer el PDF"
          onClick={() => nav('/ordenes?filtro=manual_review')} />
      </div>

      {k.mesesKeys.length > 0 && (
        <Card title="Vendido contra cobrado, mes a mes">
          <div style={{ width: '100%', height: 320, padding: '16px 20px' }}>
            <ResponsiveContainer>
              <BarChart
                data={k.mesesKeys.map(m => ({ name: monthLabel(m), vendido: k.meses[m].venta, cobrado: k.meses[m].cobrado }))}
                margin={{ top: 10, right: 10, left: 20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-soft)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--ink-soft)' }} dy={10} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: 'var(--ink-soft)' }}
                  tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`}
                />
                <Tooltip
                  cursor={{ fill: 'var(--paper-sunk)' }}
                  contentStyle={{ backgroundColor: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', color: 'var(--ink)', fontSize: 13, boxShadow: 'var(--shadow)' }}
                  formatter={(value: any) => money(Number(value))}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <Bar dataKey="vendido" name="Total Vendido" fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="cobrado" name="Cobrado" fill="var(--ok)" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
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
                {k.proximos.slice(0, 8).map(({ o, inv, d }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  return (
                  <tr key={inv.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}>
                    <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono">{d === null ? '—' : d > 0 ? `+${d}` : d}</td>
                    <td className="num mono">{money(saldo)}</td>
                    <td><StatusBadge status={inv.creditCycle.status} /></td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
