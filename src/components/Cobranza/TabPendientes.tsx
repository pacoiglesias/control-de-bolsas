import { useContext, useState, useMemo } from 'react';
import CobranzaContext from './CobranzaContext';
import { Card, Empty, KpiCard, Drawer } from '../ui';
import AgingTable from './AgingTable';
import ProximasTable from './ProximasTable';
import { QuickCrModal } from '../QuickCrModal';

/**
 * FIX (v8.9.8, split de Cobranza/index.tsx — 85KB): tab "Pendientes de
 * Cobro" extraído tal cual, sin cambiar lógica. `showAging`/`showProximas`/
 * `showUtilidad` eran estado local del componente padre usado únicamente
 * aquí (verificado: no se leen en ningún otro tab) -- se mueven con el
 * componente en vez de quedar en el padre sin usarse ahí.
 */
export default function TabPendientes() {
  const { data, money, printConsolidatedCr, shareConsolidatedCr } = useContext(CobranzaContext)!;
  const [showAging, setShowAging] = useState(false);
  const [showProximas, setShowProximas] = useState(false);
  const [showUtilidad, setShowUtilidad] = useState(false);
  const [quickCrTarget, setQuickCrTarget] = useState<{ o: any; inv?: any } | null>(null);

  const sinCrItems = useMemo(() => {
    return (data?.lista || []).filter((x: any) => x && !x.hasCr);
  }, [data]);

  return (
    <>
      {sinCrItems.length > 0 && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1.5px solid #3b82f6',
          borderRadius: 12,
          padding: '12px 18px',
          marginBottom: 20,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <strong style={{ color: '#2563eb', fontSize: 14 }}>
              ⚠️ Tienes {sinCrItems.length} {sinCrItems.length === 1 ? 'factura esperando' : 'facturas esperando'} Contrarecibo
            </strong>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
              Captura el número de CR y su promesa de pago a 30 días en 1 toque.
            </div>
          </div>
          <button
            className="btn"
            style={{ background: '#2563eb', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12.5, padding: '7px 14px' }}
            onClick={() => setQuickCrTarget({ o: sinCrItems[0].o, inv: sinCrItems[0].inv })}
          >
            ⚡ Capturar CR (#{sinCrItems[0].inv.folio || sinCrItems[0].o.folio})
          </button>
        </div>
      )}

      <div className="kpi-grid">
        <KpiCard hero tone={data.meDeben > 0 ? 'warn' : 'ok'} label="TE DEBEN" value={money(data.meDeben)}
          sub={`${data.open.length} órdenes abiertas`} />
        <KpiCard tone={data.vencido > 0 ? 'bad' : undefined} label="De eso, vencido" value={money(data.vencido)} />
        <KpiCard tone="ok" label="Cobro a 7 Días" value={money(data.proyeccion7d)} sub="Proyección esta semana" />
        <KpiCard tone="ok" label="Cobro a 15 Días" value={money(data.proyeccion15d)} sub="Proyección quincenal" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginTop: 32 }}>
        <Card title="Antigüedad de Saldos" hint="Aging">
          <div style={{ padding: 20 }}>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Resumen de cuentas por cobrar agrupadas por periodos de vencimiento.</p>
            <button className="btn btn-primary" onClick={() => setShowAging(true)} style={{ width: '100%' }}>Abrir Reporte Aging</button>
          </div>
        </Card>

        <Card title="Próximas a Vencer" hint="Facturas">
          <div style={{ padding: 20 }}>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Listado detallado de facturas próximas a vencer o ya vencidas.</p>
            <button className="btn btn-primary" onClick={() => setShowProximas(true)} style={{ width: '100%' }}>Abrir Próximas</button>
          </div>
        </Card>

        <Card title="Utilidad Líquida" hint="CRs">
          <div style={{ padding: 20 }}>
            <p style={{ color: 'var(--ink-soft)', marginBottom: 16 }}>Utilidad por contrarecibo ya descontando mermas y comisiones.</p>
            <button className="btn btn-primary" onClick={() => setShowUtilidad(true)} style={{ width: '100%' }}>Abrir Utilidad</button>
          </div>
        </Card>
      </div>

      {showAging && (
        <Drawer title="Antigüedad de Saldos (Aging)" onClose={() => setShowAging(false)} width={800}>
          <AgingTable />
        </Drawer>
      )}

      {showProximas && (
        <Drawer title="Próximas a Vencer" onClose={() => setShowProximas(false)} width={900}>
          <ProximasTable />
        </Drawer>
      )}

      {showUtilidad && (
        <Drawer title="📊 Utilidad Líquida Real por Contrarecibo" onClose={() => setShowUtilidad(false)} width={900}>
          {data.listaCr.length === 0 ? (
            <Empty>No hay contrarecibos para mostrar.</Empty>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contrarecibo (CR)</th>
                    <th>Cliente</th>
                    <th>Facturas</th>
                    <th className="num">Kilos</th>
                    <th className="num">Venta Total</th>
                    <th className="num">Costo Andrés</th>
                    <th className="num">Comisión Contador</th>
                    <th className="num">Utilidad Líquida Real</th>
                    <th className="num">Margen %</th>
                    <th className="num">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.listaCr.map((grp: any) => (
                    <tr key={grp.cr}>
                      <td className="mono" style={{ fontWeight: 700 }}>{grp.cr}</td>
                      <td>{grp.client}</td>
                      <td className="mono">{grp.folios.map((f: any) => '#' + f).join(', ') || '—'}</td>
                      <td className="num mono">{grp.totalKilos.toLocaleString('es-MX')} kg</td>
                      <td className="num mono">{money(grp.totalVenta)}</td>
                      <td className="num mono" style={{ color: 'var(--accent-deep)' }}>-{money(grp.costoAndres)}</td>
                      <td className="num mono" style={{ color: 'var(--bad)' }}>-{money(grp.comisionContador)}</td>
                      <td className="num mono" style={{ fontWeight: 800, color: 'var(--ok)' }}>{money(grp.netUtilidad)}</td>
                      <td className="num mono" style={{ fontWeight: 700, color: grp.margenPct >= 10 ? 'var(--ok)' : 'var(--warn)' }}>{grp.margenPct.toFixed(1)}%</td>
                      <td className="num">
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn" onClick={() => shareConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                            📤 Compartir
                          </button>
                          <button className="btn" onClick={() => printConsolidatedCr(grp)} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}>
                            🖨️ Imprimir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Drawer>
      )}

      {quickCrTarget && (
        <QuickCrModal
          order={quickCrTarget.o}
          invoice={quickCrTarget.inv}
          onClose={() => setQuickCrTarget(null)}
        />
      )}
    </>
  );
}
