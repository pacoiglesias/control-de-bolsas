import { useMemo, useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import OrderModal from './OrderModal';
import { KpiCard, Skeleton } from '../components/ui';
// money vivia duplicada aqui con su propia implementacion. Una sola.
import { money } from '../lib/format';
import type { PurchaseOrder } from '../lib/types';

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
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);

  const ocGroups = useMemo<OcGroup[]>(() => {
    const map = new Map<string, { order: PurchaseOrder; invoices: OcGroup['invoices'] }>();

    for (const order of orders) {
      // Aseguramos que la OC siempre se agregue, incluso si no tiene facturas.
      const ocKey = (order.oc || order.folio || order.id).trim();
      
      if (!map.has(ocKey)) {
        map.set(ocKey, { order, invoices: [] });
      }

      const invoices = order.invoices ?? [];
      for (const inv of invoices) {
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
        // Orden inverso (las más recientes o mayores números de OC suelen estar arriba)
        return b.oc.localeCompare(a.oc);
      });
  }, [orders]);

  const toggle = (oc: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(oc)) next.delete(oc);
      else next.add(oc);
      return next;
    });
  };

  const totalGeneral = ocGroups.reduce(
    (acc, g) => acc + g.invoices.reduce((s, i) => s + i.amount, 0), 0
  );

  // Antes esta pantalla ignoraba `loading`: durante la carga afirmaba
  // "OCs activas: 0" y "Total facturado: $0.00" como si fueran cifras reales,
  // y despues saltaba a los valores correctos moviendo todo el contenido.
  if (loading) {
    return (
      <div className="page">
        <div className="page-head">
          <Skeleton className="skeleton-row" style={{ width: 240, height: 28, marginBottom: 12 }} />
          <Skeleton className="skeleton-row" style={{ width: '60%', height: 16 }} />
        </div>
        <div className="kpi-grid">
          {[1, 2, 3].map(i => <Skeleton key={i} className="skeleton-card" style={{ height: 92 }} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="skeleton-row" style={{ height: 56 }} />)}
        </div>
      </div>
    );
  }

  if (error) return <div className="alert bad">{error}</div>;

  return (
    <div className="page">
      <div className="page-head">
        <h1>Por Orden de Compra</h1>
        <p>
          Los mismos expedientes que <strong>Expedientes</strong>, agrupados por número de OC con sus
          facturas desplegadas adentro: cuánto se facturó, avance de entregas y estado de cobro por
          Orden de Compra. Haz clic en cualquier renglón para editar el expediente.
        </p>
      </div>

      {/* Resumen rápido. Usa el mismo KpiCard que el resto del sistema: las
          clases .stat-card / .stat-label / .stat-value nunca existieron en la
          hoja de estilo, asi que estas tres tarjetas salian sin formato. */}
      <div className="kpi-grid">
        <KpiCard label="OCs activas" value={String(ocGroups.length)} />
        <KpiCard label="Total facturado" value={money(totalGeneral)} tone="cash" />
        <KpiCard
          label="Total facturas"
          value={String(ocGroups.reduce((s, g) => s + g.invoices.length, 0))}
        />
      </div>

      {/* Tabla de OCs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ocGroups.map(group => {
          const totalAmt = group.invoices.reduce((s, i) => s + i.amount, 0);
          const totalKilos = group.invoices.reduce((s, i) => s + i.kilos, 0);
          const paidCount = group.invoices.filter(i => i.paid).length;
          const allPaid = group.invoices.length > 0 && paidCount === group.invoices.length;
          const nonePaid = paidCount === 0;
          const isOpen = expanded.has(group.oc);

          let statusColor = '#3b82f6'; // info blue
          let statusLabel = '📝 Nuevo Pedido';

          if (group.invoices.length > 0) {
            statusColor = allPaid ? 'var(--ok)' : nonePaid ? 'var(--bad)' : 'var(--warn)';
            statusLabel = allPaid ? '✅ Cobradas' : nonePaid ? '🔴 Pendientes' : `🟡 Parcial (${paidCount}/${group.invoices.length})`;
          }

          const kilosPedidos = group.order?.totalKilograms ?? 0;
          const kilosEntregados = group.order?.deliveries?.reduce((a, b) => a + b.kilos, 0) ?? 0;

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
                    OC: {group.oc} {group.order?.client && <span style={{color: 'var(--muted)', fontWeight: 400, marginLeft: 8}}>{group.order.client}</span>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    <span style={{ color: 'var(--text)' }}>Pedida: {kilosPedidos.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</span>
                    {' · '}
                    <span style={{ color: kilosEntregados >= kilosPedidos && kilosPedidos > 0 ? 'var(--ok)' : 'var(--info)' }}>Entregada: {kilosEntregados.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</span>
                    {' · '}
                    <span style={{ color: totalKilos >= kilosPedidos && kilosPedidos > 0 ? 'var(--ok)' : 'var(--warn)' }}>Facturada: {totalKilos.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{money(totalAmt)}</div>
                  <div style={{ fontSize: 12, color: statusColor, marginTop: 2 }}>{statusLabel}</div>
                </div>
                <button
                  className="btn"
                  style={{ fontSize: 12, padding: '6px 12px', marginLeft: 16, background: 'var(--surface-alt)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (group.order) setSelectedOrder(group.order);
                  }}
                >
                  Ver Expediente
                </button>
              </div>

              {/* Detalle de facturas */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {group.invoices.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>
                      📝 Aún no hay facturas registradas en esta Orden de Compra. <br/>
                      <span style={{ fontSize: 12 }}>Abre el expediente para añadir entregas o facturas.</span>
                    </div>
                  ) : (
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
                                  ✏️ Editar
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
                  )}
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
