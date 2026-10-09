import { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useOrderModal } from './OrderModalContext';
import { toDate, fmtDayAndDate, money, kilos } from '../../lib/format';
import { Skeleton } from '../ui';

interface TimelineEvent {
  id: string;
  user: string;
  action: string;
  category: 'kilos' | 'precio' | 'estado' | 'factura' | 'entrega' | 'general';
  title: string;
  description: string;
  oldValue?: string;
  newValue?: string;
  timestamp: Date;
}

export default function TabHistorial() {
  const ctx = useOrderModal();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const order = ctx?.order;

  useEffect(() => {
    if (!order?.id) return;
    let isMounted = true;

    async function fetchLogs() {
      setLoading(true);
      try {
        const logsRef = collection(db, 'system_logs');
        // Consulta amplia para encontrar eventos de esta orden
        const q = query(
          logsRef,
          orderBy('timestamp', 'desc'),
          limit(100)
        );
        const snap = await getDocs(q);
        if (isMounted) {
          const matched = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((item: any) => {
              const det = item.details || {};
              const matchId = det.orderId === order.id || det.id === order.id;
              const matchFolio = order.folio && (det.folio === order.folio || det.oc === order.folio);
              const matchOc = order.oc && (det.oc === order.oc || det.folio === order.oc);
              return matchId || matchFolio || matchOc;
            });
          setLogs(matched);
        }
      } catch (err) {
        console.warn('No se pudieron consultar logs remotos:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchLogs();
    return () => { isMounted = false; };
  }, [order?.id, order?.folio, order?.oc]);

  // Reconstrucción combinada de línea de tiempo analítica
  const events = useMemo<TimelineEvent[]>(() => {
    if (!order) return [];
    const list: TimelineEvent[] = [];

    // 1. Logs de auditoría remotos
    for (const log of logs) {
      const ts = toDate(log.timestamp) || new Date();
      const det = log.details || {};
      let category: TimelineEvent['category'] = 'general';
      let title = log.action || 'Cambio en Expediente';
      let desc = '';
      let oldValue: string | undefined;
      let newValue: string | undefined;

      if (log.action === 'UPDATE_ORDER_PRICES' || det.customSellPrice !== undefined) {
        category = 'precio';
        title = 'Actualización de Precios';
        oldValue = det.prevSell ? `$${det.prevSell}/kg` : undefined;
        newValue = det.newSell ? `$${det.newSell}/kg` : undefined;
        desc = `Modificación de tarifa de venta o maquila por ${log.user}`;
      } else if (log.action === 'ADD_INVOICE' || log.action === 'UPDATE_INVOICE') {
        category = 'factura';
        title = `Factura #${det.folio || 'S/F'}`;
        desc = `Registro de CFDI por ${kilos(det.kilos || 0)} (${money(det.total || 0)})`;
      } else if (log.action === 'ADD_DELIVERY') {
        category = 'entrega';
        title = `Entrega en Báscula #${det.remision || 'S/N'}`;
        desc = `Pesaje físico recibido: ${kilos(det.kilos || 0)}`;
      } else {
        desc = typeof det === 'string' ? det : JSON.stringify(det);
      }

      list.push({
        id: log.id,
        user: log.user || 'Sistema',
        action: log.action,
        category,
        title,
        description: desc,
        oldValue,
        newValue,
        timestamp: ts,
      });
    }

    // 2. Hitos estructurales de la orden (Entregas y Facturas actuales)
    for (const d of order.deliveries || []) {
      const dt = toDate(d.date) || new Date();
      list.push({
        id: `deliv-${d.id || Math.random()}`,
        user: 'Operación Báscula',
        action: 'DELIVERY_CONFIRMED',
        category: 'entrega',
        title: `Remisión / Ticket Báscula #${(d as any).remision || d.docFolio || 'S/N'}`,
        description: `Material recibido en planta: ${kilos(d.kilos || 0)}. Estado: ${d.invoiced ? 'Facturado' : 'Pendiente de facturar'}.`,
        newValue: `${kilos(d.kilos || 0)}`,
        timestamp: dt,
      });
    }

    for (const inv of order.invoices || []) {
      const dt = toDate(inv.creditCycle?.issueDate || (inv as any).createdAt) || new Date();
      list.push({
        id: `inv-${inv.id || Math.random()}`,
        user: 'Facturación CFDI',
        action: 'INVOICE_ISSUED',
        category: 'factura',
        title: `Factura Fiscal #${inv.folio || 'S/F'}`,
        description: `CFDI emitido por ${kilos(inv.kilos || 0)}. Contrarecibo: ${inv.collection?.contrareciboNumber || 'En revisión (Sin CR)'}.`,
        newValue: money(inv.financials?.invoiceTotal || 0),
        timestamp: dt,
      });
    }

    // 3. Apertura de la orden
    const openDate = toDate(order.createdAt || (order as any).date) || new Date();
    list.push({
      id: `created-${order.id}`,
      user: 'Administración',
      action: 'ORDER_CREATED',
      category: 'general',
      title: `Apertura de Expediente OC #${order.folio || order.oc}`,
      description: `Orden de compra registrada con meta de ${kilos(order.totalKilograms || 0)}. Cliente: ${order.client}.`,
      timestamp: openDate,
    });

    // Ordenar cronológicamente descendente (más reciente primero)
    return list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [order, logs]);

  if (!order) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Cabecera explicativa */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 12,
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#f8fafc' }}>
            📜 Trazabilidad y Línea de Tiempo del Expediente
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8' }}>
            Registro cronológico inmutable: quién modificó importes, kilos y estados en esta orden.
          </div>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa' }}>
          {events.length} hitos registrados
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '24px 0' }}>
          <Skeleton style={{ height: 40, marginBottom: 12 }} />
          <Skeleton style={{ height: 40, marginBottom: 12 }} />
          <Skeleton style={{ height: 40 }} />
        </div>
      ) : events.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
          No hay movimientos registrados para este expediente.
        </div>
      ) : (
        <div style={{ position: 'relative', paddingLeft: 24 }}>
          {/* Línea vertical de la línea de tiempo */}
          <div
            style={{
              position: 'absolute',
              left: 7,
              top: 10,
              bottom: 10,
              width: 2,
              background: 'rgba(255, 255, 255, 0.12)',
            }}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {events.map((ev) => (
              <div key={ev.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {/* Punto en la línea de tiempo */}
                <div
                  style={{
                    position: 'absolute',
                    left: -21,
                    top: 4,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background:
                      ev.category === 'factura'
                        ? '#3b82f6'
                        : ev.category === 'entrega'
                        ? '#10b981'
                        : ev.category === 'precio'
                        ? '#f59e0b'
                        : '#94a3b8',
                    border: '2px solid #0f172a',
                  }}
                />

                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#f8fafc' }}>
                        {ev.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#94a3b8',
                        }}
                      >
                        {ev.user}
                      </span>
                    </div>

                    <div style={{ fontSize: 11.5, color: '#64748b' }}>
                      {fmtDayAndDate(ev.timestamp)} · {ev.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.4 }}>
                    {ev.description}
                  </p>

                  {(ev.oldValue || ev.newValue) && (
                    <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                      {ev.oldValue && (
                        <span style={{ color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 6px', borderRadius: 4 }}>
                          Antes: <del>{ev.oldValue}</del>
                        </span>
                      )}
                      {ev.oldValue && ev.newValue && <span style={{ color: '#94a3b8' }}>➔</span>}
                      {ev.newValue && (
                        <span style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>
                          Nuevo: {ev.newValue}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
