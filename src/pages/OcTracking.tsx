import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOrders } from '../hooks/useOrders';
import { useConfig } from '../hooks/useConfig';
import { useSystemSettings } from '../hooks/useSystemSettings';
import OrderModal from './OrderModal';
import { KpiCard, Skeleton, ProgressBar } from '../components/ui';
import { useToast } from '../context/ToastContext';
// money vivia duplicada aqui con su propia implementacion. Una sola.
import { escapeHtml, money, getPrintHeaderHtml, shareHtmlAsPdf } from '../lib/format';
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
  const toast = useToast();
  const { orders, loading, error } = useOrders();
  const { config } = useConfig();
  const { settings } = useSystemSettings();
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

  function getManifiestoHtml(pendingOrders: any[]) {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Manifiesto de Entregas</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 20px; color: #0f172a; font-size: 13px; line-height: 1.5; background: #fff; }
            table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
            tr:last-child td { border-bottom: none; }
            tr:nth-child(even) { background-color: #fafaf9; }
            .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
            .check-box { width: 20px; height: 20px; border: 2px solid #cbd5e1; border-radius: 4px; display: inline-block; }
            .signatures { display: flex; justify-content: space-between; margin-top: 80px; text-align: center; font-weight: 600; color: #475569; }
            .sig-box { border-top: 1px solid #94a3b8; width: 250px; padding-top: 10px; }
          </style>
        </head>
        <body>
          ${getPrintHeaderHtml(settings, "Manifiesto de Entregas (Chofer / Logística)")}
          
          <h3 style="margin-top: 20px;">Órdenes Pendientes de Entregar (${pendingOrders.length})</h3>
          <table>
            <thead>
              <tr>
                <th>OC</th><th>Cliente</th><th class="num">Pedida (kg)</th><th class="num">Entregada (kg)</th><th class="num">Faltante (kg)</th><th style="width: 80px; text-align: center;">Completado</th>
              </tr>
            </thead>
            <tbody>
              ${pendingOrders.length > 0 ? pendingOrders.map(g => {
                const pedidos = g.order?.totalKilograms ?? 0;
                const hasCR = g.invoices.length > 0 && g.invoices.every((i: any) => i.cr);
                const faltante = hasCR ? 0 : pedidos;
                return `
                  <tr>
                    <td><strong>${escapeHtml(g.oc)}</strong></td>
                    <td>${escapeHtml(g.order?.client || '—')}</td>
                    <td class="num">${pedidos.toLocaleString('es-MX')}</td>
                    <td class="num">${hasCR ? '✅ Entregado' : '⏳ Pendiente'}</td>
                    <td class="num" style="color: #b91c1c; font-weight: bold;">${hasCR ? '0' : faltante.toLocaleString('es-MX')}</td>
                    <td style="text-align: center;"><div class="check-box"></div></td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="6" style="text-align: center; padding: 20px;">No hay órdenes pendientes de entrega</td></tr>'}
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">Firma de Salida (Almacén)</div>
            <div class="sig-box">Firma de Entrega (Chofer)</div>
          </div>

          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
  }

  function printManifiesto() {
    const pendingOrders = ocGroups.filter(g => {
      if (g.invoices.length === 0) return true; // Sin facturas = pendiente de entrega
      // Si alguna factura NO tiene contrarecibo, significa que falta entregar evidencia/material
      return g.invoices.some(inv => !inv.cr);
    });

    const html = getManifiestoHtml(pendingOrders);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function shareManifiesto() {
    const pendingOrders = ocGroups.filter(g => {
      if (g.invoices.length === 0) return true;
      return g.invoices.some(inv => !inv.cr);
    });

    const html = getManifiestoHtml(pendingOrders);
    toast('Generando PDF, por favor espera...', 'ok');
    await shareHtmlAsPdf(html, `Manifiesto_${new Date().toISOString().split('T')[0]}.pdf`);
  }

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
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn" style={{ background: '#334155', color: '#fff', borderColor: '#334155', fontWeight: 600 }} onClick={shareManifiesto}>
              <span className="icon">📤</span> Compartir PDF
            </button>
            <button className="btn" style={{ background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }} onClick={printManifiesto}>
              📈 Imprimir Manifiesto
            </button>
          </div>
        </div>
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
          const hasCR = group.invoices.length > 0 && group.invoices.every((i: any) => i.cr);

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
                    <span style={{ color: hasCR ? 'var(--ok)' : 'var(--warn)' }}>Logística: {hasCR ? '✅ CR Recibido (Entregado)' : '🚚 Pendiente de Entrega'}</span>
                    {' · '}
                    <span style={{ color: totalKilos >= kilosPedidos && kilosPedidos > 0 ? 'var(--ok)' : 'var(--info)' }}>Facturada: {totalKilos.toLocaleString('es-MX', { maximumFractionDigits: 0 })} kg</span>
                  </div>
                  {kilosPedidos > 0 && (
                    <div style={{ marginTop: 8, maxWidth: 300 }}>
                      <ProgressBar current={totalKilos} max={kilosPedidos} color={totalKilos >= kilosPedidos ? 'var(--ok)' : 'var(--accent)'} />
                    </div>
                  )}
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
              <AnimatePresence>
                {isOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ borderTop: '1px solid var(--border)', overflow: 'hidden' }}
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
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
