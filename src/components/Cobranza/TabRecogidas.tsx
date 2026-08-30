import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';
import { nombreClienteVisible } from '../../lib/format';

export default function TabRecogidas({
  groupedByTr,
}: {
  groupedByTr: Record<string, { tr: string; invoices: any[]; totalSale: number }>;
}) {
  const { data, money, revertCollectedContrareciboBlock } = useContext(CobranzaContext)!;

  return (
    <Card title="Historial de Contrarecibos Recogidos (Ingresados a Caja)">
      <div
        style={{
          background: 'rgba(5, 150, 105, 0.08)',
          border: '1px solid rgba(5, 150, 105, 0.25)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          fontSize: 12.5,
          color: 'var(--ink)',
        }}
      >
        ℹ️ <strong>Historial de Lotes:</strong> Aquí se guardan los contrarecibos cuyo dinero ya ingresó efectivamente a CAJA. Si recogiste un lote por error, puedes revertirlo para regresarlo a "Por Recoger".
      </div>

      {data.collected.length === 0 ? (
        <Empty>No hay contrarecibos recogidos aún en el historial.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {Object.values(groupedByTr).map((group) => (
            <div
              key={group.tr}
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
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  <span>TRANSFERENCIA (TR): <strong className="mono">{group.tr}</strong></span>
                  <span style={{ marginLeft: 16 }}>
                    IMPORTE BRUTO: <strong className="mono">{money(group.totalSale)}</strong>
                  </span>
                </div>
              </div>

              <div className="table-scroll">
                <table className="data-table" style={{ margin: 0, border: 'none' }}>
                  <thead>
                    <tr>
                      <th>Folio</th>
                      <th>Cliente</th>
                      <th>Contrarecibo</th>
                      <th className="num">Importe Venta</th>
                      <th style={{ textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.invoices.map(({ o, inv }: any) => {
                      const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                      const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                      return (
                        <tr key={inv.id}>
                          <td className="mono">{inv.folio ?? o.folio ?? '—'}</td>
                          <td>{nombreClienteVisible(o.client)}</td>
                          <td className="mono" style={{ fontWeight: 700 }}>{currentCr || '—'}</td>
                          <td className="num mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                            {money(invTotal)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {currentCr && (
                              <button
                                className="btn-small"
                                style={{
                                  padding: '4px 8px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  background: 'var(--paper-sunk)',
                                  border: '1px solid var(--line)',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  revertCollectedContrareciboBlock(currentCr);
                                }}
                              >
                                ↩️ Deshacer Recolección
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700, border: 'none' }}>
                        TOTAL TRANSFERENCIA:
                      </td>
                      <td className="num mono" style={{ fontWeight: 800, border: 'none' }}>
                        {money(group.totalSale)}
                      </td>
                      <td style={{ border: 'none' }}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
