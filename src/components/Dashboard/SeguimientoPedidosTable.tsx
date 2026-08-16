import { useMemo } from 'react';
import { Card, Empty, StatusBadge } from '../ui';
import { money, kilos, fmtDate, nombreClienteVisible } from '../../lib/format';
import { getOrderSummary, extractCr } from '../../lib/finance';
import { KilosProgressBar } from '../Orders/KilosProgressBar';
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
      .filter(o => !o.isClosedShort)
      .map((o) => {
        const s = getOrderSummary(o);
        const facturasList = (o.invoices || [])
          .map(i => i.folio)
          .filter(Boolean) as string[];
        
        const crsList = Array.from(
          new Set(
            (o.invoices || [])
              .map(i => extractCr(i, o))
              .concat(extractCr(undefined, o))
              .filter(Boolean)
          )
        ) as string[];

        return {
          id: o.id,
          folio: o.folio || '(sin folio)',
          facturas: facturasList,
          contrarecibos: crsList,
          cliente: nombreClienteVisible(o.client),
          fecha: o.processedAt,
          kilosPedidos: o.totalKilograms || (o.items || []).reduce((a, it) => a + (it.quantity || 0), 0) || s.kilosDelivered,
          kilosEntregados: s.kilosDelivered,
          kilosFacturados: s.kilosInvoiced,
          total: s.invoiceTotal || s.saleTotal,
          cobrado: s.paidAmount,
          status: s.status,
        };
      })
      .sort((a, b) => {
        const ta = a.fecha?.toMillis?.() ?? 0;
        const tb = b.fecha?.toMillis?.() ?? 0;
        return tb - ta;
      });
  }, [orders]);

  return (
    <Card title="🚚 Seguimiento de Pedidos — OC, Facturas, Contrarecibos y Cobros">
      {filas.length === 0 ? (
        <Empty>No hay expedientes activos.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sticky-col">Folio OC</th>
                <th>Factura(s)</th>
                <th>Contrarecibo (CR)</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="num" style={{ minWidth: 140 }}>Kilos y Avance</th>
                <th className="num">Kg Facturados</th>
                <th className="num">Total</th>
                <th className="num">Cobrado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const facturaPct = f.kilosEntregados > 0 ? Math.round((f.kilosFacturados / f.kilosEntregados) * 100) : 0;
                return (
                  <tr key={f.id}>
                    <td className="mono sticky-col" style={{ fontWeight: 800 }}>{f.folio}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {f.facturas.length > 0 ? (
                        f.facturas.map((fac, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'var(--paper-sunk)', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>
                            #{fac}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Pendiente</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {f.contrarecibos.length > 0 ? (
                        f.contrarecibos.map((cr, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>
                            {cr}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Sin CR</span>
                      )}
                    </td>
                    <td>{f.cliente}</td>
                    <td>{fmtDate(f.fecha)}</td>
                    <td className="num mono">
                      <KilosProgressBar
                        compact
                        deliveredKg={f.kilosEntregados}
                        totalKg={f.kilosPedidos}
                      />
                    </td>
                    <td className="num mono">
                      {kilos(f.kilosFacturados)}
                      {f.kilosEntregados > 0 && <span style={{ color: 'var(--ink-faint)', fontSize: 11 }}> ({facturaPct}%)</span>}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(f.total)}</td>
                    <td className="num mono" style={{ color: f.cobrado > 0 ? 'var(--ok)' : 'inherit', fontWeight: 700 }}>
                      {money(f.cobrado)}
                    </td>
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
