import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { Card, Empty, KpiCard, Spinner, StatusBadge } from '../components/ui';
import OrderModal from './OrderModal';
import { AGING_BUCKETS, agingBucket, daysLate, getOrderSummary, type AgingKey } from '../lib/finance';
import { fmtDate, money, toDate } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import type { PurchaseOrder } from '../lib/types';

export default function Cobranza() {
  const { orders, loading, error } = useOrders();
  const { role } = useAuth();
  const { config } = useConfig();
  const toast = useToast();
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [hoveredCr, setHoveredCr] = useState<string | null>(null);

  async function toggleComplementStatus(orderId: string, invoiceId: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    const invIndex = o.invoices?.findIndex(i => i.id === invoiceId);
    if (invIndex === undefined || invIndex < 0) return;
    
    const inv = o.invoices![invIndex];
    const current = inv.collection?.complementStatus;
    const nextStatus = current === 'issued' ? 'pending' : 'issued';
    
    try {
      const ref = doc(db, PATHS.orders, orderId);
      const newInvoices = [...o.invoices!];
      newInvoices[invIndex] = {
        ...inv,
        collection: {
          ...inv.collection,
          complementStatus: nextStatus
        }
      };
      await updateDoc(ref, { invoices: newInvoices });
      toast(`Complemento marcado como ${nextStatus === 'issued' ? 'Emitido' : 'Pendiente'}`, 'ok');
    } catch (e) {
      toast('Error al actualizar complemento', 'bad');
    }
  }

  async function payContrareciboBlock(crNumber: string) {
    if (!crNumber) return;
    if (!window.confirm(`¿Seguro que quieres cobrar todas las facturas pendientes del Contrarecibo ${crNumber}?`)) return;
    
    const invoicesToPay = data.open.filter(({ o, inv }) => 
      (inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber) === crNumber
    );
    
    const updatesByOrder: Record<string, typeof invoicesToPay[0]['o']['invoices']> = {};
    for (const { o, inv } of invoicesToPay) {
      if (!updatesByOrder[o.id]) {
        updatesByOrder[o.id] = [...(o.invoices || [])];
      }
      
      const invIndex = updatesByOrder[o.id]!.findIndex(i => i.id === inv.id);
      if (invIndex >= 0) {
        updatesByOrder[o.id]![invIndex] = {
          ...inv,
          creditCycle: {
            ...inv.creditCycle,
            status: 'paid'
          },
          collection: {
            ...inv.collection,
            paidAmount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0,
            paidAt: Timestamp.now()
          }
        };
      }
    }
    
    try {
      await Promise.all(Object.entries(updatesByOrder).map(([orderId, newInvoices]) => 
        updateDoc(doc(db, PATHS.orders, orderId), { invoices: newInvoices })
      ));
      toast(`Contrarecibo ${crNumber} cobrado exitosamente`, 'ok');
    } catch (e) {
      toast('Error al procesar el cobro en bloque', 'bad');
    }
  }

  const data = useMemo(() => {
    // Extraer todas las facturas de todos los expedientes
    const allInvoices = orders.flatMap((o) => {
      const s = getOrderSummary(o);
      return s.invoices.map((inv) => ({ o, inv }));
    });

    const open = allInvoices.filter(
      (x) => x.inv.creditCycle.status === 'pending' || x.inv.creditCycle.status === 'overdue',
    );

    const saldo = (inv: (typeof allInvoices)[number]['inv']) =>
      Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

    const porCliente: Record<string, Record<AgingKey, number> & { total: number }> = {};
    open.forEach(({ o, inv }) => {
      const c = `${o.client?.trim() || '(sin cliente)'}${o.department ? ` - ${o.department}` : ''}`;
      porCliente[c] = porCliente[c] ?? { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0, total: 0 };
      const b = agingBucket(toDate(inv.creditCycle.dueDate));
      const s = saldo(inv);
      porCliente[c][b] += s;
      porCliente[c].total += s;
    });
    const clientes = Object.keys(porCliente).sort((a, b) => porCliente[b].total - porCliente[a].total);

    const totalPorBucket = AGING_BUCKETS.reduce(
      (acc, b) => ({ ...acc, [b.key]: clientes.reduce((a, c) => a + porCliente[c][b.key], 0) }),
      {} as Record<AgingKey, number>,
    );

    const crCounts: Record<string, number> = {};
    open.forEach(({ o, inv }) => {
      const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
      if (cr) {
        crCounts[cr] = (crCounts[cr] || 0) + 1;
      }
    });

    const lista = open
      .map(({ o, inv }) => ({ o, inv, d: daysLate(toDate(inv.creditCycle.dueDate)), saldo: saldo(inv) }))
      .sort((a, b) => (b.d ?? -999) - (a.d ?? -999));

    return {
      open,
      lista,
      clientes,
      porCliente,
      totalPorBucket,
      crCounts,
      meDeben: open.reduce((a, x) => a + saldo(x.inv), 0),
      vencido: open
        .filter((x) => x.inv.creditCycle.status === 'overdue')
        .reduce((a, x) => a + saldo(x.inv), 0),
      cobrado: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid')
        .reduce((a, x) => a + (x.inv.collection?.paidAmount ?? x.inv.financials?.invoiceTotal ?? x.inv.financials?.saleTotal ?? 0), 0),
      comisiones: allInvoices
        .filter((x) => x.inv.creditCycle.status === 'paid')
        .reduce((a, x) => a + (x.inv.financials?.commission ?? 0), 0),
    };
  }, [orders]);

  if (loading) return <Spinner />;
  if (role === 'viewer') return <Navigate to="/" replace />;
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
                {data.lista.map(({ o, inv, d, saldo }) => {
                  const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                  const isHovered = hoveredCr && hoveredCr === currentCr;
                  return (
                  <tr key={inv.id} className={`${(d ?? 0) > 0 ? 'row-bad' : ''} ${isHovered ? 'row-hovered-cr' : ''}`}
                    onClick={() => setSelected(o)} style={{ cursor: 'pointer' }}>
                    <td className="mono">
                      {inv.folio ?? o.folio ?? '—'}
                      {inv.id !== o.id + '-inv0' ? <span style={{fontSize: '0.8em', color: 'var(--ink-faint)', marginLeft: 4}}>(parcial)</span> : null}
                    </td>
                    <td>{o.client ?? '—'}</td>
                    <td className="mono"
                        onMouseEnter={() => currentCr ? setHoveredCr(currentCr) : null}
                        onMouseLeave={() => setHoveredCr(null)}>
                      {currentCr ? (
                        <div className={`cr-chip ${data.crCounts[currentCr] > 1 ? 'shared' : ''}`}>
                          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5a2.5 2.5 0 0 1 5 0v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5a2.5 2.5 0 0 0 5 0V5c0-3.31-2.69-6-6-6S3 1.69 3 5v12.5c0 3.86 3.14 7 7 7s7-3.14 7-7V6h-1.5z"/></svg>
                          {currentCr}
                        </div>
                      ) : '—'}
                      {currentCr && 
                       data.crCounts[currentCr] > 1 && (
                        <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginLeft: 6 }}>
                          <button 
                            className="btn-small btn-ok" 
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              payContrareciboBlock(currentCr);
                            }}
                          >
                            Pagar Lote
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono">
                      {d === null ? '—' : d > 0 ? (
                        <span className="badge" style={{ background: 'var(--bad)' }}>{d} días de atraso</span>
                      ) : (
                        d
                      )}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(saldo)}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <StatusBadge status={inv.creditCycle.status} />
                        {inv.creditCycle.status === 'paid' && (
                          <button 
                            className={`btn-small ${inv.collection?.complementStatus === 'issued' ? 'btn-ok' : 'btn-warn'}`}
                            onClick={(e) => { e.stopPropagation(); toggleComplementStatus(o.id, inv.id); }}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            REP: {inv.collection?.complementStatus === 'issued' ? 'Emitido' : 'Pendiente'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
          initialTab="facturas"
        />
      )}
    </>
  );
}
