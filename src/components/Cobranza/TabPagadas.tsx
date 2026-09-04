import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';
import { fmtDate, nombreClienteVisible } from '../../lib/format';

export default function TabPagadas() {
  const { data, money, collectContrareciboBlock, undoContrareciboBlock } = useContext(CobranzaContext)!;

  return (
    <Card title="Pagos Registrados con Contabilidad (Por Recolectar Efectivo)">
      <div
        style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          fontSize: 12.5,
          color: 'var(--ink)',
        }}
      >
        ℹ️ Estos montos ya fueron pagados por el cliente y están en poder de Contabilidad listos para ingresar a Caja Chica descontando su comisión.
      </div>

      {data.paid.length === 0 ? (
        <Empty>No hay pagos pendientes de recolectar.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.pendingToCollectCrs.map((crGroup: any) => {
            const groupInvoices = data.paid.filter(
              (x: any) => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === crGroup.cr
            );
            const doctoPago =
              groupInvoices[0]?.inv.collection?.paymentDocument || groupInvoices[0]?.inv.collection?.transferRef || 'Sin Ref';

            return (
              <div
                key={crGroup.cr}
                style={{
                  border: '1px solid var(--card-border, var(--line))',
                  borderRadius: 12,
                  overflow: 'hidden',
                  background: 'var(--paper, #fff)',
                }}
              >
                <div
                  style={{
                    background: 'var(--paper-sunk)',
                    padding: '10px 16px',
                    borderBottom: '1px solid var(--line-soft)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}>
                    <span>PAGO/TR: <strong className="mono">{doctoPago}</strong></span>
                    <span>CR: <strong className="mono">{crGroup.cr}</strong></span>
                    <span>BRUTO: <strong className="mono">{money(crGroup.totalVenta)}</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="btn btn-ok"
                      style={{ fontWeight: 700, fontSize: 12, padding: '6px 12px', borderRadius: 6 }}
                      onClick={() => collectContrareciboBlock(crGroup.cr, crGroup.netCobrado)}
                    >
                      💰 Recoger Efectivo ({money(crGroup.netUtilidad)})
                    </button>
                    <button
                      className="btn"
                      style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: 'var(--paper)', border: '1px solid var(--line)' }}
                      onClick={() => undoContrareciboBlock(crGroup.cr)}
                      title="Regresar a Por Cobrar"
                    >
                      ↩️ Deshacer
                    </button>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="data-table" style={{ margin: 0, border: 'none' }}>
                    <thead>
                      <tr>
                        <th>Docto. SAP</th>
                        <th>Docto. Pago</th>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Fecha Pago</th>
                        <th className="num">Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupInvoices.map(({ o, inv }: any) => (
                        <tr key={inv.id}>
                          <td className="mono">{inv.collection?.sapDocument || '—'}</td>
                          <td className="mono">{inv.collection?.paymentDocument || '—'}</td>
                          <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                          <td>{nombreClienteVisible(o.client)}</td>
                          <td className="mono">{fmtDate(inv.collection?.paidAt)}</td>
                          <td className="num mono">
                            {(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, border: 'none' }}>Subtotal Venta:</td>
                        <td className="num mono" style={{ fontWeight: 700, border: 'none' }}>{money(crGroup.totalVenta)}</td>
                        <td style={{ border: 'none' }}></td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600, color: 'var(--warn)', border: 'none' }}>
                          - Comisión Contador (8%):
                        </td>
                        <td className="num mono" style={{ fontWeight: 700, color: 'var(--warn)', border: 'none' }}>
                          -{money(crGroup.comisionContador)}
                        </td>
                        <td style={{ border: 'none' }}></td>
                      </tr>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 800, color: 'var(--ok)', border: 'none' }}>
                          NETO A INGRESAR A CAJA:
                        </td>
                        <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)', fontSize: 14, border: 'none' }}>
                          {money(crGroup.netUtilidad)}
                        </td>
                        <td style={{ border: 'none' }}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
