import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';
import { fmtDate, nombreClienteVisible } from '../../lib/format';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): tab "Por Recoger
 * Efectivo" extraído tal cual, sin cambiar lógica.
 */
export default function TabPagadas() {
  const { data, money, collectContrareciboBlock, undoContrareciboBlock } = useContext(CobranzaContext)!;

  return (
    <Card title="Pagos Registrados pero AÚN CON CONTABILIDAD (Por Recolectar)">
      <div className="alert warn" style={{ marginBottom: 16 }}>
        ⚠️ <strong>Recuerda:</strong> Estos montos te los entregarán <strong>quitando la comisión</strong>.
      </div>
      {data.paid.length === 0 ? (
        <Empty>No hay pagos pendientes de recolectar.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {data.pendingToCollectCrs.map((crGroup: any) => {
            const groupInvoices = data.paid.filter((x: any) => (x.inv.collection?.contrareciboNumber || x.o.collection?.contrareciboNumber) === crGroup.cr);
            const doctoPago = groupInvoices[0]?.inv.collection?.paymentDocument || groupInvoices[0]?.inv.collection?.transferRef || 'Sin Ref';

            return (
              <div key={crGroup.cr} style={{ border: '2px solid #b91c1c', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: '#f8fafc', padding: '8px 12px', borderBottom: '2px solid #b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, color: '#333' }}>
                    <span>PAGO: <strong>{doctoPago}</strong></span>
                    <span style={{ marginLeft: 16 }}>TRANSFERENCIA / CR: <strong>{crGroup.cr}</strong></span>
                    <span style={{ marginLeft: 16 }}>IMPORTE BRUTO: <strong>{money(crGroup.totalVenta)} MXN</strong></span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-ok" style={{ fontWeight: 800 }} onClick={() => collectContrareciboBlock(crGroup.cr, crGroup.netCobrado)}>
                      💰 Recoger Efectivo (Neto: {money(crGroup.netUtilidad)})
                    </button>
                    <button className="btn" style={{ background: 'var(--paper)', border: '1px solid var(--warn)', color: 'var(--warn)' }} onClick={() => undoContrareciboBlock(crGroup.cr)}>
                      ↩️ Deshacer Cobro
                    </button>
                  </div>
                </div>
                <div className="table-scroll">
                  <table className="data-table" style={{ margin: 0, border: 'none' }}>
                  <thead style={{ background: '#2563eb', color: '#fff' }}>
                    <tr>
                      <th style={{ color: '#fff', border: 'none' }}>Docto. SAP</th>
                      <th style={{ color: '#fff', border: 'none' }}>Docto. Pago</th>
                      <th style={{ color: '#fff', border: 'none' }}>Factura</th>
                      <th style={{ color: '#fff', border: 'none' }}>Detalle</th>
                      <th style={{ color: '#fff', border: 'none' }}>Fecha Pago</th>
                      <th className="num" style={{ color: '#fff', border: 'none' }}>Importe</th>
                      <th style={{ color: '#fff', border: 'none' }}>Moneda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupInvoices.map(({ o, inv }: any) => (
                      <tr key={inv.id}>
                        <td className="mono" style={{ borderLeft: 'none' }}>{inv.collection?.sapDocument || '—'}</td>
                        <td className="mono">{inv.collection?.paymentDocument || '—'}</td>
                        <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                        <td>{nombreClienteVisible(o.client)}</td>
                        <td className="mono">{fmtDate(inv.collection?.paidAt)}</td>
                        <td className="num mono">{(inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
                        <td style={{ borderRight: 'none' }}>MXN</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', border: 'none' }}>TOTAL:</td>
                      <td className="num mono" style={{ fontWeight: 'bold', border: 'none' }}>{money(crGroup.totalVenta)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>- COMISIÓN:</td>
                      <td className="num mono" style={{ fontWeight: 'bold', color: '#b91c1c', border: 'none' }}>-{money(crGroup.comisionContador)}</td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'right', fontWeight: 'bold', color: '#047857', border: 'none' }}>NETO A RECIBIR:</td>
                      <td className="num mono" style={{ fontWeight: 'bold', color: '#047857', border: 'none' }}>{money(crGroup.netUtilidad)}</td>
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
