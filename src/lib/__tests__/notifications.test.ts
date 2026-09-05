import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
} from '../../services/notificationService';

describe('Mejora 3: Notificaciones Proactivas y Centro de Alertas', () => {
  const testUserId = 'user_test_notif';

  beforeEach(() => {
    const store: Record<string, string> = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v);
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };
    vi.clearAllMocks();
  });

  it('obtiene notificaciones con fallback local en caso de entorno de pruebas o desconexión', async () => {
    const list = await getNotifications(testUserId);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0]).toHaveProperty('message');
    expect(list[0]).toHaveProperty('read');
  });

  it('crea una nueva notificación y la persiste en caché', async () => {
    const notifId = await createNotification(
      testUserId,
      'OC OC-50123 vence en 2 días',
      'deadline',
      'ord_50123'
    );

    expect(notifId).toBeDefined();

    const list = await getNotifications(testUserId);
    const created = list.find((n) => n.id === notifId);
    expect(created).toBeDefined();
    expect(created?.message).toContain('OC-50123');
    expect(created?.read).toBe(false);
  });

  it('marca una notificación como leída correctamente', async () => {
    const notifId = await createNotification(
      testUserId,
      'Factura F-9901 entregada a revisión',
      'invoice',
      'ord_9901'
    );

    await markAsRead(notifId);

    const list = await getNotifications(testUserId);
    const item = list.find((n) => n.id === notifId);
    expect(item?.read).toBe(true);
  });

  it('marca todas las notificaciones como leídas en lote', async () => {
    await createNotification(testUserId, 'Alerta 1', 'deadline');
    await createNotification(testUserId, 'Alerta 2', 'deadline');

    await markAllAsRead(testUserId);

    const list = await getNotifications(testUserId);
    const unread = list.filter((n) => !n.read);
    expect(unread).toHaveLength(0);
  });
});
