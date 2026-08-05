import { useMemo, useState } from 'react';
import { Card, Empty } from '../ui';
import { money, fmtDate, toDate } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { doc, runTransaction, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { logAction } from '../../lib/logger';

/**
 * Tabla pedida explícitamente por el usuario: "el cuadro de los
 * contrarecibos para saber lo que se vence y se vencerá de forma clara".
 * Se arma directo de las órdenes activas — no depende del agregado del
 * servidor (que se queda desactualizado hasta recalcular), así que
 * siempre refleja el estado real de cada factura con contrarecibo.
 */
export function ContrarecibosTable({ orders }: { orders: PurchaseOrder[] }) {
  const { user } = useAuth();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const filas = useMemo(() => {
    const ahora = Date.now();
    const out: {
      orderId: string;
      invoiceId: string;
      folio: string;
      contrarecibo: string;
      cliente: string;
      monto: number;
      vencimiento: Date | null;
      diasParaVencer: number | null;
      status: string;
    }[] = [];

    for (const o of orders) {
      for (const inv of o.invoices ?? []) {
        const cr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber;
        if (!cr) continue; // Sin CR todavía, no es "contrarecibo" — es "factura en revisión".
        if (inv.creditCycle?.status !== 'pending' && inv.creditCycle?.status !== 'overdue') continue;

        const venc = toDate(inv.creditCycle?.dueDate);
        const dias = venc ? Math.round((venc.getTime() - ahora) / (24 * 3600 * 1000)) : null;
        out.push({
          orderId: o.id,
          invoiceId: inv.id,
          folio: inv.folio || o.folio || '(sin folio)',
          contrarecibo: cr,
          cliente: o.client || '—',
          monto: inv.financials?.invoiceTotal ?? 0,
          vencimiento: venc,
          diasParaVencer: dias,
          status: inv.creditCycle?.status || 'pending',
        });
      }
    }
    // Vencidos primero (más días de atraso arriba), luego los próximos a vencer.
    out.sort((a, b) => (a.diasParaVencer ?? 999) - (b.diasParaVencer ?? 999));
    return out;
  }, [orders]);

  // Accion rapida pedida por el usuario: marcar un contrarecibo como
  // pagado por el cliente directo desde esta tabla, sin tener que abrir
  // el expediente completo solo para eso. Reutiliza exactamente la misma
  // logica ya probada en TabFacturas.tsx (Cobrada por Cliente). Una vez
  // marcada, la factura sale de esta tabla sola (el filtro de arriba solo
  // incluye pending/overdue) y aparece en "Con el Contador" del tablero
  // de Cobranza -- ahi ya existe el siguiente paso ("Recibida del
  // Contador -> CAJA"), no hace falta duplicarlo aqui tambien.
  async function marcarPagado(orderId: string, invoiceId: string, monto: number) {
    setBusyId(invoiceId);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, PATHS.orders, orderId);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('El expediente ya no existe.');
        const data: any = snap.data();
        const invoices = (data.invoices || []).map((i: any) =>
          i.id === invoiceId
            ? { ...i, creditCycle: { ...i.creditCycle, status: 'paid' }, collection: { ...i.collection, paidAmount: monto, paidAt: Timestamp.now() } }
            : i
        );
        tx.update(ref, { invoices });
      });
      logAction(user?.email, 'Factura Marcada Pagada (Tabla Contrarecibos)', { orderId, invoiceId });
      toast('✅ Marcada como pagada por el cliente. Pendiente de recibir del contador.', 'ok');
    } catch (e) {
      toast(`No se pudo marcar: ${(e as Error).message}`, 'bad');
    } finally {
      setBusyId(null);
    }
  }

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
                <th>Acción Rápida</th>
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
                    <td>
                      <button
                        className="btn"
                        style={{ background: 'var(--warn)', color: '#fff', borderColor: 'var(--warn)', padding: '4px 10px', fontSize: 13 }}
                        disabled={busyId === f.invoiceId}
                        onClick={() => void marcarPagado(f.orderId, f.invoiceId, f.monto)}
                      >
                        {busyId === f.invoiceId ? <span className="spinner" style={{ marginRight: 6 }}></span> : '💰 '}
                        Marcar Pagado
                      </button>
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
