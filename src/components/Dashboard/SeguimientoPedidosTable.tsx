import { useMemo } from 'react';
import { Card, Empty, StatusBadge } from '../ui';
import { money, kilos, fmtDate } from '../../lib/format';
import { getOrderSummary } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';

/**
 * Reemplaza a "Ganancias Estimadas por Fecha de Factura" — el usuario
 * pidió explícitamente seguimiento de sus pedidos (OC), pagos y cobros,
 * no una gráfica de ganancias estimadas. Una fila por expediente, con el
 * estado real de cada etapa del ciclo: entregado, facturado, cobrado.
 */
export function SeguimientoPedidosTable({ orders }: { orders: PurchaseOrder[] }) {
  const filas = useMemo(() => {
    return orders
      .map((o) => {
        const s = getOrderSummary(o);
        return {
          id: o.id,
          folio: o.folio || '(sin folio)',
          cliente: o.client || '—',
          fecha: o.processedAt,
          kilosPedidos: o.totalKilograms || 0,
          kilosEntregados: s.kilosDelivered,
          kilosFacturados: s.kilosInvoiced,
          total: s.invoiceTotal || s.saleTotal,
          cobrado: s.paidAmount,
          status: s.status,
        };
      })
      .sort((a, b) => {
        const ta = a.fecha ? a.fecha.toMillis() : 0;
        const tb = b.fecha ? b.fecha.toMillis() : 0;
        return tb - ta;
      });
  }, [orders]);

  return (
    <Card title="🚚 Seguimiento de Pedidos — OC, Entregas, Pagos y Cobros">
      {filas.length === 0 ? (
        <Empty>No hay expedientes activos.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Folio OC</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="num">Kg Pedidos</th>
                <th className="num">Kg Entregados</th>
                <th className="num">Kg Facturados</th>
                <th className="num">Total</th>
                <th className="num">Cobrado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const entregaPct = f.kilosPedidos > 0 ? Math.round((f.kilosEntregados / f.kilosPedidos) * 100) : 0;
                const facturaPct = f.kilosEntregados > 0 ? Math.round((f.kilosFacturados / f.kilosEntregados) * 100) : 0;
                return (
                  <tr key={f.id}>
                    <td className="mono sticky-col" style={{ fontWeight: 700 }}>{f.folio}</td>
                    <td>{f.cliente}</td>
                    <td>{fmtDate(f.fecha)}</td>
                    <td className="num mono">{kilos(f.kilosPedidos)}</td>
                    <td className="num mono">
                      {kilos(f.kilosEntregados)}
                      {f.kilosPedidos > 0 && <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}> ({entregaPct}%)</span>}
                    </td>
                    <td className="num mono">
                      {kilos(f.kilosFacturados)}
                      {f.kilosEntregados > 0 && <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}> ({facturaPct}%)</span>}
                    </td>
                    <td className="num mono">{money(f.total)}</td>
                    <td className="num mono">{money(f.cobrado)}</td>
                    <td><StatusBadge status={f.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
