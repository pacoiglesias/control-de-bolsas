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

  // Firestore rechaza documentos de mas de 1 MiB. Vale mas avisar aqui, con un
  // mensaje entendible, que dejar que el respaldo falle con un error tecnico y
  // que el panel siga mostrando la fecha del respaldo anterior como si nada.
  const pesoKB = Math.round(payload.length / 1024);
  if (payload.length > 950_000) {
    throw new Error(
      `El respaldo pesa ${pesoKB} KB y el limite por documento de Firestore es ` +
      `1024 KB. Descarga el respaldo HTML local y avisa: hay que mover el ` +
      `contenido a Cloud Storage.`,
    );
  }

  // Metadatos ligeros en el documento padre. El contenido pesado va en una
  // subcoleccion aparte: listar o podar respaldos ya no descarga los cinco
  // payloads completos (eran ~1.5 MB por cada operacion).
  await setDoc(doc(db, 'snapshots', snapId), {
    id: snapId,
    createdAt: serverTimestamp(),
    createdBy: userEmail || 'admin',
    totalOrders: orders.length,
    totalPurchases: purchases.length,
    totalExpenses: expenses.length,
    facturasCount: estado.facturas.length,
    payloadKB: pesoKB,
  });
  await setDoc(doc(db, 'snapshots', snapId, 'blob', 'data'), { payload });

  // Puntero al ultimo respaldo. Solo referencia, sin copia del contenido.
  await setDoc(doc(db, 'snapshots', 'latest'), {
    createdAt: serverTimestamp(),
    createdBy: userEmail || 'admin',
    totalOrders: orders.length,
    lastSnapshotId: snapId,
    payloadKB: pesoKB,
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
        // El contenido primero: borrar solo el padre dejaria el blob huerfano.
        await deleteDoc(doc(db, 'snapshots', item.id, 'blob', 'data')).catch(() => {});
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
    // Formato nuevo: el contenido vive en la subcoleccion blob/.
    const blob = await getDoc(doc(db, 'snapshots', snapshot.id, 'blob', 'data'));
    if (blob.exists() && blob.data().payload) {
      snapshot.payload = blob.data().payload;
    } else {
      // Formato anterior: el payload estaba dentro del documento padre.
      const snapDoc = await getDoc(doc(db, 'snapshots', snapshot.id));
      if (!snapDoc.exists() || !snapDoc.data().payload) {
        throw new Error('El respaldo no contiene un archivo de datos válido.');
      }
      snapshot.payload = snapDoc.data().payload;
    }
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
