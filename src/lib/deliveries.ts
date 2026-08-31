import { Timestamp, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, PATHS } from './firebase';
import { computeFinancials, addDays, round2 } from './finance';
import type { Delivery, Invoice, PurchaseOrder, PurchaseOrderItem, FinancialConfig } from './types';
import { getEffectiveOrderItems } from './types';

/**
 * Toda la lógica de "entregas como eventos" y conciliación por partida para facturación.
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
 * Intenta quitar una entrega. No borra si ya está facturada.
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
        if (orderItems && orderItems.length > 0) {
          const match = orderItems.find(it => it.id === di.itemId || it.code === di.itemId);
          if (match && match.id !== di.itemId) {
            deliveredByItem[match.id] = round2((deliveredByItem[match.id] ?? 0) + q);
          }
        }
      });
    } else if (orderItems && orderItems.length === 1) {
      const singleItem = orderItems[0];
      deliveredByItem[singleItem.id] = round2((deliveredByItem[singleItem.id] ?? 0) + dKilos);
    }

    kilosEntregados += sumItems > 0 ? sumItems : dKilos;
  });

  if (orderItems && orderItems.length === 1 && kilosEntregados > 0) {
    const singleItem = orderItems[0];
    if ((deliveredByItem[singleItem.id] ?? 0) < kilosEntregados) {
      deliveredByItem[singleItem.id] = round2(kilosEntregados);
    }
  }

  return { deliveredByItem, kilosEntregados: round2(kilosEntregados) };
}

/**
 * Desglose exacto de cada partida para facturación:
 * Calcula con precisión matemática cuántos kilos fueron solicitados en la OC,
 * cuántos ya fueron entregados en báscula, cuántos ya han sido facturados en facturas previas,
 * y cuántos kilos reales quedan pendientes por facturar (descontando estrictamente lo ya amparado).
 */
export interface ItemInvoiceBreakdown {
  id: string;
  code: string;
  description: string;
  unit: string;
  unitPrice: number;
  ocQuantity: number;
  alreadyDelivered: number;
  alreadyInvoiced: number;
  uninvoicedDeliveredKilos: number;
  remainingOcKilos: number;
  suggestedKilosToInvoice: number;
  selected: boolean;
}

