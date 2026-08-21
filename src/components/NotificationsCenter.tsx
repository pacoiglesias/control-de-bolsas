import React, { useState } from 'react';
import { useProactiveAlertsData } from '../hooks/useProactiveAlertsData';
import { useNavigate } from 'react-router-dom';

export function NotificationsCenter() {
  const nav = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [hasPermission, setHasPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission === 'granted' : false
  );

  // FIX (v8.9.5): el calculo de alertas se movio a un hook compartido
  // (useProactiveAlertsData) para que el menu lateral pueda usar exactamente
  // los mismos numeros sin duplicar la logica -- ver el comentario en ese
  // archivo.
  const alertsData = useProactiveAlertsData();
  const alerts = React.useMemo(
    () => alertsData.map((a) => ({ ...a, action: () => nav(a.route) })),
    [alertsData, nav]
  );

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
