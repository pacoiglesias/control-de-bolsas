/**
 * src/hooks/useNotifications.ts - Hook de notificaciones del sistema
 */
import { useState, useCallback } from 'react';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const notify = useCallback((title: string, message: string, type: AppNotification['type'] = 'info') => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      timestamp: Date.now(),
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 19)]);
  }, []);

  const clear = useCallback((id?: string) => {
    if (id) {
      setNotifications(prev => prev.filter(n => n.id !== id));
    } else {
      setNotifications([]);
    }
  }, []);

  return { notifications, notify, clear };
}
