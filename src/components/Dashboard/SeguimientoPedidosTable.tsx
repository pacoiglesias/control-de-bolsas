import { useMemo, useState } from 'react';
import { Card, Empty } from '../ui';
import { money, fmtDate, nombreClienteVisible } from '../../lib/format';
import { getOrderSummary, extractCr } from '../../lib/finance';
import { KilosProgressBar } from '../Orders/KilosProgressBar';
import type { PurchaseOrder } from '../../lib/types';
import type { PipelineStageKey } from './MoneyFlowPipeline';

interface SeguimientoPedidosTableProps {
  orders: PurchaseOrder[];
  filterStage?: PipelineStageKey | null;
  onFilterStageChange?: (stage: PipelineStageKey | null) => void;
  onOpenOrder?: (order: PurchaseOrder) => void;
}

export function SeguimientoPedidosTable({
  orders,
  filterStage,
  onFilterStageChange,
  onOpenOrder,
}: SeguimientoPedidosTableProps) {
  const [activeChip, setActiveChip] = useState<string>('ALL');

  // Determinar la estación de cada orden en el ciclo
  const getOrderStage = (o: PurchaseOrder): PipelineStageKey => {
    const s = getOrderSummary(o);
    const totalKilos = Number(o.totalKilograms) || (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0) || s.kilosDelivered;
    const deliveries = o.deliveries || [];
    const kilosEntregados = deliveries.reduce((a: number, d: any) => a + (Number(d.kilos) || 0), 0);
    const invoices = o.invoices || [];
    const kilosFacturados = invoices.reduce((a: number, i: any) => a + (Number(i.kilos) || 0), 0);

    if (s.status === 'collected') return '5_caja';

    // Si faltan kilos por entregar y no está cerrada por menos kilos
    if (!o.isClosedShort && totalKilos > kilosEntregados) return '1_taller';

    // Si tiene entregas en báscula pendientes de facturar
    if (kilosEntregados > kilosFacturados) return '2_almacen';

    // Si tiene facturas sin contrarecibo
    const hasSinCr = invoices.some(inv => !extractCr(inv, o) && inv.creditCycle?.status !== 'paid' && inv.creditCycle?.status !== 'collected');
    if (hasSinCr) return '3_sin_cr';

    // Si tiene contrarecibos activos en crédito
    const hasConCr = invoices.some(inv => !!extractCr(inv, o) && inv.creditCycle?.status !== 'collected');
    if (hasConCr) return '4_con_cr';

    return '5_caja';
  };

  const allRows = useMemo(() => {
    return orders
      .filter(o => !o.isClosedShort || (o.deliveries && o.deliveries.length > 0))
      .map((o) => {
        const s = getOrderSummary(o);
        const facturasList = (o.invoices || [])
          .map(i => i.folio)
          .filter(Boolean) as string[];
        
        const crsList = Array.from(
          new Set(
            (o.invoices || [])
              .map(i => extractCr(i, o))
              .concat(extractCr(undefined, o))
              .filter(Boolean)
          )
        ) as string[];

        const stage = getOrderStage(o);

        return {
          order: o,
          id: o.id,
          folio: o.folio || o.oc || '(sin folio)',
          facturas: facturasList,
          contrarecibos: crsList,
          cliente: nombreClienteVisible(o.client),
          department: o.department,
          fecha: o.processedAt,
          kilosPedidos: o.totalKilograms || (o.items || []).reduce((a, it) => a + (it.quantity || 0), 0) || s.kilosDelivered,
          kilosEntregados: s.kilosDelivered,
          kilosFacturados: s.kilosInvoiced,
          total: s.invoiceTotal || s.saleTotal,
          cobrado: s.paidAmount,
          status: s.status,
          isClosedShort: o.isClosedShort,
          stage,
        };
      })
      .sort((a, b) => {
        const ta = a.fecha?.toMillis?.() ?? 0;
        const tb = b.fecha?.toMillis?.() ?? 0;
        return tb - ta;
      });
  }, [orders]);

  // Filtrado reactivo por Pipeline Stage o Chip
  const filteredRows = useMemo(() => {
    const currentFilter = filterStage || (activeChip !== 'ALL' ? activeChip : null);
    if (!currentFilter) return allRows;

    return allRows.filter(r => r.stage === currentFilter);
  }, [allRows, filterStage, activeChip]);

  const handleChipClick = (stageKey: string) => {
    setActiveChip(stageKey);
    onFilterStageChange?.(stageKey === 'ALL' ? null : (stageKey as PipelineStageKey));
  };

  const getStageBadge = (stage: PipelineStageKey, isClosedShort?: boolean) => {
    if (isClosedShort) {
      return <span className="chip" style={{ background: 'rgba(59,130,246,0.1)', color: '#1d4ed8', borderColor: '#3b82f6', fontWeight: 700, fontSize: 11 }}>🔒 Concluido</span>;
    }
    switch (stage) {
      case '1_taller':
        return <span className="chip" style={{ background: 'rgba(139,92,246,0.1)', color: '#7c3aed', borderColor: '#8b5cf6', fontWeight: 700, fontSize: 11 }}>🏭 En Taller</span>;
      case '2_almacen':
        return <span className="chip" style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706', borderColor: '#f59e0b', fontWeight: 700, fontSize: 11 }}>🚚 Por Facturar</span>;
      case '3_sin_cr':
        return <span className="chip" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', borderColor: '#ef4444', fontWeight: 700, fontSize: 11 }}>🧾 Sin CR</span>;
      case '4_con_cr':
        return <span className="chip" style={{ background: 'rgba(14,165,233,0.1)', color: '#0284c7', borderColor: '#0ea5e9', fontWeight: 700, fontSize: 11 }}>⏳ En Crédito</span>;
      case '5_caja':
        return <span className="chip" style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', borderColor: '#10b981', fontWeight: 700, fontSize: 11 }}>💵 En Caja</span>;
      default:
        return null;
    }
  };

  return (
    <Card title="🚚 Seguimiento Interactivo de Pedidos — OC, Entregas y Cobranza">
      {/* Barra de Filtros Rápidos por Estación */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', marginRight: 4 }}>
          Filtrar Estación:
        </span>
        <button
          type="button"
          className={`chip ${(!filterStage && activeChip === 'ALL') ? 'active' : ''}`}
          onClick={() => handleChipClick('ALL')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          ⚡ Todas ({allRows.length})
        </button>
        <button
          type="button"
          className={`chip ${(filterStage === '1_taller' || activeChip === '1_taller') ? 'active' : ''}`}
          onClick={() => handleChipClick('1_taller')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          🏭 En Taller
        </button>
        <button
          type="button"
          className={`chip ${(filterStage === '2_almacen' || activeChip === '2_almacen') ? 'active' : ''}`}
          onClick={() => handleChipClick('2_almacen')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          🚚 Por Facturar
        </button>
        <button
          type="button"
          className={`chip ${(filterStage === '3_sin_cr' || activeChip === '3_sin_cr') ? 'active' : ''}`}
          onClick={() => handleChipClick('3_sin_cr')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          🧾 Sin CR
        </button>
        <button
          type="button"
          className={`chip ${(filterStage === '4_con_cr' || activeChip === '4_con_cr') ? 'active' : ''}`}
          onClick={() => handleChipClick('4_con_cr')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          ⏳ Con CR
        </button>
        <button
          type="button"
          className={`chip ${(filterStage === '5_caja' || activeChip === '5_caja') ? 'active' : ''}`}
          onClick={() => handleChipClick('5_caja')}
          style={{ fontSize: 12, cursor: 'pointer' }}
        >
          💵 En Caja
        </button>
      </div>

      {filteredRows.length === 0 ? (
        <Empty>No hay órdenes en esta estación del pipeline.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th className="sticky-col">Folio OC</th>
                <th>Estación Actual</th>
                <th>Factura(s)</th>
                <th>Contrarecibo (CR)</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="num" style={{ minWidth: 140 }}>Kilos y Avance</th>
                <th className="num">Total Facturado</th>
                <th className="num">Cobrado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((f) => {
                return (
                  <tr 
                    key={f.id}
                    onClick={() => onOpenOrder?.(f.order)}
                    style={{ cursor: onOpenOrder ? 'pointer' : 'default' }}
                    title="Haz clic para abrir el expediente completo"
                  >
                    <td className="mono sticky-col" style={{ fontWeight: 800 }}>
                      {f.folio}
                      {f.department && (
                        <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--paper-sunk)', padding: '1px 5px', borderRadius: 4 }}>
                          {f.department}
                        </span>
                      )}
                    </td>
                    <td>
                      {getStageBadge(f.stage, f.isClosedShort)}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {f.facturas.length > 0 ? (
                        f.facturas.map((fac, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'var(--paper-sunk)', padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>
                            #{fac}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Pendiente</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {f.contrarecibos.length > 0 ? (
                        f.contrarecibos.map((cr, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', fontWeight: 700, padding: '2px 6px', borderRadius: 4, marginRight: 4 }}>
                            {cr}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint)' }}>Sin CR</span>
                      )}
                    </td>
                    <td>{f.cliente}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(f.fecha)}</td>
                    <td className="num">
                      <KilosProgressBar
                        deliveredKg={f.kilosEntregados}
                        totalKg={f.kilosPedidos}
                        compact
                      />
                    </td>
                    <td className="num mono" style={{ fontWeight: 700 }}>{money(f.total)}</td>
                    <td className="num mono" style={{ fontWeight: 800, color: f.cobrado > 0 ? '#047857' : 'inherit' }}>
                      {money(f.cobrado)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn"
                        style={{ fontSize: 11, padding: '3px 8px', fontWeight: 700 }}
                        onClick={() => onOpenOrder?.(f.order)}
                      >
                        👁️ Abrir
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
