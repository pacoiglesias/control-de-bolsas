import { Card, Empty, StatusBadge } from '../ui';
import { money, fmtDate } from '../../lib/format';
import type { PurchaseOrder, Invoice } from '../../lib/types';

export function DashboardTables({ k }: { k: any }) {
  return (
    <>
      <Card title="Facturas Vencidas" hint={`${k.vencidas?.length || 0}`}>
        {!k.vencidas || k.vencidas.length === 0 ? (
          <Empty>Ninguna factura atrasada.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documentos</th><th>Cliente</th><th>Vence</th><th className="num">Días</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.vencidas.slice(0, 8).map(({ o, inv, d }: { o: PurchaseOrder; inv: Invoice; d: number | null }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  return (
                  <tr key={inv.id} className={(d ?? 0) > 0 ? 'row-bad' : ''}>
                    <td className="mono">
                      <div style={{ fontWeight: 600 }}>Documento: {inv.folio || 'Pendiente'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>CR: {inv.collection?.contrareciboNumber || 'S/N'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>Orden: {o.folio}</div>
                    </td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {d === null ? '—' : d > 0 ? `+${d}` : d}
                      <span title={d !== null && d > 30 ? '+30 días' : d !== null && d >= 15 ? '+15 días' : 'Reciente'} style={{ fontSize: 10 }}>
                        {d !== null && d > 30 ? '🔴' : d !== null && d >= 15 ? '🟡' : '🟢'}
                      </span>
                    </td>
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

      <Card title="Próximas a Vencer (7 días)" hint={`${k.proximas?.length || 0}`}>
        {!k.proximas || k.proximas.length === 0 ? (
          <Empty>Ninguna factura por vencer en los próximos 7 días.</Empty>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Documentos</th><th>Cliente</th><th>Vence</th><th className="num">Faltan</th>
                  <th className="num">Monto</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {k.proximas.slice(0, 8).map(({ o, inv, d }: { o: PurchaseOrder; inv: Invoice; d: number | null }) => {
                  const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                  const saldo = Math.max(invTotal - (inv.collection?.paidAmount ?? 0), 0);
                  const diasFaltantes = d !== null ? Math.abs(d) : null;
                  return (
                  <tr key={inv.id} className="row-warn">
                    <td className="mono">
                      <div style={{ fontWeight: 600 }}>Documento: {inv.folio || 'Pendiente'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>CR: {inv.collection?.contrareciboNumber || 'S/N'}</div>
                      <div style={{ color: 'var(--ink-faint)', fontSize: '0.85em' }}>Orden: {o.folio}</div>
                    </td>
                    <td>{o.client ?? '—'} {o.department ? ` - ${o.department}` : ''}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                      {diasFaltantes === null ? '—' : diasFaltantes === 0 ? 'Hoy' : `${diasFaltantes} días`}
                      <span title="Por vencer" style={{ fontSize: 10 }}>🟡</span>
                    </td>
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
