import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import OrderModal from './OrderModal';
import type { PurchaseOrder } from '../lib/types';

const money = (n: number) =>
  n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

interface OcGroup {
  oc: string;
  order?: PurchaseOrder;
  invoices: {
    folio: string;
    kilos: number;
    amount: number;
    cr: string;
    dueDate: Date | null;
    status: string;
    paid: boolean;
    order: PurchaseOrder;
  }[];
}

export default function OcTracking() {
  const { orders } = useOrders();
  const { config } = useConfig();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  const ocGroups = useMemo<OcGroup[]>(() => {
    const map = new Map<string, { order: PurchaseOrder; invoices: OcGroup['invoices'] }>();

    for (const order of orders) {
      const invoices = order.invoices ?? [];
      for (const inv of invoices) {
        const ocKey = inv.oc || order.oc || 'SIN-OC';
        if (!map.has(ocKey)) map.set(ocKey, { order, invoices: [] });
        const st = inv.creditCycle?.status ?? 'pending';
        map.get(ocKey)!.invoices.push({
          folio: inv.folio ?? '—',
          kilos: inv.kilos ?? 0,
          amount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0,
          cr: inv.collection?.contrareciboNumber ?? '',
          dueDate: inv.creditCycle?.dueDate?.toDate?.() ?? null,
          status: st,
          paid: st === 'paid' || st === 'collected',
          order,
        });
      }
    }

    return Array.from(map.entries())
      .map(([oc, data]) => ({ oc, order: data.order, invoices: data.invoices }))
      .sort((a, b) => {
        if (a.oc === 'SIN-OC') return 1;
        if (b.oc === 'SIN-OC') return -1;
        return a.oc.localeCompare(b.oc);
      });
  }, [orders]);

  const toggle = (oc: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(oc) ? next.delete(oc) : next.add(oc);
      return next;
    });
  };

  const totalGeneral = ocGroups.reduce(
    (acc, g) => acc + g.invoices.reduce((s, i) => s + i.amount, 0), 0
  );

  return (
    <div className="page">
      <div className="page-head">
        <h1>Seguimiento de OC</h1>
        <p>Vista por Orden de Compra — cuánto se facturó, avance de entregas y estado de cobro. Haz clic en cualquier renglón para editar el expediente.</p>
      </div>

      {/* Resumen rápido */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">OCs activas</div>
          <div className="stat-value">{ocGroups.length}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Total facturado</div>
          <div className="stat-value">{money(totalGeneral)}</div>
        </div>
        <div className="stat-card" style={{ flex: 1, minWidth: 160 }}>
          <div className="stat-label">Total facturas</div>
          <div className="stat-value">{ocGroups.reduce((s, g) => s + g.invoices.length, 0)}</div>
        </div>
      </div>

      {/* Tabla de OCs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ocGroups.map(group => {
          const totalAmt = group.invoices.reduce((s, i) => s + i.amount, 0);
          const totalKilos = group.invoices.reduce((s, i) => s + i.kilos, 0);
          const paidCount = group.invoices.filter(i => i.paid).length;
          const allPaid = paidCount === group.invoices.length;
          const nonePaid = paidCount === 0;
          const isOpen = expanded.has(group.oc);

          const statusColor = allPaid ? 'var(--ok)' : nonePaid ? 'var(--bad)' : 'var(--warn)';
          const statusLabel = allPaid ? '✅ Cobradas' : nonePaid ? '🔴 Pendientes' : `🟡 Parcial (${paidCount}/${group.invoices.length})`;

          return (
            <div
              key={group.oc}
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
              }}
            >
              {/* Cabecera del grupo */}
              <div
                onClick={() => toggle(group.oc)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 18 }}>{isOpen ? '▼' : '▶'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, fontFamily: 'monospace' }}>
                    OC: {group.oc}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {group.invoices.length} factura{group.invoices.length !== 1 ? 's' : ''} ·{' '}
                    {totalKilos.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg facturados
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{money(totalAmt)}</div>
                  <div style={{ fontSize: 12, color: statusColor, marginTop: 2 }}>{statusLabel}</div>
                </div>
              </div>

              {/* Detalle de facturas */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-alt)' }}>
                        <th style={{ padding: '8px 18px', textAlign: 'left' }}>Factura</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Kilos</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Monto</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Contrarecibo</th>
                        <th style={{ padding: '8px 12px', textAlign: 'center' }}>Vence</th>
                        <th style={{ padding: '8px 18px', textAlign: 'center' }}>Estado</th>
                        <th style={{ padding: '8px 18px', textAlign: 'center' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.invoices
                        .sort((a, b) => parseInt(a.folio) - parseInt(b.folio))
                        .map(inv => (
                          <tr
                            key={inv.folio}
                            style={{ borderTop: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => setSelectedOrder(inv.order)}
                          >
                            <td style={{ padding: '10px 18px', fontFamily: 'monospace', fontWeight: 600 }}>
                              #{inv.folio}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--muted)' }}>
                              {inv.kilos.toLocaleString('es-MX', { maximumFractionDigits: 1 })}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>
                              {money(inv.amount)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', fontSize: 12 }}>
                              {inv.cr || <span style={{ color: 'var(--muted)' }}>Sin CR</span>}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
                              {inv.dueDate
                                ? inv.dueDate.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' })
                                : '—'}
                            </td>
                            <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                              {inv.status === 'collected' ? (
                                <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✅ Recibida en Caja</span>
                              ) : inv.status === 'paid' ? (
                                <span style={{ color: 'var(--warn)', fontWeight: 600 }}>🟡 Con el Contador</span>
                              ) : (
                                <span style={{ color: 'var(--bad)', fontWeight: 600 }}>🔴 Por Cobrar</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 18px', textAlign: 'center' }}>
                              <button
                                className="btn"
                                style={{ fontSize: 11, padding: '3px 8px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrder(inv.order);
                                }}
                              >
                                ✏️ Editar Expediente
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface-alt)' }}>
                        <td style={{ padding: '10px 18px', fontWeight: 700 }}>TOTAL</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {totalKilos.toLocaleString('es-MX', { maximumFractionDigits: 1 })} kg
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>
                          {money(totalAmt)}
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedOrder && (
        <OrderModal
          order={orders.find(o => o.id === selectedOrder.id) ?? selectedOrder}
          config={config}
          onClose={() => setSelectedOrder(null)}
          initialTab="facturas"
        />
      )}
    </div>
  );
}
