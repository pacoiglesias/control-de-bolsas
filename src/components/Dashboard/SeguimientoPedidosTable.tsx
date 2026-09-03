import { useMemo, useState } from 'react';
import { Card, Empty } from '../ui';
import { money, fmtDate, nombreClienteVisible, toDate } from '../../lib/format';
import { getOrderSummary, extractCr, inferDepartment } from '../../lib/finance';
import { KilosProgressBar } from '../Orders/KilosProgressBar';
import { KebabMenu, type KebabMenuItem } from '../ui/KebabMenu';
import { useToast } from '../../context/ToastContext';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { generateInstitutionalEmailDraft, openInstitutionalEmail, copyToClipboard } from '../../lib/whatsappReminder';
import type { PurchaseOrder } from '../../lib/types';
import type { PipelineStageKey } from './MoneyFlowPipeline';

interface SeguimientoPedidosTableProps {
  orders: PurchaseOrder[];
  filterStage?: PipelineStageKey | null;
  onFilterStageChange?: (stage: PipelineStageKey | null) => void;
  onOpenOrder?: (order: PurchaseOrder) => void;
  onQuickInvoice?: (order: PurchaseOrder) => void;
  onQuickCollection?: (order: PurchaseOrder) => void;
}

export function SeguimientoPedidosTable({
  orders,
  filterStage,
  onFilterStageChange,
  onOpenOrder,
  onQuickInvoice,
  onQuickCollection,
}: SeguimientoPedidosTableProps) {
  const toast = useToast();
  const { settings } = useSystemSettings();
  const managerTH = settings?.managerTH || 'Nava';
  const managerGT = settings?.managerGT || 'Evelia';
  const deptNameTH = settings?.deptNameTH || 'Textil Hogar';
  const deptNameGT = settings?.deptNameGT || 'Grupo Textil';
  const [activeChip, setActiveChip] = useState<string>('ALL');

  // Determinar la estación de cada orden en el ciclo
  const getOrderStage = (o: PurchaseOrder): PipelineStageKey => {
    const s = getOrderSummary(o);
    const totalKilos = Number(o.totalKilograms) || (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0) || s.kilosDelivered;
    const kilosEntregados = s.kilosDelivered;
    const invoices = s.invoices;
    const kilosFacturados = s.kilosInvoiced;

    if (s.status === 'collected') return '5_caja';

    // 1. Si tiene entregas en báscula pendientes de facturar (Acción prioritaria: emitir CFDI)
    if (kilosEntregados > kilosFacturados + 0.01) return '2_almacen';

    // 2. Si tiene facturas sin contrarecibo
    const hasSinCr = invoices.some(inv => !extractCr(inv, o) && inv.creditCycle?.status !== 'paid' && inv.creditCycle?.status !== 'collected');
    if (hasSinCr) return '3_sin_cr';

    // 3. Si tiene contrarecibos activos en crédito
    const hasConCr = invoices.some(inv => !!extractCr(inv, o) && inv.creditCycle?.status !== 'collected');
    if (hasConCr) return '4_con_cr';

    // 4. Si faltan kilos por entregar y no está cerrada
    if (!o.isClosedShort && totalKilos > kilosEntregados + 0.01) return '1_taller';

    return '5_caja';
  };

  const allRows = useMemo(() => {
    return (orders || [])
      .filter(o => o && (!o.isClosedShort || (o.deliveries && o.deliveries.length > 0)))
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
          department: o.department || (inferDepartment(o) ?? undefined),
          fecha: o.processedAt,
          kilosPedidos: (o.items && o.items.length > 0)
            ? (o.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0)
            : (Number(o.totalKilograms) || s.kilosDelivered || 0),
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
        const ta = toDate(a.fecha)?.getTime() || 0;
        const tb = toDate(b.fecha)?.getTime() || 0;
        return tb - ta;
      });
  }, [orders]);

  // Conteo atómico por estación para los badges de la barra de segmentación
  const stageCounts = useMemo(() => {
    const counts = {
      ALL: allRows.length,
      '1_taller': 0,
      '2_almacen': 0,
      '3_sin_cr': 0,
      '4_con_cr': 0,
      '5_caja': 0,
    };
    for (const r of allRows) {
      if (counts[r.stage] !== undefined) {
        counts[r.stage]++;
      }
    }
    return counts;
  }, [allRows]);

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
    const badgeStyle: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 10px',
      borderRadius: 9999,
      fontSize: 11.5,
      fontWeight: 700,
      letterSpacing: '0.2px',
      whiteSpace: 'nowrap',
    };

    const dotStyle = (color: string): React.CSSProperties => ({
      width: 6,
      height: 6,
      borderRadius: '50%',
      backgroundColor: color,
      boxShadow: `0 0 6px ${color}`,
      flexShrink: 0,
    });

    switch (stage) {
      case '1_taller':
        return (
          <span style={{ ...badgeStyle, background: 'rgba(139, 92, 246, 0.12)', color: '#a78bfa', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <span style={dotStyle('#a78bfa')} />
            🏭 En Producción
          </span>
        );
      case '2_almacen':
        return (
          <span style={{ ...badgeStyle, background: 'rgba(245, 158, 11, 0.12)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            <span style={dotStyle('#fbbf24')} />
            🚚 Por Facturar
          </span>
        );
      case '3_sin_cr':
        return (
          <span style={{ ...badgeStyle, background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <span style={dotStyle('#f87171')} />
            🧾 Sin CR {isClosedShort ? '· Cerrada' : ''}
          </span>
        );
      case '4_con_cr':
        return (
          <span style={{ ...badgeStyle, background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
            <span style={dotStyle('#38bdf8')} />
            ⏳ En Crédito {isClosedShort ? '· Cerrada' : ''}
          </span>
        );
      case '5_caja':
        return (
          <span style={{ ...badgeStyle, background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <span style={dotStyle('#34d399')} />
            💵 En Caja
          </span>
        );
      default:
        return null;
    }
  };

  const buildKebabItems = (row: typeof allRows[0]): KebabMenuItem[] => {
    const { order, folio, facturas, contrarecibos, cliente, total } = row;
    const firstInvoice = order.invoices?.[0];
    const firstCr = contrarecibos[0] || '';
    const firstFac = facturas[0] || folio;

    return [
      {
        icon: '👁️',
        label: 'Abrir Expediente',
        sublabel: 'Detalle completo del pedido',
        tone: 'primary',
        onClick: () => onOpenOrder?.(order),
      },
      {
        icon: '🧾',
        label: facturas.length > 0 ? `Ver Factura #${firstFac}` : 'Facturar Entrega',
        sublabel: facturas.length > 0 ? `${facturas.length} factura(s)` : 'Báscula lista',
        tone: 'warn',
        onClick: () => {
          if (onQuickInvoice) onQuickInvoice(order);
          else onOpenOrder?.(order);
        },
      },
      {
        icon: '🗂️',
        label: firstCr ? `CR #${firstCr}` : 'Asignar Contrarecibo',
        sublabel: firstCr ? 'Programado con Providencia' : 'Esperando papelito',
        tone: 'accent',
        onClick: () => {
          if (onQuickCollection) onQuickCollection(order);
          else onOpenOrder?.(order);
        },
      },
      {
        icon: '💵',
        label: 'Registrar Cobro / Efectivo',
        sublabel: `Monto: ${money(total)}`,
        tone: 'success',
        onClick: () => {
          if (onQuickCollection) onQuickCollection(order);
          else onOpenOrder?.(order);
        },
      },
      {
        dividerBefore: true,
        icon: '✉️',
        label: 'Correo Institucional',
        sublabel: 'A Cuentas por Pagar Providencia',
        tone: 'accent',
        onClick: () => {
          const draft = generateInstitutionalEmailDraft({
            folioFactura: firstFac,
            contrarecibo: firstCr,
            cliente,
            monto: total,
            fechaVencimiento: firstInvoice?.creditCycle?.dueDate,
          });
          openInstitutionalEmail(draft);
        },
      },
      {
        icon: '📋',
        label: 'Copiar Texto para Correo',
        sublabel: 'Plantilla formal de cobranza',
        onClick: async () => {
          const draft = generateInstitutionalEmailDraft({
            folioFactura: firstFac,
            contrarecibo: firstCr,
            cliente,
            monto: total,
            fechaVencimiento: firstInvoice?.creditCycle?.dueDate,
          });
          await copyToClipboard(draft.body);
          toast('📋 Plantilla de correo institucional copiada al portapapeles.', 'ok');
        },
      },
    ];
  };

  const STATIONS_CONFIG = [
    { key: 'ALL', label: 'Todas', icon: '⚡' },
    { key: '1_taller', label: 'En Producción', icon: '🏭' },
    { key: '2_almacen', label: 'Por Facturar', icon: '🚚' },
    { key: '3_sin_cr', label: 'Sin CR', icon: '🧾' },
    { key: '4_con_cr', label: 'En Crédito', icon: '⏳' },
    { key: '5_caja', label: 'En Caja', icon: '💵' },
  ];

  return (
    <Card title={`🚚 Seguimiento Interactivo de Pedidos — OC, Entregas y Cobranza (${filteredRows.length}${filteredRows.length !== allRows.length ? ` de ${allRows.length}` : ''})`}>
      {/* Barra de Filtros Segmentada Estilo Linear / Vercel */}
      <div 
        role="tablist"
        aria-label="Filtrar por estación del pipeline"
        style={{ 
          display: 'flex', 
          gap: 6, 
          marginBottom: 18, 
          flexWrap: 'wrap', 
          alignItems: 'center',
          background: 'var(--paper-sunk, rgba(0,0,0,0.25))',
          padding: 6,
          borderRadius: 14,
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
        }}
      >
        {STATIONS_CONFIG.map((st) => {
          const isActive = (!filterStage && activeChip === 'ALL' && st.key === 'ALL') ||
                           (filterStage === st.key || activeChip === st.key);
          const count = stageCounts[st.key as keyof typeof stageCounts] || 0;

          return (
            <button
              key={st.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleChipClick(st.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
                minHeight: 44,
                borderRadius: 10,
                border: isActive ? '1px solid var(--accent, #7c3aed)' : '1px solid transparent',
                background: isActive 
                  ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.25) 0%, rgba(109, 40, 217, 0.35) 100%)' 
                  : 'transparent',
                color: isActive ? '#fff' : 'var(--ink-soft, rgba(255,255,255,0.65))',
                fontSize: 12.5,
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{st.icon}</span>
              <span>{st.label}</span>
              <span 
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 9999,
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: isActive ? '#fff' : 'var(--ink-faint, rgba(255,255,255,0.45))',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredRows.length === 0 ? (
        <Empty>No hay órdenes en esta estación del pipeline.</Empty>
      ) : (
        <div className="table-scroll">
          <table className="data-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 2px' }}>
            <thead>
              <tr>
                <th className="sticky-col">Folio OC</th>
                <th>Estación Actual</th>
                <th>Factura(s)</th>
                <th>Contrarecibo (CR)</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th className="num" style={{ minWidth: 150 }}>Kilos y Avance</th>
                <th className="num">Total Facturado</th>
                <th className="num">Cobrado</th>
                <th style={{ width: 88, textAlign: 'center' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((f) => {
                const isTH = f.department === 'TH';
                const isGT = f.department === 'GT';

                return (
                  <tr 
                    key={f.id}
                    onClick={() => onOpenOrder?.(f.order)}
                    style={{ 
                      cursor: onOpenOrder ? 'pointer' : 'default',
                      transition: 'background 0.15s ease',
                    }}
                    title="Haz clic para abrir el expediente completo"
                  >
                    <td className="mono sticky-col" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                        <span>{f.folio}</span>
                        {f.department ? (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 800,
                              background: isTH ? 'rgba(2, 132, 199, 0.15)' : isGT ? 'rgba(16, 185, 129, 0.15)' : 'var(--paper-sunk)',
                              color: isTH ? '#38bdf8' : isGT ? '#34d399' : 'var(--ink-soft)',
                              border: `1px solid ${isTH ? 'rgba(2, 132, 199, 0.35)' : isGT ? 'rgba(16, 185, 129, 0.35)' : 'transparent'}`,
                              padding: '2px 6px',
                              borderRadius: 6,
                              letterSpacing: '0.2px',
                            }}
                            title={isTH ? `${deptNameTH} — Responsable: ${managerTH}` : isGT ? `${deptNameGT} — Responsable: ${managerGT}` : f.department}
                          >
                            {isTH ? `TH · ${managerTH}` : isGT ? `GT · ${managerGT}` : f.department}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      {getStageBadge(f.stage, f.isClosedShort)}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                      {f.facturas.length > 0 ? (
                        f.facturas.map((fac, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'var(--paper-sunk, rgba(255,255,255,0.06))', border: '1px solid var(--border, rgba(255,255,255,0.1))', padding: '2px 7px', borderRadius: 6, marginRight: 4, fontWeight: 700 }}>
                            #{fac}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint, rgba(255,255,255,0.3))', fontSize: 11 }}>Pendiente</span>
                      )}
                    </td>
                    <td className="mono" style={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                      {f.contrarecibos.length > 0 ? (
                        f.contrarecibos.map((cr, idx) => (
                          <span key={idx} style={{ display: 'inline-block', background: 'rgba(217, 119, 6, 0.15)', border: '1px solid rgba(217, 119, 6, 0.35)', color: '#fbbf24', fontWeight: 800, padding: '2px 7px', borderRadius: 6, marginRight: 4 }}>
                            {cr}
                          </span>
                        ))
                      ) : (
                        <span style={{ color: 'var(--ink-faint, rgba(255,255,255,0.3))', fontSize: 11 }}>Sin CR</span>
                      )}
                    </td>
                    <td style={{ fontSize: 12 }}>{f.cliente}</td>
                    <td style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontVariantNumeric: 'tabular-nums' }}>{fmtDate(f.fecha)}</td>
                    <td className="num">
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <KilosProgressBar
                          deliveredKg={f.kilosEntregados}
                          totalKg={f.kilosPedidos}
                          compact
                        />
                        <span style={{ fontSize: 10.5, color: 'var(--ink-soft)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                          {f.kilosEntregados === 0 
                            ? `🏭 ${f.kilosPedidos.toLocaleString('es-MX')} kg en producción` 
                            : f.isClosedShort
                              ? `✅ ${f.kilosEntregados.toLocaleString('es-MX')} kg entregados (Concluida)`
                              : f.kilosEntregados < f.kilosPedidos 
                                ? `🚚 ${f.kilosEntregados.toLocaleString('es-MX')} kg (${(f.kilosPedidos - f.kilosEntregados).toLocaleString('es-MX')} kg faltan)` 
                                : `✅ ${f.kilosEntregados.toLocaleString('es-MX')} kg entregados`
                          }
                        </span>
                      </div>
                    </td>
                    <td className="num mono" style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(f.total)}</td>
                    <td className="num mono" style={{ fontWeight: 800, color: f.cobrado > 0 ? '#34d399' : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                      {money(f.cobrado)}
                    </td>
                    <td onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <button
                          type="button"
                          className="btn"
                          style={{ 
                            minWidth: 44, 
                            minHeight: 36, 
                            fontSize: 13, 
                            padding: '4px 8px', 
                            fontWeight: 800,
                            borderRadius: 8,
                          }}
                          onClick={() => onOpenOrder?.(f.order)}
                          title="Abrir expediente completo"
                          aria-label={`Abrir expediente ${f.folio}`}
                        >
                          👁️
                        </button>
                        <KebabMenu
                          items={buildKebabItems(f)}
                          align="right"
                          title="Menú de Acciones Rápidas"
                        />
                      </div>
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
