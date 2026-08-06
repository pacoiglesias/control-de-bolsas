import { collection, getDocs, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';

/**
 * Paso 2 de la migracion planeada (PLAN_DE_MEJORA_TOTAL.md, seccion 3.4).
 *
 * El espejo `invoicesV2` se escribe desde useOrderActions.ts cada vez que se
 * guarda un expediente -- pero un expediente que nadie vuelve a tocar nunca
 * llena su copia ahi. Esta funcion recorre TODOS los expedientes activos una
 * sola vez y copia sus facturas reales al espejo, para que quede completo
 * de entrada en vez de esperar a que cada expediente se re-guarde por
 * casualidad.
 *
 * Es segura de correr mas de una vez (idempotente, usa merge:true) y solo
 * ESCRIBE hacia una coleccion que ningun otro lector del sistema consulta
 * todavia -- no puede romper nada que ya funcione.
 */
export async function llenarEspejoDeFacturas(): Promise<{ expedientes: number; facturas: number }> {
  const ordersSnap = await getDocs(collection(db, PATHS.orders));
  let totalFacturas = 0;
  let batch = writeBatch(db);
  let opsEnBatch = 0;

  for (const orderDoc of ordersSnap.docs) {
    const data = orderDoc.data() as any;
    if (data.isDeleted) continue; // los expedientes en la Papelera no aportan al espejo
    const invoices = data.invoices || [];
    for (const inv of invoices) {
      if (!inv?.id) continue;
      const invRef = doc(db, PATHS.invoices, inv.id);
      batch.set(invRef, {
        ...inv,
        orderId: orderDoc.id,
        clientId: (data.client || '').trim(),
        oc: (data.oc || '').trim(),
        createdAt: inv.createdAt || data.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      opsEnBatch++;
      totalFacturas++;
      // Firestore limita cada batch a 500 operaciones
      if (opsEnBatch >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        opsEnBatch = 0;
      }
    }
  }
  if (opsEnBatch > 0) await batch.commit();
  return { expedientes: ordersSnap.docs.length, facturas: totalFacturas };
}
