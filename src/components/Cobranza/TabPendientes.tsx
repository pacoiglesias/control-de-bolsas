import { useContext, useState, useMemo } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty } from '../ui';
import AgingTable from './AgingTable';
import ProximasTable from './ProximasTable';
import { QuickCrModal } from '../QuickCrModal';

export default function TabPendientes() {
  const { data, money, printConsolidatedCr, shareConsolidatedCr } = useContext(CobranzaContext)!;
  const [subView, setSubView] = useState<'facturas' | 'utilidad' | 'aging'>('facturas');
  const [quickCrTarget, setQuickCrTarget] = useState<{ o: any; inv?: any } | null>(null);

  const sinCrItems = useMemo(() => {
    return (data?.lista || []).filter((x: any) => x && !x.hasCr);
  }, [data]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Alerta compacta si hay facturas esperando CR */}
      {sinCrItems.length > 0 && (
        <div
          style={{
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            borderRadius: 10,
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <strong style={{ color: '#2563eb', fontSize: 13 }}>
              ⚠️ {sinCrItems.length} {sinCrItems.length === 1 ? 'factura emitida esperando' : 'facturas emitidas esperando'} Contrarecibo
            </strong>
            <div style={{ fontSize: 11.5, color: 'var(--ink-soft)', marginTop: 2 }}>
              Captura el número de CR y su fecha de promesa en 1 toque.
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              fontSize: 12,
              padding: '5px 12px',
              borderRadius: 6,
            }}
            onClick={() => setQuickCrTarget({ o: sinCrItems[0].o, inv: sinCrItems[0].inv })}
          >
            ⚡ Capturar CR (#{sinCrItems[0].inv.folio || sinCrItems[0].o.folio})
          </button>
        </div>
      )}

      {/* Selector de sub-vista limpio */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className={`btn ${subView === 'facturas' ? 'btn-primary' : ''}`}
          style={{
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: subView === 'facturas' ? 'none' : '1px solid var(--line)',
            background: subView === 'facturas' ? 'var(--accent)' : 'var(--paper)',
            color: subView === 'facturas' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => setSubView('facturas')}
        >
          📋 Facturas & Contrarecibos ({data?.lista?.length || 0})
        </button>

        <button
          className={`btn ${subView === 'utilidad' ? 'btn-primary' : ''}`}
          style={{
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: subView === 'utilidad' ? 'none' : '1px solid var(--line)',
            background: subView === 'utilidad' ? 'var(--accent)' : 'var(--paper)',
            color: subView === 'utilidad' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => setSubView('utilidad')}
        >
          📊 Utilidad por Contrarecibo ({data?.listaCr?.length || 0})
        </button>

        <button
          className={`btn ${subView === 'aging' ? 'btn-primary' : ''}`}
          style={{
            padding: '6px 14px',
            fontSize: 12.5,
            fontWeight: 700,
            borderRadius: 8,
            border: subView === 'aging' ? 'none' : '1px solid var(--line)',
            background: subView === 'aging' ? 'var(--accent)' : 'var(--paper)',
            color: subView === 'aging' ? '#fff' : 'var(--ink)',
          }}
          onClick={() => setSubView('aging')}
        >
          ⏱️ Antigüedad de Saldos (Aging)
        </button>
      </div>

      {/* Contenido según la sub-vista activa */}
      {subView === 'facturas' && <ProximasTable />}

      {subView === 'utilidad' && (
        <Card title="Utilidad Líquida Real por Contrarecibo" hint="Descontando Costo Andrés y Comisión Contador">
          {data.listaCr.length === 0 ? (
            <Empty>No hay contrarecibos para mostrar.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contrarecibo</th>
                    <th>Cliente</th>
                    <th>Facturas</th>
                    <th className="num">Kilos</th>
                    <th className="num">Venta Total</th>
                    <th className="num">Costo Andrés</th>
                    <th className="num">Comisión (8%)</th>
                    <th className="num">Utilidad Neta</th>
                    <th className="num">Margen %</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.listaCr.map((grp: any) => (
                    <tr key={grp.cr}>
                      <td className="mono" style={{ fontWeight: 800 }}>{grp.cr}</td>
                      <td>{grp.client}</td>
                      <td className="mono" style={{ fontSize: 12 }}>
                        {grp.folios.map((f: any) => '#' + f).join(', ') || '—'}
                      </td>
                      <td className="num mono">{grp.totalKilos.toLocaleString('es-MX')} kg</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{money(grp.totalVenta)}</td>
                      <td className="num mono" style={{ color: 'var(--ink-soft)' }}>-{money(grp.costoAndres)}</td>
                      <td className="num mono" style={{ color: 'var(--warn)' }}>-{money(grp.comisionContador)}</td>
                      <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)' }}>{money(grp.netUtilidad)}</td>
                      <td className="num mono" style={{ fontWeight: 700, color: grp.margenPct >= 10 ? 'var(--ok)' : 'var(--warn)' }}>
                        {grp.margenPct.toFixed(1)}%
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button
                            className="btn"
                            onClick={() => shareConsolidatedCr(grp)}
                            style={{ fontSize: 11, padding: '3px 7px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                            title="Compartir resumen en PDF"
                          >
                            📤 PDF
                          </button>
                          <button
                            className="btn"
                            onClick={() => printConsolidatedCr(grp)}
                            style={{ fontSize: 11, padding: '3px 7px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                            title="Imprimir"
                          >
                            🖨️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {subView === 'aging' && <AgingTable />}

      {quickCrTarget && (
        <QuickCrModal
          order={quickCrTarget.o}
          invoice={quickCrTarget.inv}
          onClose={() => setQuickCrTarget(null)}
        />
      )}
    </div>
  );
}
