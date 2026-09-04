import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { evaluateThreeWayMatch } from '../../lib/finance';
import { kilos as fmtKilos, money } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface ThreeWayMatchWidgetProps {
  orders: PurchaseOrder[];
  onOpenOrder?: (order: PurchaseOrder) => void;
  onOpenQuickCr?: (order: PurchaseOrder, invoice?: any) => void;
}

export const ThreeWayMatchWidget: React.FC<ThreeWayMatchWidgetProps> = ({
  orders,
  onOpenOrder,
  onOpenQuickCr,
}) => {
  const matches = useMemo(() => {
    const list: Array<{
      order: PurchaseOrder;
      invoice: any;
      evalResult: ReturnType<typeof evaluateThreeWayMatch>;
    }> = [];

    orders.forEach((o) => {
      if ((o as any).isDeleted || o.isClosedShort) return;
      const invoices = o.invoices || [];
      if (invoices.length > 0) {
        invoices.forEach((inv) => {
          const evalResult = evaluateThreeWayMatch(o, inv);
          list.push({ order: o, invoice: inv, evalResult });
        });
      } else if (Array.isArray(o.deliveries) && o.deliveries.length > 0) {
        const evalResult = evaluateThreeWayMatch(o, null);
        list.push({ order: o, invoice: null, evalResult });
      }
    });

    return list;
  }, [orders]);

  const stats = useMemo(() => {
    let perfect = 0;
    let pendingCr = 0;
    let pendingInv = 0;
    let discrepancy = 0;

    matches.forEach(({ evalResult }) => {
      if (evalResult.status === 'MATCH_PERFECT') perfect++;
      else if (evalResult.status === 'PENDING_CR') pendingCr++;
      else if (evalResult.status === 'PENDING_INVOICE') pendingInv++;
      else discrepancy++;
    });

    return { perfect, pendingCr, pendingInv, discrepancy, total: matches.length };
  }, [matches]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Barra de Resumen de Conciliación */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
        }}
      >
        <div
          style={{
            background: 'var(--paper-raised)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>🛡️</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
              3-Way Match 100% Conciliado
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: '#059669' }}>
              {stats.perfect} / {stats.total} Partidas
            </div>
          </div>
        </div>

        <div
          style={{
            background: stats.pendingCr > 0 ? 'rgba(217, 119, 6, 0.08)' : 'var(--paper-raised)',
            border: stats.pendingCr > 0 ? '1px solid #d97706' : '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>⏳</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: stats.pendingCr > 0 ? '#b45309' : 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Báscula y Factura ✓ (Falta CR)
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: stats.pendingCr > 0 ? '#d97706' : 'var(--ink)' }}>
              {stats.pendingCr} en revisión
            </div>
          </div>
        </div>

        <div
          style={{
            background: stats.pendingInv > 0 ? 'rgba(37, 99, 235, 0.08)' : 'var(--paper-raised)',
            border: stats.pendingInv > 0 ? '1px solid #2563eb' : '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>⚖️</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: stats.pendingInv > 0 ? '#1d4ed8' : 'var(--ink-soft)', textTransform: 'uppercase' }}>
              En Báscula por Timbrar
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: stats.pendingInv > 0 ? '#2563eb' : 'var(--ink)' }}>
              {stats.pendingInv} partidas
            </div>
          </div>
        </div>

        <div
          style={{
            background: stats.discrepancy > 0 ? 'rgba(220, 38, 38, 0.08)' : 'var(--paper-raised)',
            border: stats.discrepancy > 0 ? '1px solid #dc2626' : '1px solid var(--line)',
            borderRadius: 12,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 24 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: stats.discrepancy > 0 ? '#b91c1c' : 'var(--ink-soft)', textTransform: 'uppercase' }}>
              Con Discrepancia
            </div>
            <div className="mono" style={{ fontSize: 18, fontWeight: 900, color: stats.discrepancy > 0 ? '#dc2626' : 'var(--ink)' }}>
              {stats.discrepancy} alertas
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de Comparación 3-Way Match */}
      <div style={{ overflowX: 'auto', background: 'var(--paper-raised)', border: '1px solid var(--line)', borderRadius: 12 }}>
        <table className="table" style={{ width: '100%', fontSize: 12.5, margin: 0 }}>
          <thead>
            <tr style={{ background: 'var(--paper-sunk)', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: '10px 14px' }}>Expediente / OC</th>
              <th style={{ padding: '10px 14px' }}>⚖️ 1. Báscula (Patio)</th>
              <th style={{ padding: '10px 14px' }}>🧾 2. Factura CFDI ($43/kg)</th>
              <th style={{ padding: '10px 14px' }}>📋 3. Contrarecibo Providencia</th>
              <th style={{ padding: '10px 14px' }}>Estatus 3-Way</th>
              <th style={{ padding: '10px 14px', textAlign: 'right' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {matches.map(({ order, invoice, evalResult }, idx) => {
              return (
                <motion.tr
                  key={`${order.id}_${invoice?.id || invoice?.folio || idx}`}
                  whileHover={{ background: 'var(--paper-sunk)' }}
                  style={{ borderBottom: '1px solid var(--line-soft)', cursor: 'pointer' }}
                  onClick={() => onOpenOrder?.(order)}
                >
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--ink)' }}>
                      {order.folio || order.oc || 'S/F'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
                      {order.client || 'Providencia'}
                    </div>
                  </td>

                  {/* 1. Báscula */}
                  <td style={{ padding: '10px 14px' }}>
                    {evalResult.hasDelivery ? (
                      <div>
                        <b style={{ color: '#059669' }}>{fmtKilos(evalResult.deliveryKg)}</b>
                        <div style={{ fontSize: 10.5, color: 'var(--ink-soft)' }}>
                          {(order.deliveries || []).length} boletas
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>0 kg</span>
                    )}
                  </td>

                  {/* 2. Factura */}
                  <td style={{ padding: '10px 14px' }}>
                    {evalResult.hasInvoice ? (
                      <div>
                        <span className="badge" style={{ background: '#2563eb', fontSize: 10 }}>
                          F-{invoice?.folio || 'S/F'}
                        </span>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink)', marginTop: 2 }}>
                          {fmtKilos(evalResult.invoiceKg)} · {money(evalResult.invoiceTotal)}
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ Sin Timbrar</span>
                    )}
                  </td>

                  {/* 3. Contrarecibo */}
                  <td style={{ padding: '10px 14px' }}>
                    {evalResult.hasCr ? (
                      <div>
                        <span
                          className="badge"
                          style={{
                            background: evalResult.crNumber.startsWith('TH') ? '#3b82f6' : '#8b5cf6',
                            fontWeight: 800,
                          }}
                        >
                          {evalResult.crNumber}
                        </span>
                        <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 600, marginTop: 2 }}>
                          ✓ Sello Confirmado
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerHaptic('light');
                          onOpenQuickCr?.(order, invoice);
                        }}
                        className="btn-small"
                        style={{
                          background: 'rgba(217, 119, 6, 0.12)',
                          border: '1px solid #d97706',
                          color: '#b45309',
                          fontWeight: 700,
                          fontSize: 11,
                          padding: '3px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        + Capturar CR
                      </button>
                    )}
                  </td>

                  {/* Estatus */}
                  <td style={{ padding: '10px 14px' }}>
                    {evalResult.status === 'MATCH_PERFECT' && (
                      <span className="badge" style={{ background: '#059669', fontSize: 11, fontWeight: 800 }}>
                        ✓ Conciliado
                      </span>
                    )}
                    {evalResult.status === 'PENDING_CR' && (
                      <span className="badge" style={{ background: '#d97706', fontSize: 11, fontWeight: 700 }}>
                        ⏳ Falta CR
                      </span>
                    )}
                    {evalResult.status === 'PENDING_INVOICE' && (
                      <span className="badge" style={{ background: '#2563eb', fontSize: 11, fontWeight: 700 }}>
                        🧾 Por Timbrar
                      </span>
                    )}
                    {evalResult.status === 'DISCREPANCY' && (
                      <span className="badge" style={{ background: '#dc2626', fontSize: 11, fontWeight: 700 }}>
                        ⚠️ Discrepancia
                      </span>
                    )}
                  </td>

                  {/* Acción */}
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn-small"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenOrder?.(order);
                      }}
                      style={{ fontSize: 11, padding: '4px 8px', fontWeight: 600 }}
                    >
                      Ver Expediente →
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
