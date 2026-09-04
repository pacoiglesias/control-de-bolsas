/**
 * 📦 Cola de Mutaciones Fuera de Línea (Offline Queue & Retry Engine)
 * Almacena localmente las acciones realizadas sin conexión (ej. en patio o báscula)
 * y las procesa automáticamente con reintentos exponenciales al recuperar la red.
 */

export interface QueuedAction {
  id: string;
  type: 'delivery' | 'expense' | 'invoice_status' | 'general';
  payload: Record<string, any>;
  createdAt: number;
  attempts: number;
  lastAttempt?: number;
  status: 'pending' | 'processing' | 'failed' | 'synced';
}

const OFFLINE_QUEUE_KEY = 'cb_offline_mutation_queue_v1';

export function getQueuedActions(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveQueuedActions(actions: QueuedAction[]): void {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(actions));
  } catch {
    // LocalStorage full
  }
}

export function enqueueAction(type: QueuedAction['type'], payload: Record<string, any>): QueuedAction {
  const actions = getQueuedActions();
  const newAction: QueuedAction = {
    id: `queue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    status: 'pending',
  };
  actions.push(newAction);
  saveQueuedActions(actions);
  return newAction;
}

export function markActionStatus(id: string, status: QueuedAction['status']): void {
  const actions = getQueuedActions().map((a) => {
    if (a.id === id) {
      return {
        ...a,
        status,
        attempts: a.attempts + 1,
        lastAttempt: Date.now(),
      };
    }
    return a;
  });
  saveQueuedActions(actions);
}

export function removeQueuedAction(id: string): void {
  const actions = getQueuedActions().filter((a) => a.id !== id);
  saveQueuedActions(actions);
}

export function getPendingQueueCount(): number {
  return getQueuedActions().filter((a) => a.status === 'pending' || a.status === 'processing').length;
}