export function computeItemInvoiceBreakdown(
  order: PurchaseOrder,
  defaultUnitPrice: number = 43
): ItemInvoiceBreakdown[] {
  const effectiveItems = getEffectiveOrderItems(order);
  const deliveries = order.deliveries || [];
  const invoices = order.invoices || [];

  const totalDeliveredKilos = deliveries.reduce((sum, d) => {
    if (d.items && d.items.length > 0) {
      return sum + d.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    }
    return sum + (Number(d.kilos) || 0);
  }, 0);

  const totalOcKilos = effectiveItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);

  // Mapeo detallado de entregas por ítem
  const deliveredMap: Record<string, number> = {};
  deliveries.forEach((d) => {
    if (d.items && d.items.length > 0) {
      d.items.forEach((di) => {
        const key = di.itemId;
        deliveredMap[key] = (deliveredMap[key] || 0) + (Number(di.quantity) || 0);
      });
    }
  });

  // Mapeo detallado de facturas emitidas por ítem
  const invoicedMap: Record<string, number> = {};
  invoices.forEach((inv) => {
    if (inv.items && inv.items.length > 0) {
      inv.items.forEach((it) => {
        const keyId = it.id;
        const keyCode = it.code && it.code !== '24141500' ? it.code.trim().toLowerCase() : null;
        const keyDesc = it.description ? it.description.trim().toLowerCase() : null;

        if (keyId) invoicedMap[keyId] = (invoicedMap[keyId] || 0) + (Number(it.quantity) || 0);
        if (keyCode && keyCode !== keyId) invoicedMap[keyCode] = (invoicedMap[keyCode] || 0) + (Number(it.quantity) || 0);
        if (keyDesc && keyDesc !== keyId && keyDesc !== keyCode) invoicedMap[keyDesc] = (invoicedMap[keyDesc] || 0) + (Number(it.quantity) || 0);
      });
    }
  });

  const hasDeliveries = deliveries.length > 0 && totalDeliveredKilos > 0;
  const flatDeliveriesKilos = deliveries
    .filter((d) => !d.items || d.items.length === 0)
    .reduce((sum, d) => sum + (Number(d.kilos) || 0), 0);

  const flatInvoicesKilos = invoices
    .filter((inv) => !inv.items || inv.items.length === 0)
    .reduce((sum, inv) => sum + (Number(inv.kilos) || 0), 0);

  return effectiveItems.map((it, idx) => {
    const ocQty = Number(it.quantity) || 0;
    const itemKeyById = it.id;
    const itemKeyByCode = it.code && it.code !== '24141500' ? it.code.trim().toLowerCase() : null;
    const itemKeyByDesc = it.description ? it.description.trim().toLowerCase() : null;

    // Entregas detalladas para este ítem
    let itemDelivered = 0;
    if (itemKeyById && deliveredMap[itemKeyById] !== undefined) {
      itemDelivered = deliveredMap[itemKeyById];
    } else if (itemKeyByCode && deliveredMap[itemKeyByCode] !== undefined) {
      itemDelivered = deliveredMap[itemKeyByCode];
    } else if (itemKeyByDesc && deliveredMap[itemKeyByDesc] !== undefined) {
      itemDelivered = deliveredMap[itemKeyByDesc];
    }

    // Si existen entregas globales sin desglose por ítem, distribuir proporcionalmente
    if (flatDeliveriesKilos > 0 && totalOcKilos > 0) {
      const share = round2(flatDeliveriesKilos * (ocQty / totalOcKilos));
      itemDelivered = round2(itemDelivered + share);
    }

    // Facturas detalladas para este ítem
    let itemInvoiced = 0;
    if (itemKeyById && invoicedMap[itemKeyById] !== undefined) {
      itemInvoiced = invoicedMap[itemKeyById];
    } else if (itemKeyByCode && invoicedMap[itemKeyByCode] !== undefined) {
      itemInvoiced = invoicedMap[itemKeyByCode];
    } else if (itemKeyByDesc && invoicedMap[itemKeyByDesc] !== undefined) {
      itemInvoiced = invoicedMap[itemKeyByDesc];
    }

    // Si existen facturas globales sin desglose por ítem, distribuir proporcionalmente
    if (flatInvoicesKilos > 0 && totalOcKilos > 0) {
      const share = round2(flatInvoicesKilos * (ocQty / totalOcKilos));
      itemInvoiced = round2(itemInvoiced + share);
    }

    // Descontar estrictamente lo ya facturado
    const uninvoicedDeliveredKilos = round2(Math.max(0, itemDelivered - itemInvoiced));
    const remainingOcKilos = round2(Math.max(0, ocQty - itemInvoiced));

    let suggestedKilos = 0;
    if (hasDeliveries) {
      // Si hay entregas en la orden, sugerir SOLO los kilos recibidos en báscula que NO han sido facturados
      // y con tope estricto a los kilos restantes de la OC (Regla Inviolable 4)
      suggestedKilos = round2(Math.min(uninvoicedDeliveredKilos, remainingOcKilos));
    } else {
      // Si es una orden abierta sin báscula, sugerir los kilos restantes de la OC
      suggestedKilos = remainingOcKilos;
    }

    return {
      id: it.id || `item_${idx}_${Date.now()}`,
      code: it.code || '24141500',
      description: it.description || 'Bolsa de Polietileno',
      unit: it.unit || 'KGM',
      unitPrice: it.unitPrice || defaultUnitPrice,
      ocQuantity: ocQty,
      alreadyDelivered: round2(itemDelivered),
      alreadyInvoiced: round2(itemInvoiced),
      uninvoicedDeliveredKilos,
      remainingOcKilos,
      suggestedKilosToInvoice: suggestedKilos,
      selected: suggestedKilos > 0.01,
    };
  });
}

/**
 * Vincula entregas de báscula a una nueva factura emitida, marcándolas invoiced: true
 */
export function linkDeliveriesToInvoice(
  deliveries: Delivery[],
  invoiceId: string,
  kilosToInvoice: number,
): Delivery[] {
  let remaining = kilosToInvoice;
  return deliveries.map((d) => {
    const dKilos =
      d.items && d.items.length > 0
        ? d.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
        : Number(d.kilos || 0);

    if (!d.invoiced && dKilos > 0 && remaining > 0.001) {
      const portion = Math.min(dKilos, remaining);
      remaining -= portion;
      return { ...d, invoiced: true, invoiceId };
    }
    return d;
  });
}

/** Factura UNA entrega específica. */
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

/** Migra expedientes sin eventos de entrega. */
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

/** Upsert de compras a Andrés. */
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
