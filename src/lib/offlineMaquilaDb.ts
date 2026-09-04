/**
 * offlineMaquilaDb.ts
 *
 * Base de datos IndexedDB robusta y tipada para la cola de entregas offline
 * del Portal Maquilador (Andrés).
 *
 * Ventajas sobre localStorage:
 * - Persistencia ilimitada y asíncrona (sin bloquear el hilo principal de UI).
 * - No se borra aleatoriamente por presiones de caché en Safari/Chrome móvil.
 * - Soporta seguimiento de intentos de reintento (exponential backoff) y metadatos.
 * - Incluye migración transparente de entregas antiguas en localStorage.
 */

export interface OfflineDeliveryItem {
  id: string;
  orderId: string;
  folio: string;
  productDescription: string;
  kilos: number;
  docType: 'remision' | 'factura';
  docFolio?: string | null;
  notes?: string | null;
  status?: string;
  createdAt: number;
  retryCount?: number;
  lastError?: string;
}

const DB_NAME = 'ControlBolsasOffline';
const DB_VERSION = 1;
const STORE_NAME = 'maquilaQueue';
const LEGACY_STORAGE_KEY = 'control_bolsas_maquila_offline_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible en este entorno'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('orderId', 'orderId', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Error al abrir IndexedDB'));
  });
}

/**
 * Encola una nueva entrega en IndexedDB.
 */
export async function enqueueOfflineDelivery(item: Omit<OfflineDeliveryItem, 'id' | 'createdAt' | 'retryCount'> & { id?: string }): Promise<OfflineDeliveryItem> {
  const db = await openDB();
  const deliveryRecord: OfflineDeliveryItem = {
    id: item.id || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    orderId: item.orderId,
    folio: item.folio,
    productDescription: item.productDescription,
    kilos: Number(item.kilos) || 0,
    docType: item.docType || 'remision',
    docFolio: item.docFolio || null,
    notes: item.notes || null,
    status: item.status || 'pending',
    createdAt: Date.now(),
    retryCount: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(deliveryRecord);

    req.onsuccess = () => resolve(deliveryRecord);
    req.onerror = () => reject(req.error || new Error('No se pudo guardar la entrega offline'));
  });
}

/**
 * Obtiene todas las entregas pendientes encoladas ordenadas cronológicamente.
 */
export async function getPendingOfflineDeliveries(): Promise<OfflineDeliveryItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const items = (req.result as OfflineDeliveryItem[]) || [];
        items.sort((a, b) => a.createdAt - b.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error || new Error('No se pudieron leer las entregas offline'));
    });
  } catch (err) {
    console.warn('Fallo leyendo IndexedDB, intentando fallback de localStorage', err);
    return getLegacyLocalStorageDeliveries();
  }
}

/**
 * Elimina una entrega de la cola tras sincronizarse con éxito.
 */
export async function removeOfflineDelivery(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(id);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Error al eliminar entrega offline'));
    });
  } catch (err) {
    console.warn('Error eliminando de IndexedDB', err);
  }
}

/**
 * Actualiza el contador de reintentos y el último error de un elemento encolado.
 */
export async function updateOfflineDeliveryRetry(id: string, errorMessage: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(id);

      req.onsuccess = () => {
        const item = req.result as OfflineDeliveryItem | undefined;
        if (item) {
          item.retryCount = (item.retryCount || 0) + 1;
          item.lastError = errorMessage;
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error actualizando reintento en IndexedDB', err);
  }
}

/**
 * Limpia todas las entregas en cola.
 */
export async function clearAllOfflineDeliveries(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => {
        try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) { void e; }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    try { localStorage.removeItem(LEGACY_STORAGE_KEY); } catch (e) { void e; }
    void err;
  }
}

/**
 * Migra de forma transparente cualquier elemento que haya quedado en el antiguo localStorage.
 */
export async function migrateLegacyLocalStorageQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    const legacyStr = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyStr) return;
    const items = JSON.parse(legacyStr);
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        await enqueueOfflineDelivery({
          orderId: item.orderId,
          folio: item.folio,
          productDescription: item.productDescription,
          kilos: item.kilos,
          docType: item.docType || 'remision',
          docFolio: item.docFolio,
          notes: item.notes,
          status: item.status,
        });
      }
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      console.info(`[OfflineDB] Migradas ${items.length} entregas de localStorage a IndexedDB`);
    }
  } catch (e) {
    console.warn('Error al migrar cola legacy de localStorage', e);
  }
}

function getLegacyLocalStorageDeliveries(): OfflineDeliveryItem[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
