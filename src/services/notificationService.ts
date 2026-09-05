import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  addDoc,
  serverTimestamp,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';

export interface NotificationItem {
  id: string;
  userId: string;
  message: string;
  type: 'deadline' | 'system' | 'invoice' | 'overdue' | string;
  read: boolean;
  orderId?: string;
  createdAt?: any;
  actionUrl?: string;
}

const LOCAL_NOTIFICATIONS_KEY = 'cb_local_notifications_cache';

export const getNotifications = async (userId: string): Promise<NotificationItem[]> => {
  if (!userId) return getLocalNotifications();

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [userId, 'todos']),
      orderBy('createdAt', 'desc'),
      limit(30)
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as NotificationItem[];

    saveLocalNotifications(items);
    return items;
  } catch (error) {
    console.warn('[notificationService] Error al consultar Firestore:', error);
    return getLocalNotifications();
  }
};

export const subscribeNotifications = (
  userId: string,
  callback: (notifications: NotificationItem[]) => void
) => {
  if (!userId) {
    callback(getLocalNotifications());
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [userId, 'todos']),
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as NotificationItem[];
        saveLocalNotifications(items);
        callback(items);
      },
      (error) => {
        console.warn('[notificationService] Listener error, usando fallback local:', error);
        callback(getLocalNotifications());
      }
    );
  } catch (err) {
    console.warn('[notificationService] Error iniciando listener:', err);
    callback(getLocalNotifications());
    return () => {};
  }
};

export const markAsRead = async (notificationId: string): Promise<void> => {
  if (!notificationId) return;

  // Actualizar caché local
  const current = getLocalNotifications();
  const updated = current.map((n) => (n.id === notificationId ? { ...n, read: true } : n));
  saveLocalNotifications(updated);

  try {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, {
      read: true,
      readAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn('[notificationService] Error al marcar como leída:', err);
  }
};

export const markAllAsRead = async (userId: string): Promise<void> => {
  const current = getLocalNotifications();
  const updated = current.map((n) => ({ ...n, read: true }));
  saveLocalNotifications(updated);

  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', 'in', [userId || 'todos', 'todos']),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.docs.forEach((d) => {
      batch.update(d.ref, { read: true, readAt: serverTimestamp() });
    });
    await batch.commit();
  } catch (err) {
    console.warn('[notificationService] Error al marcar todas como leídas:', err);
  }
};

export const createNotification = async (
  userId: string,
  message: string,
  type: string = 'deadline',
  orderId?: string
): Promise<string> => {
  const newItem: NotificationItem = {
    id: `notif_${Date.now()}`,
    userId: userId || 'todos',
    message,
    type,
    read: false,
    orderId,
    createdAt: new Date(),
  };

  const current = getLocalNotifications();
  saveLocalNotifications([newItem, ...current]);

  try {
    const docRef = await addDoc(collection(db, 'notifications'), {
      userId: userId || 'todos',
      message,
      type,
      read: false,
      orderId: orderId || null,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (err) {
    console.warn('[notificationService] Error al crear notificación en Firestore:', err);
    return newItem.id;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers de caché local
// ────────────────────────────────────────────────────────────────────────────

function getLocalNotifications(): NotificationItem[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const data = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch {
    // Ignore storage issues
  }
  return [
    {
      id: 'notif_default_1',
      userId: 'todos',
      message: 'OC OC-10024 vence en 3 días (Cobranza Providencia)',
      type: 'deadline',
      read: false,
      orderId: 'ord_sample_1',
      createdAt: new Date(),
    },
    {
      id: 'notif_default_2',
      userId: 'todos',
      message: 'Factura F-6198 validada y lista para contrarecibo',
      type: 'invoice',
      read: false,
      orderId: 'ord_sample_2',
      createdAt: new Date(Date.now() - 3600000),
    },
  ];
}

function saveLocalNotifications(items: NotificationItem[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(items.slice(0, 50)));
    }
  } catch {
    // Ignore quota issues
  }
}
