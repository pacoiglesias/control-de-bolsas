import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): tab "Liquidación de
 * Comisiones a Contabilidad" extraído tal cual, sin cambiar lógica.
 */
export default function TabContabilidad() {
  const { data, money, liquidateAccountantBlock } = useContext(CobranzaContext)!;
  const unliquidatedCrs = data.unliquidatedCrs;
  const liquidatedCrs = data.liquidatedCrs;

  return (
    <Card title="Liquidación de Comisiones a Contabilidad">
      <div className="alert info" style={{ marginBottom: 16 }}>
        ℹ️ Aquí se listan las facturas ya cobradas (Contrarecibos cobrados o recogidos) para revisar la <strong>comisión del 8%</strong> que corresponde a Contabilidad. Haz clic en "Liquidar a Contabilidad" una vez que pagues esos honorarios.
      </div>
      {unliquidatedCrs.length === 0 && liquidatedCrs.length === 0 ? (
        <Empty>No hay contrarecibos cobrados para liquidar comisiones.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {unliquidatedCrs.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, marginBottom: 12, color: '#b91c1c' }}>Pendientes de Liquidar al Contador</h3>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Contrarecibo (CR)</th>
                      <th>Cliente</th>
                      <th className="num">Venta Facturada</th>
                      <th className="num">Comisión (8%)</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unliquidatedCrs.map((grp: any) => (
                      <tr key={grp.cr}>
                        <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                        <td>{grp.client}</td>
                        <td className="num mono">{money(grp.totalVenta)}</td>
                        <td className="num mono" style={{ color: '#b91c1c', fontWeight: 700 }}>{money(grp.comisionContador)}</td>
                        <td>
                          <button className="btn-small btn-ok" onClick={() => liquidateAccountantBlock(grp.cr)}>
                            ✅ Liquidar a Contabilidad
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 700 }}>TOTAL PENDIENTE:</td>
                      <td className="num mono" style={{ fontWeight: 700, color: '#b91c1c' }}>
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
              <h3 style={{ fontSize: 16, marginBottom: 12, color: 'var(--ok)' }}>Historial de Liquidadas</h3>
              <div className="table-scroll">
                <table className="data-table" style={{ opacity: 0.8 }}>
                  <thead>
                    <tr>
                      <th>Contrarecibo (CR)</th>
                      <th>Cliente</th>
                      <th className="num">Comisión (8%)</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidatedCrs.map((grp: any) => (
                      <tr key={grp.cr}>
                        <td className="mono">{grp.cr}</td>
                        <td>{grp.client}</td>
                        <td className="num mono">{money(grp.comisionContador)}</td>
                        <td><span className="badge" style={{ background: 'var(--ok)', color: '#fff' }}>Liquidado</span></td>
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
