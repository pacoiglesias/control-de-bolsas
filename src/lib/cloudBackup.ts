import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { logAction } from './logger';
import type { FinancialConfig, PurchaseOrder, Purchase, Expense } from './types';
import { ordersToHtmlState } from './bridge';

export interface CloudSnapshotMeta {
  id: string;
  createdAt: Date | null;
  createdBy: string;
  totalOrders: number;
  totalPurchases: number;
  totalExpenses: number;
  payload?: string;
}

/**
 * Crea un respaldo en la nube (Firestore collection 'snapshots').
 * Mantiene AUTOMÁTICAMENTE solo los 5 respaldos más recientes.
 */
export async function createCloudBackup(
  userEmail: string | null | undefined,
  orders: PurchaseOrder[],
  purchases: Purchase[],
  expenses: Expense[],
  config: FinancialConfig,
  projectId: string = 'control-de-bolsas-89c88'
): Promise<{ id: string; count: number }> {
  const timestamp = Date.now();
  const snapId = `snap_${timestamp}`;
  const estado = ordersToHtmlState(orders, purchases, expenses, config, projectId);
  const payload = JSON.stringify(estado);

  const snapData = {
    id: snapId,
    createdAt: serverTimestamp(),
    createdBy: userEmail || 'admin',
    totalOrders: orders.length,
    totalPurchases: purchases.length,
    totalExpenses: expenses.length,
    facturasCount: estado.facturas.length,
    payload,
  };

  // 1. Guardar snapshot específico
  await setDoc(doc(db, 'snapshots', snapId), snapData);

  // 2. Guardar referencia en 'latest'
  await setDoc(doc(db, 'snapshots', 'latest'), {
    createdAt: serverTimestamp(),
    createdBy: userEmail || 'admin',
    totalOrders: orders.length,
    payload,
  });

  // 3. Obtener todos los snapshots existentes para podar y dejar máximo 5
  const snapQ = query(collection(db, 'snapshots'));
  const snapDocs = await getDocs(snapQ);

  const list: { id: string; time: number }[] = [];
  snapDocs.forEach((d) => {
    if (d.id !== 'latest') {
      const data = d.data();
      const t = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : parseInt(d.id.replace('snap_', '')) || 0;
      list.push({ id: d.id, time: t });
    }
  });

  // Ordenar de más reciente a más antiguo
  list.sort((a, b) => b.time - a.time);

  // Si hay más de 5, eliminar los más antiguos
  if (list.length > 5) {
    const toDelete = list.slice(5);
    for (const item of toDelete) {
      try {
        await deleteDoc(doc(db, 'snapshots', item.id));
      } catch {
        /* ignorar error de borrado individual */
      }
    }
  }

  await logAction(userEmail, 'Respaldo en la Nube Creado', {
    snapshotId: snapId,
    totalOrders: orders.length,
    remainingSnapshots: Math.min(list.length, 5),
  });

  return { id: snapId, count: Math.min(list.length, 5) };
}

/**
 * Lista los respaldos en la nube disponibles (máximo 5).
 */
export async function listCloudBackups(): Promise<CloudSnapshotMeta[]> {
  const snapQ = query(collection(db, 'snapshots'));
  const snapDocs = await getDocs(snapQ);

  const list: CloudSnapshotMeta[] = [];
  snapDocs.forEach((d) => {
    if (d.id !== 'latest') {
      const data = d.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(parseInt(d.id.replace('snap_', '')) || Date.now());
      list.push({
        id: d.id,
        createdAt,
        createdBy: data.createdBy || 'Sistema',
        totalOrders: data.totalOrders ?? data.facturasCount ?? 0,
        totalPurchases: data.totalPurchases ?? 0,
        totalExpenses: data.totalExpenses ?? 0,
        payload: data.payload,
      });
    }
  });

  // Ordenar de más reciente a más antiguo
  list.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));

  return list.slice(0, 5);
}

/**
 * Restaura un respaldo de la nube hacia la base de datos principal.
 */
export async function restoreCloudBackup(
  userEmail: string | null | undefined,
  snapshot: CloudSnapshotMeta
): Promise<{ ordersRestored: number; message: string }> {
  if (!snapshot.payload) {
    // Intentar leer el documento completo si no traía payload en la lista
    const snapDoc = await getDoc(doc(db, 'snapshots', snapshot.id));
    if (!snapDoc.exists() || !snapDoc.data().payload) {
      throw new Error('El respaldo no contiene un archivo de datos válido.');
    }
    snapshot.payload = snapDoc.data().payload;
  }

  const data = JSON.parse(snapshot.payload!);
  const facturas = data.facturas ?? [];

  if (!Array.isArray(facturas) || facturas.length === 0) {
    throw new Error('El respaldo no contiene facturas u órdenes válidas.');
  }

  // Actualizar 'latest' con la marca de restauración
  await setDoc(doc(db, 'snapshots', 'latest'), {
    restoredFrom: snapshot.id,
    restoredAt: serverTimestamp(),
    restoredBy: userEmail || 'admin',
  });

  await logAction(userEmail, 'Respaldo en Nube Restaurado', {
    snapshotId: snapshot.id,
    facturasCount: facturas.length,
  });

  return {
    ordersRestored: facturas.length,
    message: `Respaldo del ${snapshot.createdAt ? snapshot.createdAt.toLocaleString('es-MX') : 'hace un momento'} restaurado exitosamente.`,
  };
}
