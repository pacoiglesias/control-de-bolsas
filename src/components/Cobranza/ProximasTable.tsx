import { useState } from 'react';
import { useCobranza } from './CobranzaContext';
import { Card, Empty, CopyButton } from '../ui';
import { fmtDate, nombreClienteVisible, toDate } from '../../lib/format';
import { promptDialog } from '../../lib/promptDialog';
import { QuickCrModal } from '../QuickCrModal';

export default function ProximasTable() {
  const {
    data,
    money,
    search,
    setSearch,
    filteredLista,
    payContrareciboBlock,
    fastCollectContrareciboBlock,
    payInvoiceExact,
    exportCobranzaCsv,
    reprogramarVencimiento,
    copyReminder,
    toast,
    filterType,
    setFilterType,
    setSelected,
  } = useCobranza();

  const [quickCrTarget, setQuickCrTarget] = useState<{ o: any; inv?: any } | null>(null);

  const lista = data?.lista || [];
  const sinCrCount = lista.filter((x: any) => x && !x.hasCr).length;
  const vencidosCount = lista.filter((x: any) => x && x.hasCr && (x.d ?? 0) > 0).length;
  const enProcesoCount = lista.filter((x: any) => {
    const portalSt = x?.inv?.collection?.contrareciboPortalStatus;
    return portalSt === 'EN PROCESO DE PAGO' || ['TH-768', 'GT-624', 'GT-597'].includes(x?.cr);
  }).length;
  const enPlazoCount = lista.filter((x: any) => x && x.hasCr && (x.d ?? 0) <= 0).length;

  const sinCr = filteredLista.filter((x: any) => !x.hasCr);
  const conCrMap = filteredLista
    .filter((x: any) => x.hasCr)
    .reduce((acc: Record<string, any[]>, x: any) => {
      const cr = x.cr || '';
      if (!acc[cr]) acc[cr] = [];
      acc[cr].push(x);
      return acc;
    }, {} as Record<string, any[]>);

  const renderRow = ({ o, inv, d, saldo }: any) => {
    const hasCr = Boolean(inv.collection?.contrareciboNumber || o.collection?.contrareciboNumber);
    const isLate = d !== null && d > 0;

    return (
      <tr
        key={inv.id}
        onClick={() => setSelected(o)}
        style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
      >
        {/* Folio */}
        <td className="mono" style={{ whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>{inv.folio ? `#${inv.folio}` : o.folio ? `#${o.folio}` : '—'}</span>
            {(inv.folio || o.folio) && <CopyButton text={inv.folio ?? o.folio ?? ''} />}
          </div>
        </td>

        {/* Cliente / Departamento */}
        <td>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{nombreClienteVisible(o.client)}</div>
          {o.department && <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{o.department}</div>}
        </td>

        {/* Fecha de Vencimiento / Plazo */}
        <td>
          <div style={{ fontSize: 12.5, fontFamily: 'monospace' }}>
            {inv.creditCycle.dueDate ? fmtDate(inv.creditCycle.dueDate) : <span style={{ color: 'var(--ink-faint)' }}>Sin fecha</span>}
          </div>
          {d !== null && (
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: isLate ? 'var(--bad)' : d > -5 ? 'var(--warn)' : 'var(--ok)',
              }}
            >
              {isLate ? `+${d}d atraso` : `${Math.abs(d)}d restantes`}
            </span>
          )}
        </td>

        {/* Saldo / Monto */}
        <td className="num mono" style={{ fontWeight: 800, fontSize: 14 }}>
          {money(saldo)}
        </td>

        {/* Estado & Acciones Rápidas */}
        <td onClick={(e) => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {!hasCr ? (
              <button
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6 }}
                onClick={() => setQuickCrTarget({ o, inv })}
              >
                📝 Asignar CR
              </button>
            ) : (
              <>
                {inv.creditCycle.status !== 'paid' && (
                  <button
                    className="btn btn-primary"
                    style={{ padding: '4px 8px', fontSize: 11, fontWeight: 700, borderRadius: 6 }}
                    onClick={() => payInvoiceExact(o.id, inv.id, saldo)}
                    title="Registrar cobro de esta factura"
                  >
                    💸 Cobrar
                  </button>
                )}
                <button
                  className="btn"
                  style={{ padding: '4px 7px', fontSize: 11, borderRadius: 6, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                  onClick={() => copyReminder(o, inv, d)}
                  title="Copiar aviso formal de cobro"
                >
                  📋
                </button>
                <button
                  className="btn"
                  style={{ padding: '4px 7px', fontSize: 11, borderRadius: 6, background: 'var(--paper-sunk)', border: '1px solid var(--line)' }}
                  onClick={async () => {
                    const dt = toDate(inv.creditCycle.dueDate);
                    const actual = dt ? dt.toISOString().slice(0, 10) : '';
                    const input = await promptDialog({
                      message: 'Nueva fecha de vencimiento:',
                      defaultValue: actual,
                      inputType: 'date',
                    });
                    if (!input) return;
                    const nuevaFecha = new Date(`${input}T00:00:00`);
                    if (isNaN(nuevaFecha.getTime())) {
                      toast('Fecha inválida. Usa el formato aaaa-mm-dd.', 'bad');
                      return;
                    }
                    void reprogramarVencimiento(o.id, inv.id, nuevaFecha);
                  }}
                  title="Reprogramar fecha de vencimiento"
                >
                  📅
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      <Card
        title="Facturas & Contrarecibos Pendientes"
        hint={`${filteredLista.length} facturas`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              className="input boxed"
              placeholder="🔍 Buscar por Folio, Cliente o CR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 12.5, minWidth: 240 }}
            />
            <button
              className="btn"
              style={{ background: 'var(--paper-raised)', border: '1px solid var(--line)', fontSize: 12, padding: '6px 12px' }}
              onClick={exportCobranzaCsv}
            >
              📥 Excel
            </button>
          </div>
        }
      >
        {/* Barra de Filtros Rápidos */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className={`btn-small ${filterType === 'todos' ? 'btn-primary' : ''}`}
            onClick={() => setFilterType('todos')}
            style={{ padding: '4px 10px', fontSize: 11.5, borderRadius: 12 }}
          >
            Todas ({lista.length})
          </button>
          <button
            className="btn-small"
            onClick={() => setFilterType('vencidos')}
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              borderRadius: 12,
              background: filterType === 'vencidos' ? '#dc2626' : 'rgba(239, 68, 68, 0.12)',
              color: filterType === 'vencidos' ? '#fff' : '#b91c1c',
              fontWeight: 700,
              border: 'none',
            }}
          >
            🚨 Vencidas ({vencidosCount})
          </button>
          <button
            className="btn-small"
            onClick={() => setFilterType('enproceso')}
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              borderRadius: 12,
              background: filterType === 'enproceso' ? '#d97706' : 'rgba(217, 119, 6, 0.12)',
              color: filterType === 'enproceso' ? '#fff' : '#b45309',
              fontWeight: 700,
              border: 'none',
            }}
          >
            ⚡ En Proceso ({enProcesoCount})
          </button>
          <button
            className="btn-small"
            onClick={() => setFilterType('sincr')}
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              borderRadius: 12,
              background: filterType === 'sincr' ? '#2563eb' : 'rgba(37, 99, 235, 0.12)',
              color: filterType === 'sincr' ? '#fff' : '#1d4ed8',
              fontWeight: 700,
              border: 'none',
            }}
          >
            ⚠️ Sin CR ({sinCrCount})
          </button>
          <button
            className="btn-small"
            onClick={() => setFilterType('enplazo')}
            style={{
              padding: '4px 10px',
              fontSize: 11.5,
              borderRadius: 12,
              background: filterType === 'enplazo' ? '#059669' : 'rgba(16, 185, 129, 0.12)',
              color: filterType === 'enplazo' ? '#fff' : '#047857',
              fontWeight: 700,
              border: 'none',
            }}
          >
            ✓ En Plazo ({enPlazoCount})
          </button>
        </div>

        {filteredLista.length === 0 ? (
          <Empty>{search.trim() ? `No se encontraron resultados para "${search}".` : 'No hay facturas pendientes de cobro.'}</Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Facturas Sin CR */}
            {sinCr.length > 0 && (
              <div style={{ border: '1.5px solid rgba(37, 99, 235, 0.4)', borderRadius: 10, overflow: 'hidden' }}>
                <div
                  style={{
                    background: 'rgba(37, 99, 235, 0.08)',
                    color: 'var(--ink)',
                    padding: '8px 14px',
                    fontWeight: 700,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                    borderBottom: '1px solid rgba(37, 99, 235, 0.2)',
                  }}
                >
                  <span style={{ color: '#2563eb' }}>⚠️ Facturas Pendientes de Contrarecibo</span>
                  <span style={{ fontSize: 11, background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                    {sinCr.length} facturas
                  </span>
                </div>
                <div className="table-scroll">
                  <table className="data-table" style={{ margin: 0, border: 'none' }}>
                    <thead>
                      <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Fecha Estimada</th>
                        <th className="num">Importe</th>
                        <th style={{ textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>{sinCr.map(renderRow)}</tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Facturas con Contrarecibo agrupadas */}
            {(Object.entries(conCrMap) as [string, any[]][]).map(([cr, items]) => {
              const totalSaldo = items.reduce((sum: number, item: any) => sum + item.saldo, 0);
              const grp = data.listaCr.find((g: any) => g.cr === cr);
              const client = grp?.client || items[0]?.o?.client || 'Cliente';
              const hasOverdue = items.some((x: any) => (x.d ?? 0) > 0);

              return (
                <details
                  key={cr}
                  style={{
                    border: hasOverdue ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--card-border, var(--line))',
                    borderRadius: 10,
                    background: 'var(--paper, #fff)',
                    overflow: 'hidden',
                  }}
                  open={hasOverdue || items.length <= 2}
                >
                  <summary
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: hasOverdue ? 'rgba(239, 68, 68, 0.05)' : 'var(--paper-sunk)',
                      listStyle: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, fontFamily: 'monospace' }}>{cr}</span>
                      <span style={{ fontSize: 13, color: 'var(--ink-soft)' }}>{nombreClienteVisible(client)}</span>
                      <span
                        style={{
                          fontSize: 10.5,
                          background: 'var(--paper)',
                          color: 'var(--ink-soft)',
                          padding: '1px 6px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          fontWeight: 600,
                        }}
                      >
                        {items.length} {items.length === 1 ? 'factura' : 'facturas'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', fontFamily: 'monospace' }}>
                        {money(totalSaldo)}
                      </span>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 11, padding: '4px 8px', fontWeight: 700, borderRadius: 6 }}
                        onClick={(e) => {
                          e.preventDefault();
                          (fastCollectContrareciboBlock || payContrareciboBlock)(cr);
                        }}
                      >
                        ⚡ Cobro Rápido
                      </button>
                    </div>
                  </summary>

                  <div className="table-scroll" style={{ borderTop: '1px solid var(--line-soft)' }}>
                    <table className="data-table" style={{ margin: 0, border: 'none' }}>
                      <thead>
                        <tr>
                          <th>Folio</th>
                          <th>Cliente</th>
                          <th>Vencimiento</th>
                          <th className="num">Saldo</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>{items.map(renderRow)}</tbody>
                    </table>
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </Card>

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