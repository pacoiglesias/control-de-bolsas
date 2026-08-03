import { useCobranza } from './CobranzaContext';
import { Card, Empty, CopyButton, StatusBadge } from '../ui';
import { fmtDate } from '../../lib/format';

export default function ProximasTable() {
  const { data, money, search, setSearch, filteredLista, payContrareciboBlock, payInvoiceExact, exportCobranzaCsv, toggleComplementStatus, reprogramarVencimiento, copyReminder, sendWhatsApp, toast, filterType, setFilterType, setSelected } = useCobranza();
  return (
    <Card 
        title="Qué cobrar primero" 
        hint={search.trim() ? `${filteredLista.length} coincidencia(s) de ${data.lista.length}` : `${data.lista.length}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input boxed"
              placeholder="🔍 Buscar por Folio, Cliente o CR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, minWidth: 260 }}
            />
            <button className="btn" style={{ background: 'var(--bg-card)', border: '1px solid var(--line)' }} onClick={exportCobranzaCsv}>
              📥 Exportar Excel (CSV)
            </button>
          </div>
        }
      >
        {filteredLista.length === 0 ? (
          <Empty>{search.trim() ? `No se encontraron resultados para "${search}".` : 'No hay nada pendiente de cobro.'}</Empty>
        ) : (
          <>
          {/* Resumen rápido e interactivo de filtros */}
          {(() => {
            const sinCrCount = data.lista.filter((x: any) => !x.hasCr).length;
            const vencidosCount = data.lista.filter((x: any) => x.hasCr && (x.d ?? 0) > 0).length;
            const enPlazoCount = data.lista.filter((x: any) => x.hasCr && (x.d ?? 0) <= 0).length;
            return (
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-faint)', textTransform: 'uppercase' }}>Filtro rápido:</span>
                <button
                  className={`btn-small ${filterType === 'todos' ? 'btn-primary' : ''}`}
                  onClick={() => setFilterType('todos')}
                  style={{ padding: '4px 12px', fontSize: 12 }}
                >
                  Todos ({data.lista.length})
                </button>
                <button
                  className={`btn-small`}
                  onClick={() => setFilterType('vencidos')}
                  style={{ padding: '4px 12px', fontSize: 12, background: filterType === 'vencidos' ? 'var(--warn)' : 'rgba(234,179,8,0.15)', color: filterType === 'vencidos' ? '#fff' : '#b45309', fontWeight: 600 }}
                >
                  🚨 Vencidos ({vencidosCount})
                </button>
                <button
                  className={`btn-small`}
                  onClick={() => setFilterType('sincr')}
                  style={{ padding: '4px 12px', fontSize: 12, background: filterType === 'sincr' ? 'var(--bad)' : 'rgba(239,68,68,0.15)', color: filterType === 'sincr' ? '#fff' : '#b91c1c', fontWeight: 600 }}
                >
                  ⚠️ Sin Contrarecibo ({sinCrCount})
                </button>
                <button
                  className={`btn-small`}
                  onClick={() => setFilterType('enplazo')}
                  style={{ padding: '4px 12px', fontSize: 12, background: filterType === 'enplazo' ? 'var(--ok)' : 'rgba(16,185,129,0.15)', color: filterType === 'enplazo' ? '#fff' : '#047857', fontWeight: 600 }}
                >
                  ✓ En Plazo ({enPlazoCount})
                </button>
              </div>
            );
          })()}
          <div className="cr-accordion-container" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const sinCr = filteredLista.filter((x: any) => !x.hasCr);
              const conCrMap = filteredLista.filter((x: any) => x.hasCr).reduce((acc: Record<string, any[]>, x: any) => {
                const cr = x.cr || '';
                if (!acc[cr]) acc[cr] = [];
                acc[cr].push(x);
                return acc;
              }, {} as Record<string, any[]>);
              
              const renderRow = ({ o, inv, d, saldo }: any) => {
                                return (
                  <tr key={inv.id} className={``}
                    onClick={() => setSelected(o)} 
                    style={{ cursor: 'pointer', background: 'transparent' }}>
                    <td className="mono">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{inv.folio ?? o.folio ?? '—'}</span>
                        {(inv.folio || o.folio) && <CopyButton text={inv.folio ?? o.folio ?? ''} />}
                        {inv.id !== o.id + '-inv0' ? <span style={{fontSize: '0.8em', color: 'var(--ink-faint)', marginLeft: 4}}>(parcial)</span> : null}
                      </div>
                    </td>
                    <td>{o.client ?? '—'}</td>
                    <td className="mono">{fmtDate(inv.creditCycle.dueDate)}</td>
                    <td className="num mono">
                      {d === null ? '—' : (
                        d > 30 ? (
                          <span className="badge" style={{ background: '#b91c1c', color: '#fff', fontWeight: 700 }}>🔴 +{d} días</span>
                        ) : d > 15 ? (
                          <span className="badge" style={{ background: '#ea580c', color: '#fff', fontWeight: 700 }}>🟠 +{d} días</span>
                        ) : d > 0 ? (
                          <span className="badge" style={{ background: 'var(--warn)', color: '#333', fontWeight: 700 }}>🟡 +{d} días</span>
                        ) : d === 0 ? (
                          <span style={{ color: 'var(--warn)', fontWeight: 'bold' }}>Vence hoy</span>
                        ) : (
                          <span style={{ color: 'var(--ok)' }}>Faltan {Math.abs(d)} d</span>
                        )
                      )}
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span>{money(saldo)}</span>
                        <CopyButton text={saldo.toString()} label="" />
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <StatusBadge status={inv.creditCycle.status} />
                        {inv.creditCycle.status === 'paid' && (
                          <button 
                            className={`btn-small ${inv.collection?.complementStatus === 'issued' ? 'btn-ok' : 'btn-warn'}`}
                            onClick={(e) => { e.stopPropagation(); toggleComplementStatus(o.id, inv.id); }}
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                          >
                            REP: {inv.collection?.complementStatus === 'issued' ? 'Emitido' : 'Pendiente'}
                          </button>
                        )}
                        <button
                          className="btn-small"
                          style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            copyReminder(o, inv, d);
                          }}
                        >
                          ✉️ Recordatorio
                        </button>
                        <button
                          className="btn-small"
                          style={{ padding: '2px 6px', fontSize: '10px', background: '#25D366', border: '1px solid #25D366', color: '#fff' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            sendWhatsApp(o, inv, d);
                          }}
                        >
                          💬 WhatsApp
                        </button>
                        <button
                          className="btn-small"
                          style={{ padding: '2px 6px', fontSize: '10px', background: 'var(--bg-card)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            const actual = inv.creditCycle.dueDate ? new Date(inv.creditCycle.dueDate.toMillis()).toISOString().slice(0, 10) : '';
                            const input = window.prompt('Nueva fecha de vencimiento (aaaa-mm-dd):', actual);
                            if (!input) return;
                            const nuevaFecha = new Date(`${input}T00:00:00`);
                            if (isNaN(nuevaFecha.getTime())) {
                              toast('Fecha inválida. Usa el formato aaaa-mm-dd.', 'bad');
                              return;
                            }
                            void reprogramarVencimiento(o.id, inv.id, nuevaFecha);
                          }}
                        >
                          📅 Reprogramar
                        </button>
                        {inv.creditCycle.status !== 'paid' && (
                          <button
                            className="btn-small btn-ok"
                            style={{ padding: '2px 6px', fontSize: '10px' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              payInvoiceExact(o.id, inv.id, saldo);
                            }}
                          >
                            ✅ Cobrar Exacto
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              };

              return (
                <>
                  {sinCr.length > 0 && (
                    <div style={{ border: '2px solid var(--bad)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ background: 'var(--bad)', color: '#fff', padding: '12px 16px', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>⚠️ Facturas Sueltas (Sin Expediente CR)</span>
                        <span className="badge" style={{ background: '#fff', color: 'var(--bad)' }}>{sinCr.length} pendientes</span>
                      </div>
                      <div className="table-scroll">
                        <table className="data-table" style={{ margin: 0, border: 'none' }}>
                          <thead style={{ background: '#fef2f2' }}>
                            <tr>
                              <th>Folio</th><th>Cliente</th><th>Fecha Cobro</th>
                              <th className="num">Plazo / Semáforo</th><th className="num">Saldo</th><th>Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sinCr.map(renderRow)}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {(Object.entries(conCrMap) as [string, any[]][]).map(([cr, items]) => {
                    const totalSaldo = items.reduce((sum: number, item: any) => sum + item.saldo, 0);
                    const grp = data.listaCr.find((g: any) => g.cr === cr);
                    const client = grp?.client || items[0].o.client || 'Cliente';
                    const hasOverdue = items.some((x: any) => (x.d ?? 0) > 0);
                    return (
                      <details key={cr} style={{ border: hasOverdue ? '2px solid var(--warn)' : '1px solid var(--line)', borderRadius: 8, background: 'var(--paper)', overflow: 'hidden', marginBottom: 16 }} open={hasOverdue}>
                        <summary style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: hasOverdue ? '#fffbeb' : 'var(--paper-sunk)', listStyle: 'none' }}>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontSize: 18, fontWeight: 800 }}>{cr}</span>
                            <span style={{ color: 'var(--ink)' }}>{client}</span>
                            <span className="badge" style={{ background: 'var(--accent)', color: '#fff' }}>{items.length} factura(s)</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--ok)' }}>{money(totalSaldo)}</span>
                            <button className="btn-small btn-ok" onClick={(e) => { e.preventDefault(); payContrareciboBlock(cr); }}>💰 Pagar Lote</button>
                          </div>
                        </summary>
                        <div className="table-scroll" style={{ borderTop: '1px solid var(--line)' }}>
                          <table className="data-table" style={{ margin: 0, border: 'none' }}>
                            <thead style={{ background: '#f8fafc' }}>
                              <tr>
                                <th>Folio</th><th>Cliente</th><th>Fecha Cobro</th>
                                <th className="num">Plazo / Semáforo</th><th className="num">Saldo</th><th>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map(renderRow)}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })}
                </>
              );
            })()}
          </div>
          </>
        )}
      </Card>
  );
}