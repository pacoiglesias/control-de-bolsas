import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';

export default function TabContabilidad() {
  const { data, money, liquidateAccountantBlock } = useContext(CobranzaContext)!;
  const unliquidatedCrs = data.unliquidatedCrs;
  const liquidatedCrs = data.liquidatedCrs;

  return (
    <Card title="Liquidación de Comisiones a Contabilidad">
      <div
        style={{
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.25)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 16,
          fontSize: 12.5,
          color: 'var(--ink)',
        }}
      >
        ℹ️ Aquí se listan las facturas ya cobradas para revisar la <strong>comisión del 8%</strong> que corresponde a Contabilidad. Haz clic en "Liquidar a Contabilidad" una vez transferidos los honorarios.
      </div>

      {unliquidatedCrs.length === 0 && liquidatedCrs.length === 0 ? (
        <Empty>No hay contrarecibos cobrados para liquidar comisiones.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {unliquidatedCrs.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: 'var(--bad)' }}>
                Pendientes de Liquidar al Contador
              </h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contrarecibo (CR)</th>
                      <th>Cliente</th>
                      <th className="num">Venta Facturada</th>
                      <th className="num">Comisión (8%)</th>
                      <th style={{ textAlign: 'right' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unliquidatedCrs.map((grp: any) => (
                      <tr key={grp.cr}>
                        <td className="mono" style={{ fontWeight: 800 }}>{grp.cr}</td>
                        <td>{grp.client}</td>
                        <td className="num mono">{money(grp.totalVenta)}</td>
                        <td className="num mono" style={{ color: 'var(--bad)', fontWeight: 700 }}>
                          {money(grp.comisionContador)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-ok"
                            style={{ padding: '4px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6 }}
                            onClick={() => liquidateAccountantBlock(grp.cr)}
                          >
                            ✅ Liquidar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL PENDIENTE:</td>
                      <td className="num mono" style={{ fontWeight: 800, color: 'var(--bad)', fontSize: 14 }}>
                        {money(unliquidatedCrs.reduce((a: number, b: any) => a + b.comisionContador, 0))}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {liquidatedCrs.length > 0 && (
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 8, color: 'var(--ok)' }}>
                Historial de Comisiones Liquidadas
              </h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contrarecibo (CR)</th>
                      <th>Cliente</th>
                      <th className="num">Comisión Pagada</th>
                      <th style={{ textAlign: 'right' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidatedCrs.map((grp: any) => (
                      <tr key={grp.cr}>
                        <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                        <td>{grp.client}</td>
                        <td className="num mono">{money(grp.comisionContador)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              fontSize: 11,
                              background: 'rgba(5, 150, 105, 0.12)',
                              color: '#059669',
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontWeight: 700,
                            }}
                          >
                            ✓ Liquidado
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
