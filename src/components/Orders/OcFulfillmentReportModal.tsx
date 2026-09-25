import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PurchaseOrder } from '../../lib/types';
import { kilos, money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';

interface OcFulfillmentReportModalProps {
  orders: PurchaseOrder[];
  onClose: () => void;
  onOpenOrder?: (order: PurchaseOrder) => void;
}

export const OcFulfillmentReportModal: React.FC<OcFulfillmentReportModalProps> = ({
  orders,
  onClose,
  onOpenOrder,
}) => {
  const [filterType, setFilterType] = useState<'all_closed' | 'complete' | 'shortfall' | 'all'>('all_closed');
  const [search, setSearch] = useState('');

  // Procesa todas las órdenes con sus métricas
  const orderReports = useMemo(() => {
    return (orders || [])
      .filter((o) => !o.isDeleted)
      .map((o) => {
        const itemsSum = (o.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
        const contractedKg = itemsSum > 0 ? itemsSum : (Number(o.totalKilograms) || 0);

        const deliveredKg = (o.deliveries || []).reduce((acc, d) => acc + (Number(d.kilos) || 0), 0);
        const invoicedKg = (o.invoices || []).reduce((acc, i) => acc + (Number(i.kilos) || 0), 0);

        const diffKg = contractedKg - deliveredKg;
        const shortfallKg = diffKg > 0.01 ? Number(diffKg.toFixed(2)) : 0;
        const surplusKg = diffKg < -0.01 ? Number(Math.abs(diffKg).toFixed(2)) : 0;

        const rate = contractedKg > 0 ? (deliveredKg / contractedKg) * 100 : 100;
        const fulfillmentRate = Number(rate.toFixed(2));

        const costValue = Number((shortfallKg * 38.00).toFixed(2));
        const saleValue = Number((shortfallKg * 43.00).toFixed(2));

        const isClosed = !!o.isClosedShort;
        const isComplete = fulfillmentRate >= 98.0;

        const closureReason = o.closureAudit?.closureReason || (isClosed ? (isComplete ? 'Merma normal de báscula' : 'Cierre corto acordado') : 'OC Abierta');
        const closedAt = o.closureAudit?.closedAt;

        return {
          order: o,
          folio: o.folio || o.oc || 'S/F',
          client: o.client || 'Cliente General',
          department: o.department || '',
          contractedKg,
          deliveredKg,
          invoicedKg,
          shortfallKg,
          surplusKg,
          fulfillmentRate,
          costValue,
          saleValue,
          isClosed,
          isComplete,
          closureReason,
          closureNotes: o.closureAudit?.closureNotes || '',
          closedAt,
        };
      });
  }, [orders]);

  // Filtrado
  const filteredReports = useMemo(() => {
    return orderReports.filter((item) => {
      // Filtro de pestaña
      if (filterType === 'all_closed' && !item.isClosed) return false;
      if (filterType === 'complete' && (!item.isClosed || !item.isComplete)) return false;
      if (filterType === 'shortfall' && (!item.isClosed || item.isComplete)) return false;

      // Búsqueda de texto
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesFolio = item.folio.toLowerCase().includes(q);
        const matchesClient = item.client.toLowerCase().includes(q);
        const matchesDept = item.department.toLowerCase().includes(q);
        const matchesReason = item.closureReason.toLowerCase().includes(q);
        if (!matchesFolio && !matchesClient && !matchesDept && !matchesReason) return false;
      }

      return true;
    });
  }, [orderReports, filterType, search]);

  // Métricas Globales de los reportes cerrados
  const stats = useMemo(() => {
    const closedOrders = orderReports.filter((r) => r.isClosed);
    const totalClosed = closedOrders.length;
    const totalContracted = closedOrders.reduce((sum, r) => sum + r.contractedKg, 0);
    const totalDelivered = closedOrders.reduce((sum, r) => sum + r.deliveredKg, 0);
    const totalShortfall = closedOrders.reduce((sum, r) => sum + r.shortfallKg, 0);
    const totalCostFaltante = closedOrders.reduce((sum, r) => sum + r.costValue, 0);
    const avgFulfillment = totalContracted > 0 ? (totalDelivered / totalContracted) * 100 : 100;

    const countComplete = closedOrders.filter((r) => r.isComplete).length;
    const countShortfall = closedOrders.filter((r) => !r.isComplete).length;

    return {
      totalClosed,
      totalContracted,
      totalDelivered,
      totalShortfall,
      totalCostFaltante,
      avgFulfillment,
      countComplete,
      countShortfall,
    };
  }, [orderReports]);

  // Exportar a CSV
  const handleExportCsv = () => {
    triggerHaptic('light');
    const headers = [
      'Folio OC',
      'Cliente',
      'Departamento',
      'Kilos Contratados',
      'Kilos Entregados (Báscula)',
      'Kilos Facturados',
      'Kilos Faltantes',
      '% Cumplimiento',
      'Costo Maquila Faltante ($38/kg)',
      'Valor Venta Faltante ($43/kg)',
      'Estatus Cierre',
      'Motivo Cierre',
      'Observaciones',
    ];

    const rows = filteredReports.map((r) => [
      `"${r.folio}"`,
      `"${r.client}"`,
      `"${r.department}"`,
      r.contractedKg,
      r.deliveredKg,
      r.invoicedKg,
      r.shortfallKg,
      `${r.fulfillmentRate}%`,
      r.costValue,
      r.saleValue,
      r.isClosed ? 'Concluida' : 'Abierta',
      `"${r.closureReason}"`,
      `"${r.closureNotes}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Cumplimiento_OCs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Copiar resumen de WhatsApp
  const handleShareWhatsApp = () => {
    triggerHaptic('light');
    const closed = filteredReports.filter((r) => r.isClosed);
    const lines = closed
      .map(
        (r) =>
          `• *OC ${r.folio}* (${r.client}): ${kilos(r.deliveredKg)} de ${kilos(r.contractedKg)} (${r.fulfillmentRate}%). ` +
          (r.shortfallKg > 0 ? `Faltaron ${kilos(r.shortfallKg)} (${money(r.costValue)} a $38/kg). Motivo: ${r.closureReason}` : `✅ Completa.`)
      )
      .join('\n');

    const msg =
      `*📊 INFORME DE CUMPLIMIENTO Y BALANCE DE ÓRDENES DE COMPRA*\n` +
      `_Control Bolsas ERP · ${new Date().toLocaleDateString('es-MX')}_\n\n` +
      `*Métricas Globales:*\n` +
      `• Total OCs analizadas: ${closed.length}\n` +
      `• Kilos Contratados: ${kilos(stats.totalContracted)}\n` +
      `• Kilos Entregados en Báscula: ${kilos(stats.totalDelivered)}\n` +
      `• Kilos Faltantes Acumulados: ${kilos(stats.totalShortfall)}\n` +
      `• Valor del Material No Entregado: ${money(stats.totalCostFaltante)} MXN ($38.00/kg)\n` +
      `• Tasa Promedio de Cumplimiento: ${stats.avgFulfillment.toFixed(1)}%\n\n` +
      `*Detalle por Orden:*\n` +
      `${lines}\n\n` +
      `_Reporte generado automáticamente desde el ERP._`;

    const encoded = encodeURIComponent(msg);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9998,
          padding: '16px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '1100px',
            maxHeight: '92vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px rgba(56, 189, 248, 0.1)',
            color: '#f4f4f5',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.4rem' }}>📊</span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#fafafa' }}>
                  Reporte de Cumplimiento y Kilos Faltantes de OC
                </h2>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#a1a1aa' }}>
                Auditoría histórica de kilos contratados vs entregados en báscula, mermas de pesaje y balances de finiquito.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleExportCsv}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fafafa',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: '40px',
                }}
              >
                📥 Exportar CSV
              </button>
              <button
                type="button"
                onClick={handleShareWhatsApp}
                style={{
                  background: '#25D366',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: '40px',
                }}
              >
                📲 WhatsApp
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  fontSize: '1.6rem',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* KPI Cards Globales */}
          <div
            style={{
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              background: 'rgba(0, 0, 0, 0.25)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '12px',
            }}
          >
            <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase' }}>OCs Concluidas</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#f4f4f5', marginTop: 2 }}>{stats.totalClosed} órdenes</div>
              <div style={{ fontSize: '0.7rem', color: '#10b981' }}>{stats.countComplete} completas · {stats.countShortfall} con saldo</div>
            </div>

            <div style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>Kilos Entregados</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#10b981', marginTop: 2 }}>{kilos(stats.totalDelivered)}</div>
              <div style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>de {kilos(stats.totalContracted)} contratados</div>
            </div>

            <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>Tasa Cumplimiento</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>{stats.avgFulfillment.toFixed(1)}%</div>
              <div style={{ fontSize: '0.7rem', color: '#7dd3fc' }}>Efectividad global de entrega</div>
            </div>

            <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '12px' }}>
              <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, textTransform: 'uppercase' }}>Kilos Faltantes</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ef4444', marginTop: 2 }}>{kilos(stats.totalShortfall)}</div>
              <div style={{ fontSize: '0.7rem', color: '#fca5a5' }}>{money(stats.totalCostFaltante)} a $38/kg maquila</div>
            </div>
          </div>

          {/* Filtros y Búsqueda */}
          <div
            style={{
              padding: '12px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            {/* Pestañas */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setFilterType('all_closed')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: filterType === 'all_closed' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: filterType === 'all_closed' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: filterType === 'all_closed' ? '#38bdf8' : '#a1a1aa',
                  fontWeight: filterType === 'all_closed' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                🏁 Concluidas ({stats.totalClosed})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('complete')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: filterType === 'complete' ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: filterType === 'complete' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: filterType === 'complete' ? '#10b981' : '#a1a1aa',
                  fontWeight: filterType === 'complete' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                ✅ Cumplidas ≥98% ({stats.countComplete})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('shortfall')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: filterType === 'shortfall' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: filterType === 'shortfall' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: filterType === 'shortfall' ? '#ef4444' : '#a1a1aa',
                  fontWeight: filterType === 'shortfall' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                ⚠️ Con Faltantes ({stats.countShortfall})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: filterType === 'all' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: filterType === 'all' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                  color: filterType === 'all' ? '#a855f7' : '#a1a1aa',
                  fontWeight: filterType === 'all' ? 700 : 500,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                🌐 Todas las OCs ({orderReports.length})
              </button>
            </div>

            {/* Input Buscador */}
            <input
              type="text"
              placeholder="Buscar por OC, cliente o motivo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f4f4f5',
                padding: '6px 12px',
                fontSize: '0.82rem',
                minWidth: '220px',
              }}
            />
          </div>

          {/* Tabla de Resultados */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
            {filteredReports.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#71717a' }}>
                <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>No hay órdenes que coincidan con el filtro seleccionado.</div>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', textAlign: 'left', color: '#a1a1aa' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Folio OC</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Cliente / Depto</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Contratado</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Entregado</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Facturado</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>% Cumplimiento</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'right' }}>Faltante / Merma</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700 }}>Motivo & Finiquito</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((r) => {
                    const isOk = r.fulfillmentRate >= 98.0;
                    return (
                      <tr
                        key={r.order.id}
                        style={{
                          borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '10px 10px', fontWeight: 800, color: '#fafafa' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>{r.isClosed ? '🏁' : '📄'}</span>
                            <span>{r.folio}</span>
                          </div>
                        </td>

                        <td style={{ padding: '10px 10px', color: '#d4d4d8' }}>
                          <div style={{ fontWeight: 600 }}>{r.client}</div>
                          {r.department && <div style={{ fontSize: '0.72rem', color: '#a1a1aa' }}>{r.department}</div>}
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#a1a1aa' }}>
                          {kilos(r.contractedKg)}
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: '#10b981' }}>
                          {kilos(r.deliveredKg)}
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#818cf8' }}>
                          {kilos(r.invoicedKg)}
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              background: isOk ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                              color: isOk ? '#34d399' : '#f87171',
                              border: `1px solid ${isOk ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                            }}
                          >
                            {r.fulfillmentRate}%
                          </span>
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {r.shortfallKg > 0 ? (
                            <div>
                              <div style={{ color: '#ef4444', fontWeight: 800 }}>-{kilos(r.shortfallKg)}</div>
                              <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>{money(r.costValue)} ($38)</div>
                            </div>
                          ) : r.surplusKg > 0 ? (
                            <div style={{ color: '#38bdf8', fontWeight: 700 }}>+{kilos(r.surplusKg)}</div>
                          ) : (
                            <div style={{ color: '#10b981', fontWeight: 700 }}>0 kg</div>
                          )}
                        </td>

                        <td style={{ padding: '10px 10px', fontSize: '0.78rem', color: '#a1a1aa', maxWidth: '240px' }}>
                          <div style={{ color: '#d4d4d8', fontWeight: 600 }}>{r.closureReason}</div>
                          {r.closureNotes && <div style={{ color: '#71717a', fontStyle: 'italic', marginTop: 2 }}>"{r.closureNotes}"</div>}
                        </td>

                        <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                          {onOpenOrder && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenOrder(r.order);
                              }}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#38bdf8',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Ver Expediente
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(255, 255, 255, 0.02)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#71717a' }}>
              Mostrando {filteredReports.length} de {orderReports.length} órdenes registradas.
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#d4d4d8',
                fontSize: '0.82rem',
                cursor: 'pointer',
              }}
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
