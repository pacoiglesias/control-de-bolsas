import React, { useState } from 'react';
import { useOrders } from '../hooks/useOrders';
import { getOrderSummary } from '../lib/finance';
import { toDate, money } from '../lib/format';
import { useNavigate } from 'react-router-dom';

export function NotificationsCenter() {
  const { orders } = useOrders();
  const nav = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  // Calcular alertas activas
  const alerts = React.useMemo(() => {
    const list: { id: string; title: string; desc: string; type: 'bad' | 'warn' | 'info'; action: () => void }[] = [];

    orders.forEach((o) => {
      const summary = getOrderSummary(o);
      const oc = o.folio || o.oc || 'S/F';

      // 1. Contrarecibos vencidos
      (o.invoices || []).forEach((inv) => {
        if (inv.creditCycle.status === 'overdue') {
          list.push({
            id: `venc_${inv.id}`,
            title: `Contrarecibo Vencido - ${oc}`,
            desc: `Factura #${inv.folio} (${money(inv.financials?.invoiceTotal)}) con fecha vencida.`,
            type: 'bad',
            action: () => nav('/cobranza'),
          });
        }

        // 2. Facturas sin CR emitidas hace más de 3 días
        const cr = (inv.collection?.contrareciboNumber || '').trim();
        if (!cr && inv.creditCycle.status !== 'collected') {
          const dIssue = toDate(inv.creditCycle.issueDate);
          if (dIssue) {
            const dias = Math.round((Date.now() - dIssue.getTime()) / (1000 * 60 * 60 * 24));
            if (dias >= 3) {
              list.push({
                id: `sincr_${inv.id}`,
                title: `Sin Contrarecibo (${dias} días) - ${oc}`,
                desc: `Factura #${inv.folio} esperando número de CR de Providencia.`,
                type: 'warn',
                action: () => nav('/cobranza'),
              });
            }
          }
        }
      });

      // 3. Kilos entregados por Andrés pendientes de facturar
      if (summary.kilosDelivered > summary.kilosInvoiced + 0.01) {
        const porFacturar = Math.round(summary.kilosDelivered - summary.kilosInvoiced);
        list.push({
          id: `deliv_${o.id}`,
          title: `Entregas por Facturar - ${oc}`,
          desc: `${porFacturar.toLocaleString('es-MX')} kg entregados por Andrés listos para emitir CFDI.`,
          type: 'info',
          action: () => nav('/ordenes'),
        });
      }
    });

    return list;
  }, [orders, nav]);

  const requestPushPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setHasPermission(perm === 'granted');
      if (perm === 'granted') {
        new Notification('🔔 Notificaciones Activadas', {
          body: 'Recibirás avisos de contrarecibos vencidos y entregas en tiempo real.',
          icon: '/logo.png',
        });
      }
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="icon-btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Centro de Notificaciones"
        title="Centro de Alertas y Notificaciones"
        style={{ position: 'relative' }}
      >
        🔔
        {alerts.length > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'var(--bad)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              width: 16,
              height: 16,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {alerts.length > 9 ? '9+' : alerts.length}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 320,
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: 14,
              boxShadow: 'var(--shadow-lg)',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--paper-sunk)',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>
                Alertas Proactivas ({alerts.length})
              </span>
              {!hasPermission && 'Notification' in window && (
                <button
                  className="btn"
                  style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={requestPushPermission}
                >
                  Activar Push
                </button>
              )}
            </div>

            <div style={{ maxHeight: 360, overflowY: 'auto', padding: 8 }}>
              {alerts.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-soft)', fontSize: 12 }}>
                  🎉 Todo al día. No hay alertas pendientes.
                </div>
              ) : (
                alerts.slice(0, 10).map((a) => (
                  <div
                    key={a.id}
                    onClick={() => {
                      setIsOpen(false);
                      a.action();
                    }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      marginBottom: 6,
                      cursor: 'pointer',
                      background:
                        a.type === 'bad'
                          ? 'rgba(239,68,68,0.08)'
                          : a.type === 'warn'
                          ? 'rgba(245,158,11,0.08)'
                          : 'rgba(59,130,246,0.08)',
                      borderLeft: `3px solid ${
                        a.type === 'bad' ? 'var(--bad)' : a.type === 'warn' ? 'var(--warn)' : 'var(--info)'
                      }`,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ink)' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 2 }}>{a.desc}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
