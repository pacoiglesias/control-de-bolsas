import { useContext } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';
import { nombreClienteVisible } from '../../lib/format';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): tab "Historial:
 * Recogidos" extraído tal cual, sin cambiar lógica. `groupedByTr` se queda
 * calculado en el padre (useMemo que depende de `data.collected`, ver
 * FIX v8.9.7) y se pasa como prop explícito -- es la única pieza de este
 * tab que NO vive en CobranzaContext.
 */
export default function TabRecogidas({ groupedByTr }: { groupedByTr: Record<string, { tr: string; invoices: any[]; totalSale: number }> }) {
  const { data, money, revertCollectedContrareciboBlock } = useContext(CobranzaContext)!;

  return (
    <Card title="Historial Completo: Contrarecibos Recogidos (Ingresados a CAJA)">
      <div className="alert info" style={{ marginBottom: 16 }}>
        ℹ️ <strong>Historial de Lotes Recogidos:</strong> Aquí se guardan todos los contrarecibos cuyo dinero ya ingresó a CAJA. Si recogiste un lote por error, presiona <strong>"↩️ Deshacer Recolección"</strong> para regresarlo a "Por Recoger Dinero" y revertir el movimiento en CAJA.
      </div>
      {data.collected.length === 0 ? (
        <Empty>No hay contrarecibos recogidos aún en el historial.</Empty>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {Object.values(groupedByTr).map((group) => (
            <div key={group.tr} style={{ border: '2px solid var(--ok)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ background: '#f0fdf4', padding: '8px 12px', borderBottom: '2px solid var(--ok)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, color: '#166534' }}>
                  <span>TRANSFERENCIA (TR): <strong>{group.tr}</strong></span>
                  <span style={{ marginLeft: 16 }}>IMPORTE BRUTO: <strong>{money(group.totalSale)} MXN</strong></span>
                </div>
              </div>
              <div className="table-scroll" style={{ margin: 0 }}>
                <table className="data-table" style={{ margin: 0, border: 'none' }}>
                  <thead style={{ background: 'var(--ok)', color: '#fff' }}>
                    <tr>
                      <th style={{ color: '#fff', border: 'none' }}>Folio</th>
                      <th style={{ color: '#fff', border: 'none' }}>Cliente</th>
                      <th style={{ color: '#fff', border: 'none' }}>Contrarecibo</th>
                      <th className="num" style={{ color: '#fff', border: 'none' }}>Importe Venta</th>
                      <th style={{ color: '#fff', border: 'none' }}>Acción Reversión</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.invoices.map(({ o, inv }: any) => {
                      const currentCr = inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber || '';
                      const invTotal = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
                      return (
                        <tr key={inv.id}>
                          <td className="mono" style={{ borderLeft: 'none' }}>{inv.folio ?? o.folio ?? '—'}</td>
                          <td>{nombreClienteVisible(o.client)}</td>
                          <td className="mono">{currentCr || '—'}</td>
                          <td className="num mono" style={{ fontWeight: 700, color: 'var(--ok)' }}>
                            {money(invTotal)}
                          </td>
                          <td style={{ borderRight: 'none' }}>
                            {currentCr && (
                              <button
                                className="btn-small btn-warn"
                                style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600 }}
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
                      <td colSpan={3} style={{ textAlign: 'right', fontWeight: 'bold', border: 'none' }}>TOTAL TRANSFERENCIA:</td>
                      <td className="num mono" style={{ fontWeight: 'bold', border: 'none' }}>{money(group.totalSale)}</td>
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
