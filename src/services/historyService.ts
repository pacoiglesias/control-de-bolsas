import { collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface HistoryRecord<T = any> {
  id?: string;
  userId: string;
  type: 'cliente' | 'proveedor' | 'producto' | string;
  item: T;
  lastUsed: any;
}

const LOCAL_STORAGE_PREFIX = 'cb_history_cache_';

/**
 * Obtiene los últimos 5 elementos utilizados por el usuario en una categoría específica.
 * Consulta Firestore con fallback a caché local en caso de error o modo offline.
 */
export const getLastUsed = async (
  userId: string,
  type: 'cliente' | 'proveedor' | 'producto' | string
): Promise<any[]> => {
  if (!userId) return getLocalHistory(userId, type);

  try {
    const q = query(
      collection(db, 'history'),
      where('userId', '==', userId),
      where('type', '==', type),
      orderBy('lastUsed', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(q);
    const results = snapshot.docs.map(doc => {
      const data = doc.data();
      return data.item ?? data;
    });

    if (results.length > 0) {
      saveLocalHistory(userId, type, results);
      return results;
    }

    // Si Firestore no tiene registros aún, intentar caché local o defaults
    return getLocalHistory(userId, type);
  } catch (error) {
    console.warn(`[historyService] Error al consultar Firestore para ${type}:`, error);
    return getLocalHistory(userId, type);
  }
};

/**
 * Registra un elemento en el historial del usuario para alimentar el prellenado inteligente.
 */
export const addHistory = async (userId: string, type: string, item: any): Promise<void> => {
  if (!item || !userId) return;

  // Actualizar caché local de inmediato
  updateLocalHistoryItem(userId, type, item);

  try {
    await addDoc(collection(db, 'history'), {
      userId,
      type,
      item,
      lastUsed: new Date(),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.warn(`[historyService] Error al guardar historial en Firestore:`, error);
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Helpers de caché local y sugerencias por omisión
// ────────────────────────────────────────────────────────────────────────────

function getStorageKey(userId: string, type: string) {
  return `${LOCAL_STORAGE_PREFIX}${userId || 'anon'}_${type}`;
}

export function saveLocalHistory(userId: string, type: string, items: any[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(getStorageKey(userId, type), JSON.stringify(items.slice(0, 5)));
    }
  } catch {
    // Ignore quota errors
  }
}

export function getLocalHistory(userId: string, type: string): any[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(getStorageKey(userId, type));
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }
  return getDefaultSuggestions(type);
}

export function updateLocalHistoryItem(userId: string, type: string, item: any) {
  try {
    const current = getLocalHistory(userId, type);
    const identifier = getItemKey(item);
    const filtered = current.filter(existing => getItemKey(existing) !== identifier);
    const updated = [item, ...filtered].slice(0, 5);
    saveLocalHistory(userId, type, updated);
  } catch {
    // Ignore storage issues
  }
}

function getItemKey(item: any): string {
  if (typeof item === 'string') return item.trim().toLowerCase();
  if (!item) return '';
  return String(item.id || item.name || item.razonSocial || item.description || JSON.stringify(item)).toLowerCase();
}

export function getDefaultSuggestions(type: string): any[] {
  switch (type) {
    case 'cliente':
      return [
        { id: 'prov_th', name: 'GRUPO TEXTIL PROVIDENCIA (TH - José Nava Flores)', department: 'TH', contact: 'José Nava Flores' },
        { id: 'prov_gt', name: 'GRUPO TEXTIL PROVIDENCIA (P4 - Evelia)', department: 'GT', contact: 'Evelia' },
        { id: 'textil_hogar', name: 'TEXTIL HOGAR S.A. DE C.V.', department: 'TH' },
        { id: 'protec', name: 'PROTEC TEXTIL', department: 'GT' }
      ];
    case 'proveedor':
      return [
        { id: 'andres', name: 'Andrés Gutiérrez (Maquila y Resina)', contact: 'Andrés' },
        { id: 'maquilas_centro', name: 'Maquilas del Centro', contact: 'Ing. Morales' },
        { id: 'polietilenos_mex', name: 'Polietilenos Mexicanos S.A.', contact: 'Ventas' },
        { id: 'dist_polimeros', name: 'Distribuidora de Polímeros', contact: 'Logística' }
      ];
    case 'producto':
      return [
        { id: 'prod_1', name: 'Bolsa de Polietileno Transparente en Rollo (Cal. 120)', unitPrice: 43.0, cal: 120 },
        { id: 'prod_2', name: 'Bolsa de Polietileno Transparente en Rollo (Cal. 100)', unitPrice: 43.0, cal: 100 },
        { id: 'prod_3', name: 'Bolsa Polietileno Negro Reciclado', unitPrice: 38.0, cal: 150 },
        { id: 'prod_4', name: 'Película Polietileno Estirable (Stretch Film)', unitPrice: 48.0 }
      ];
    default:
      return [];
  }
}
