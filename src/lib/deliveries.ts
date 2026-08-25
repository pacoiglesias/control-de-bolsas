import { Timestamp, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { computeFinancials, addDays, round2 } from './finance';
import type { Delivery, Invoice, PurchaseOrder, PurchaseOrderItem, FinancialConfig } from './types';

/**
 * Toda la lógica de "entregas como eventos" en un solo lugar, como funciones
 * puras (reciben datos, devuelven datos — nunca tocan Firestore ni estado de
 * React directamente). Antes vivía solo dentro de OrderModal.tsx: si Compras
 * quería lo mismo, tenía que reimplementarlo aparte, con el riesgo real de
 * que las dos copias divergieran (ya pasó una vez con "Facturar lo
 * entregado" — ver Ciclo 23 en AUDIT_NOTEBOOK.md). Al ser puras, además
 * quedan listas para tener sus propias pruebas automatizadas sin necesidad
 * de montar el componente completo.
 */

/** Arma una entrega nueva en blanco, con un renglón en 0 por cada producto de la OC. */
export function newDeliveryEvent(items: PurchaseOrderItem[]): Delivery {
  return {
    id: Date.now().toString(),
    date: Timestamp.now(),
    kilos: 0,
    items: items.map((it) => ({ itemId: it.id, quantity: 0 })),
    invoiced: false,
    notes: '',
  };
}

/** Actualiza un campo simple de una entrega (fecha, notas...). Devuelve un arreglo nuevo. */
export function updateDeliveryField<F extends keyof Delivery>(
  deliveries: Delivery[],
  index: number,
  field: F,
  value: Delivery[F],
): Delivery[] {
  const next = [...deliveries];
  next[index] = { ...next[index], [field]: value };
  return next;
}

/** Actualiza la cantidad de UN producto dentro de UNA entrega y recalcula su total. */
export function updateDeliveryItemQuantity(
  deliveries: Delivery[],
  deliveryIndex: number,
  itemId: string,
  quantity: number,
): Delivery[] {
  const next = [...deliveries];
  const d = next[deliveryIndex];
  const items = [...(d.items ?? [])];
  const idx = items.findIndex((x) => x.itemId === itemId);
  if (idx >= 0) items[idx] = { ...items[idx], quantity };
  else items.push({ itemId, quantity });
  const kilosTotal = round2(items.reduce((a, x) => a + (Number(x.quantity) || 0), 0));
  next[deliveryIndex] = { ...d, items, kilos: kilosTotal };
  return next;
}

/**
 * Intenta quitar una entrega. No borra si ya está facturada: devuelve un
 * error para que quien llame decida cómo avisarlo (toast, alert, lo que
 * tenga esa pantalla), en vez de asumir un mecanismo de aviso concreto.
 */
export function removeDeliveryAt(
  deliveries: Delivery[],
  index: number,
): { deliveries: Delivery[] } | { error: string } {
  const d = deliveries[index];
  if (d?.invoiced) {
    return { error: 'Esta entrega ya generó una factura. Elimina primero la factura ligada antes de borrar la entrega.' };
  }
  const next = [...deliveries];
  next.splice(index, 1);
  return { deliveries: next };
}

/** Cuánto se ha entregado, por producto y en total, sumando todos los eventos. */
export function computeDeliveredTotals(deliveries: Delivery[], orderItems?: PurchaseOrderItem[]): {
  deliveredByItem: Record<string, number>;
  kilosEntregados: number;
} {
  const deliveredByItem: Record<string, number> = {};
  let kilosEntregados = 0;

  deliveries.forEach((d) => {
    const items = d.items ?? [];
    const sumItems = items.reduce((a, x) => a + (Number(x.quantity) || 0), 0);
    const dKilos = Number(d.kilos) || sumItems;

    if (items.length > 0) {
      items.forEach((di) => {
        const q = Number(di.quantity) || 0;
        deliveredByItem[di.itemId] = round2((deliveredByItem[di.itemId] ?? 0) + q);
        // Si orderItems está disponible, asegurar mapeo por ID o código si difieren
        if (orderItems && orderItems.length > 0) {
          const match = orderItems.find(it => it.id === di.itemId || it.code === di.itemId);
          if (match && match.id !== di.itemId) {
            deliveredByItem[match.id] = round2((deliveredByItem[match.id] ?? 0) + q);
          }
        }
      });
    } else if (orderItems && orderItems.length === 1) {
      // Entrega global en orden con 1 sola partida: atribuir directamente al concepto
      const singleItem = orderItems[0];
      deliveredByItem[singleItem.id] = round2((deliveredByItem[singleItem.id] ?? 0) + dKilos);
    }

    kilosEntregados += sumItems > 0 ? sumItems : dKilos;
  });

  // Si la orden solo tiene 1 concepto y hubo entregas globales registradas, garantizar que no quede en 0
  if (orderItems && orderItems.length === 1 && kilosEntregados > 0) {
    const singleItem = orderItems[0];
    if ((deliveredByItem[singleItem.id] ?? 0) < kilosEntregados) {
      deliveredByItem[singleItem.id] = round2(kilosEntregados);
    }
  }

  return { deliveredByItem, kilosEntregados: round2(kilosEntregados) };
}

/**
 * Factura UNA entrega específica — nunca el acumulado. Devuelve la factura
 * nueva y la entrega ya marcada como facturada, o un error si no hay nada
 * que facturar. Quien llama decide qué hacer con el resultado (agregarlo al
 * expediente, cambiar de pestaña, mostrar el toast).
 */
export function buildInvoiceFromDelivery(
  delivery: Delivery,
  config: FinancialConfig,
  orderId: string,
): { invoice: Invoice; updatedDelivery: Delivery; kilos: number } | { error: string } {
  if (delivery.invoiced) return { error: 'Esta entrega ya fue facturada.' };
  const kilosDeEstaEntrega = round2(
    (delivery.items ?? []).reduce((acc, di) => acc + (Number(di.quantity) || 0), 0) || delivery.kilos || 0,
  );
  if (kilosDeEstaEntrega <= 0) {
    return { error: 'Esta entrega no tiene cantidades capturadas todavía.' };
  }
  const issue = new Date();
  const due = addDays(issue, config.creditDays);
  const newInvoiceId = Date.now().toString();
  const invoice: Invoice = {
    id: newInvoiceId,
    orderId,
    folio: '',
    kilos: kilosDeEstaEntrega,
    financials: computeFinancials(kilosDeEstaEntrega, config),
    creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
    collection: { paidAmount: 0, contrareciboNumber: '', notes: `Entrega del ${fmtDateForNote(delivery.date)}` },
  };
  const updatedDelivery: Delivery = { ...delivery, invoiced: true, invoiceId: newInvoiceId };
  return { invoice, updatedDelivery, kilos: kilosDeEstaEntrega };
}

function fmtDateForNote(ts: Timestamp | null): string {
  if (!ts) return '—';
  try {
    return ts.toDate().toLocaleDateString('es-MX');
  } catch {
    return '—';
  }
}

/** Si se borra una factura, la entrega que la generó vuelve a estar disponible para facturarse. */
export function unmarkDeliveriesByInvoiceId(deliveries: Delivery[], invoiceId: string | undefined): Delivery[] {
  if (!invoiceId) return deliveries;
  return deliveries.map((d) => (d.invoiceId === invoiceId ? { ...d, invoiced: false, invoiceId: undefined } : d));
}

/**
 * Migra expedientes que todavía no tienen entregas en formato de evento:
 * arma UNA entrega histórica con lo que ya había, marcada como ya facturada
 * si el expediente ya tenía facturas (para no ofrecer facturarla otra vez).
 * Cubre tanto el formato con items[].deliveredQuantity como los expedientes
 * muy viejos, de antes de que existiera items[].
 */
export function migrateLegacyDeliveries(order: PurchaseOrder, existingDeliveries: Delivery[]): Delivery[] {
  if (existingDeliveries && existingDeliveries.length > 0) return existingDeliveries;

  const items = order.items ?? [];
  const totalLegacy = items.reduce((acc, it) => acc + (Number(it.deliveredQuantity) || 0), 0);

  if (totalLegacy > 0) {
    return [{
      id: `legacy-${order.id}`,
      date: order.processedAt ?? Timestamp.now(),
      kilos: round2(totalLegacy),
      items: items.map((it) => ({ itemId: it.id, quantity: Number(it.deliveredQuantity) || 0 })),
      invoiced: (order.invoices?.length ?? 0) > 0,
      notes: 'Migrado automáticamente del formato anterior (sin evento de entrega individual).',
    }];
  }

  const kilosFacturados = (order.invoices ?? []).reduce((acc, inv) => acc + (Number(inv.kilos) || 0), 0);
  if (kilosFacturados > 0) {
    return [{
      id: `legacy-${order.id}`,
      date: order.processedAt ?? Timestamp.now(),
      kilos: round2(kilosFacturados),
      invoiced: true,
      notes: 'Migrado automáticamente: kilos amparados en facturas emitidas.',
    }];
  }

  return [];
}

/**
 * Crea o actualiza el registro de compra a Andres ligado a un expediente
 * (mismo id en las dos colecciones). Antes esta escritura solo vivia dentro
 * de OrderModal.save(): cuando se agrego el atajo "Registrar Entrega" en
 * Compras.tsx (Ciclo 28) para capturar entregas sin abrir el expediente
 * completo, ese camino nunca llamaba a esto — la entrega quedaba guardada
 * en el expediente, pero la deuda con Andres jamas se actualizaba. Ahora
 * los dos caminos llaman a esta MISMA funcion, en vez de mantener dos
 * copias que puedan volver a divergir.
 *
 * El costo se reconoce sobre lo ENTREGADO (receivedKilos), no lo pedido:
 * decision de negocio confirmada explicitamente por el usuario (Ciclo 14).
 */
export async function upsertAndresPurchase(params: {
  orderId: string;
  provider: string;
  expectedKilos: number;
  receivedKilos: number;
  costPerKg: number;
}): Promise<void> {
  const { orderId, provider, expectedKilos, receivedKilos, costPerKg } = params;
  const purchaseRef = doc(db, PATHS.purchases, orderId);
  const purchaseSnap = await getDoc(purchaseRef);
  const totalAmount = round2(receivedKilos * costPerKg);
  if (purchaseSnap.exists()) {
    await updateDoc(purchaseRef, { expectedKilos, receivedKilos, pricePerKg: costPerKg, totalAmount });
  } else {
    await setDoc(purchaseRef, {
      date: serverTimestamp(),
      provider: provider || 'Andrés',
      expectedKilos,
      receivedKilos,
      pricePerKg: costPerKg,
      totalAmount,
      paidAmount: 0,
      status: 'pedido',
      createdAt: serverTimestamp(),
    });
  }
}
