import { useMemo } from 'react';
import { Card, Empty } from '../ui';
import { money, fmtDate, toDate } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';

/**
 * Tabla pedida explícitamente por el usuario: "el cuadro de los
 * contrarecibos para saber lo que se vence y se vencerá de forma clara".
 * Se arma directo de las órdenes activas — no depende del agregado del
 * servidor (que se queda desactualizado hasta recalcular), así que
 * siempre refleja el estado real de cada factura con contrarecibo.
 */
export function ContrarecibosTable({ orders }: { orders: PurchaseOrder[] }) {
  const filas = useMemo(() => {
    const ahora = Date.now();
    const out: {
      folio: string;
      contrarecibo: string;
      cliente: string;
      monto: number;
      vencimiento: Date | null;
      diasParaVencer: number | null;
    }[] = [];

    for (const o of orders) {
      for (const inv of o.invoices ?? []) {
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if (!cr) continue; // Sin CR todavía, no es "contrarecibo" — es "factura en revisión".
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;

        // DIAGNOSTICO TEMPORAL — quitar en cuanto se confirme la causa.
        if (typeof window !== 'undefined' && (window as any).__DEBUG_CR__ !== false) {
          console.log('[ContrarecibosTable]', {
            orderId: o.id,
            invoiceId: inv.id,
            cr,
            status: inv.creditCycle?.status,
            invoiceTotal: inv.financials?.invoiceTotal,
            financialsRaw: inv.financials,
          });
        }

        const venc = toDate(inv.creditCycle?.dueDate);
        const dias = venc ? Math.round((venc.getTime() - ahora) / (24 * 3600 * 1000)) : null;
        out.push({
          folio: inv.folio || o.folio || '(sin folio)',
          contrarecibo: cr,
          cliente: o.client || '—',
          monto: inv.financials?.invoiceTotal ?? 0,
          vencimiento: venc,
          diasParaVencer: dias,
        });
      }
    }
    // Vencidos primero (más días de atraso arriba), luego los próximos a vencer.
    out.sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999));
    return out;
  }, [orders]);

  const vigentes = filas.filter((f) => (f.diasParaVencer ?? 0) >= 0);
  const vencidos = filas.filter((f) => (f.diasParaVencer ?? 0) < 0);

  return (
    <Card title="📋 Contrarecibos — Qué vence y cuándo">
      {filas.length === 0 ? (
        <Empty>No hay contrarecibos activos por cobrar.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Contrarecibo</th>
                <th>Folio</th>
                <th>Cliente</th>
                <th>Vencimiento</th>
                <th className="num">Monto</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f, i) => {
                const vencido = (f.diasParaVencer ?? 0) < 0;
                const proximo = !vencido && (f.diasParaVencer ?? 99) <= 7;
                return (
                  <tr key={i}>
                    <td className="mono sticky-col" style={{ fontWeight: 700 }}>{f.contrarecibo}</td>
                    <td className="mono">{f.folio}</td>
                    <td>{f.cliente}</td>
                    <td>{f.vencimiento ? fmtDate(f.vencimiento) : '—'}</td>
                    <td className="num mono">{money(f.monto)}</td>
                    <td>
                      {vencido ? (
                        <span className="badge" style={{ background: 'var(--bad)' }}>
                          Vencido hace {Math.abs(f.diasParaVencer ?? 0)} día(s)
                        </span>
                      ) : proximo ? (
                        <span className="badge" style={{ background: 'var(--warn)' }}>
                          Vence en {f.diasParaVencer} día(s)
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--ok)' }}>
                          Vigente ({f.diasParaVencer} días)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 24, marginTop: 12, fontSize: 13, color: 'var(--ink-soft)' }}>
            <span>🟢 Vigentes: <strong>{money(vigentes.reduce((s, f) => s + f.monto, 0))}</strong> ({vigentes.length})</span>
            <span>🔴 Vencidos: <strong>{money(vencidos.reduce((s, f) => s + f.monto, 0))}</strong> ({vencidos.length})</span>
          </div>
        </div>
      )}
    </Card>
  );
}
