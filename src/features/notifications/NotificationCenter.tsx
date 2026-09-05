import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  subscribeNotifications,
  markAsRead,
  markAllAsRead,
  type NotificationItem,
} from '../../services/notificationService';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

export const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeNotifications(user?.uid || 'todos', (items) => {
      setNotifications(items);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  // Click away listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const displayedNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.read) {
      await markAsRead(item.id);
    }
    setIsOpen(false);

    if (item.actionUrl) {
      navigate(item.actionUrl);
    } else if (item.orderId) {
      navigate(`/ordenes?id=${item.orderId}`);
    } else {
      navigate('/cobranza');
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead(user?.uid || 'todos');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deadline':
        return '⏰';
      case 'overdue':
        return '🚨';
      case 'invoice':
        return '🧾';
      case 'system':
        return '⚙️';
      default:
        return '🔔';
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botón de la Campana con Badge */}
      <button
        type="button"
        className="icon-btn"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Centro de Notificaciones"
        title="Centro de Notificaciones y Alertas"
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 38,
          minHeight: 38,
          borderRadius: 10,
        }}
      >
        <span style={{ fontSize: 18 }}>🔔</span>

        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="notification-badge"
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              background: 'var(--bad)',
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 800,
              padding: '1px 5px',
              borderRadius: '10px',
              border: '2px solid var(--paper-raised)',
              lineHeight: 1.2,
              minWidth: 16,
              textAlign: 'center',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </button>

      {/* Popover / Centro de Notificaciones */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 360,
              maxWidth: '90vw',
              background: 'var(--paper-raised)',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              zIndex: 2000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Cabecera */}
            <div
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
                  Notificaciones Proactivas
                </h4>
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  {unreadCount === 0 ? 'Al día sin pendientes' : `${unreadCount} pendientes de atender`}
                </span>
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: 6,
                  }}
                >
                  Marcar todas
                </button>
              )}
            </div>

            {/* Selector de Filtros */}
            <div
              style={{
                display: 'flex',
                background: 'var(--paper-sunk)',
                padding: 4,
                margin: '8px 12px',
                borderRadius: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setFilter('unread')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: filter === 'unread' ? 700 : 500,
                  background: filter === 'unread' ? 'var(--paper-raised)' : 'transparent',
                  color: filter === 'unread' ? 'var(--ink)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                No leídas ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('all')}
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: filter === 'all' ? 700 : 500,
                  background: filter === 'all' ? 'var(--paper-raised)' : 'transparent',
                  color: filter === 'all' ? 'var(--ink)' : 'var(--ink-soft)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Todas ({notifications.length})
              </button>
            </div>

            {/* Lista de Notificaciones */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '4px 8px' }}>
              {displayedNotifications.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-faint)' }}>
                  <div style={{ fontSize: 24, marginBottom: 6 }}>✨</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>No hay notificaciones {filter === 'unread' ? 'sin leer' : ''}</div>
                  <div style={{ fontSize: 11 }}>Te avisaremos cuando haya vencimientos o eventos críticos.</div>
                </div>
              ) : (
                displayedNotifications.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      marginBottom: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 10,
                      alignItems: 'flex-start',
                      background: item.read ? 'transparent' : 'var(--accent-tint)',
                      borderLeft: item.read ? '3px solid transparent' : '3px solid var(--accent)',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontSize: 16, marginTop: 2 }}>{getTypeIcon(item.type)}</span>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: item.read ? 500 : 700,
                          color: 'var(--ink)',
                          lineHeight: 1.3,
                        }}
                      >
                        {item.message}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-faint)', marginTop: 4 }}>
                        {item.read ? 'Leída' : '⚠️ Acción requerida'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
