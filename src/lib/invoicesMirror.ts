import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import type { PurchaseOrder, Invoice } from './types';

/**
 * PASO 1 de la migracion planeada (ver PLAN_DE_MEJORA_TOTAL.md, seccion 3.4).
 *
 * Escribe una copia de cada factura de un expediente en la nueva
 * coleccion `invoicesV2`, como documentos independientes -- en espejo,
 * al mismo tiempo que se sigue guardando en el modelo actual
 * (order.invoices[]). Ningun archivo de los 24 que hoy leen del modelo
 * viejo se toca todavia; todos siguen funcionando exactamente igual.
 *
 * Proposito: una vez que el espejo lleve un tiempo corriendo sin
 * discrepancias, se puede empezar a migrar los 24 archivos uno por uno
 * para que LEAN de aqui en vez del arreglo anidado -- con la garantia de
 * que los datos ya estan ahi y verificados, no como un salto en el vacio.
 *
 * Es deliberadamente una funcion de un solo proposito (espejar, no leer
 * ni sustituir nada) para mantener el riesgo de este primer paso lo mas
 * bajo posible.
 */
export async function espejarFacturasV2(order: PurchaseOrder) {
  const invoices: Invoice[] = order.invoices ?? [];
  if (invoices.length === 0) return;

  try {
    const batch = writeBatch(db);
    for (const inv of invoices) {
      const ref = doc(db, PATHS.invoices, inv.id);
      batch.set(ref, {
        orderId: order.id,
        orderFolio: order.folio ?? null,
        client: order.client ?? null,
        folio: inv.folio ?? null,
        kilos: inv.kilos ?? 0,
        financials: inv.financials ?? {},
        creditCycle: inv.creditCycle ?? {},
        collection: inv.collection ?? {},
        _espejoDe: 'order.invoices[]', // marca de origen, para poder auditar el espejo despues
        _actualizadoEn: serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  } catch {
    // El espejo es una copia de respaldo para la migracion futura, no
    // una fuente de verdad todavia -- si falla, no debe interrumpir ni
    // avisar sobre el guardado real del expediente, que sigue
    // funcionando normalmente con el modelo actual.
  }
}
