import { Timestamp, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { safeSetDoc, safeUpdateDoc } from './safeFirestore';
import { db, PATHS } from './firebase';
import { computeFinancials, addDays, round2 } from './finance';
import type { Delivery, Invoice, PurchaseOrder, PurchaseOrderItem, FinancialConfig } from './types';
import {deliveryBillableKilos,getInvoiceProductCatalog,billableLineQuantity} from './billingQuantities';

/**
 * Toda la lógica de "entregas como eventos" y conciliación por partida para facturación.
 */

/** Arma una entrega nueva en blanco, con un renglón en 0 por cada producto de la OC. */
export function newDeliveryEvent(items: PurchaseOrderItem[]): Delivery {
  return {
    id: crypto.randomUUID(),
    date: Timestamp.now(),
    kilos: 0,
    items: items.map((it) => ({ itemId: it.id, quantity: 0 })),
    invoiced: false,
    notes: '',
  };
}

/** Revalidar dentro de la transacción evita sobreentregas entre dos capturas simultáneas. */
export function assertDeliveryFitsOrder(order: PurchaseOrder, kilos: number, items?: Delivery['items']): void {
  if (order.isDeleted || order.isSuperseded || order.isClosedShort || order.productionTrackingEnabled === false) throw new Error('La orden está cerrada, retirada o fuera de producción.');
  if (!Number.isFinite(kilos) || kilos <= 0) throw new Error('Captura kilos válidos mayores a cero.');
  const itemTotal = (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const ordered = itemTotal > 0 ? itemTotal : Number(order.totalKilograms) || 0;
  const delivered = computeDeliveredTotals(order.deliveries ?? [], order.items);
  const pending = round2(Math.max(0, ordered - delivered.kilosEntregados));
  if (kilos > pending + 0.001) throw new Error(`Solo quedan ${pending.toLocaleString('es-MX')} kg por entregar. Actualiza la captura.`);
  if (items) {
    if (new Set(items.map(item => item.itemId)).size !== items.length) throw new Error('Hay partidas repetidas en la entrega.');
    if ((order.items || []).length && items.some(item => item.quantity > 0 && !order.items?.some(candidate => candidate.id === item.itemId))) {
      throw new Error('La entrega contiene una partida que no pertenece a la orden.');
    }
    if (items.some(item => !Number.isFinite(item.quantity) || item.quantity < 0) ||
      Math.abs(round2(items.reduce((sum, item) => sum + item.quantity, 0)) - round2(kilos)) > 0.001) {
      throw new Error('La suma de las partidas debe coincidir con los kilos de la entrega.');
    }
    for (const item of items) {
      const orderedItem = order.items?.find(candidate => candidate.id === item.itemId);
      if (orderedItem && round2(item.quantity + (delivered.deliveredByItem[item.itemId] ?? 0)) > orderedItem.quantity + 0.001) {
        throw new Error(`La partida ${orderedItem.description} supera sus kilos pendientes.`);
      }
    }
  }
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
  if (d && getDeliveryBilling(d).invoicedKilos > 0) {
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
    if (d.inferredFromInvoice) return;
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
  const effectiveItems = getInvoiceProductCatalog(order);
  const physicalDeliveries = (order.deliveries || []).filter(delivery => !delivery.inferredFromInvoice);
  const physicalByItem=computeDeliveredTotals(physicalDeliveries,effectiveItems).deliveredByItem;
  const deliveries = physicalDeliveries.map(delivery=>delivery.billingQuantityPolicy?{...delivery,kilos:deliveryBillableKilos(delivery),items:delivery.items?.map(item=>({...item,quantity:billableLineQuantity(item.quantity,delivery.billingQuantityPolicy)}))}:delivery);
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
        const qty = Number(di.quantity) || 0;
        const key = di.itemId;
        if (key) {
          deliveredMap[key] = (deliveredMap[key] || 0) + qty;
        }

        // Búsqueda inteligente del ítem en effectiveItems para ligar por ID, Código y Descripción
        const matchedItem = effectiveItems.find(it =>
          it.id === di.itemId ||
          (it.code && di.itemId && it.code.trim().toUpperCase() === di.itemId.trim().toUpperCase()) ||
          (it.code && (di as any).code && it.code.trim().toUpperCase() === (di as any).code.trim().toUpperCase())
        );
        if (matchedItem) {
          if (matchedItem.id && matchedItem.id !== key) {
            deliveredMap[matchedItem.id] = (deliveredMap[matchedItem.id] || 0) + qty;
          }
          const itemCode = matchedItem.code ? matchedItem.code.trim().toLowerCase() : null;
          if (itemCode && itemCode !== key && itemCode !== matchedItem.id) {
            deliveredMap[itemCode] = (deliveredMap[itemCode] || 0) + qty;
          }
          const itemDesc = matchedItem.description ? matchedItem.description.trim().toLowerCase() : null;
          if (itemDesc && itemDesc !== key && itemDesc !== itemCode && itemDesc !== matchedItem.id) {
            deliveredMap[itemDesc] = (deliveredMap[itemDesc] || 0) + qty;
          }
        }
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
      // Si la orden tiene entregas en báscula, sugerir ÚNICAMENTE los kilos entregados y no facturados,
      // respetando el TOPE INVIOLABLE de la OC (nunca facturar a Providencia más de la OC emitida).
      suggestedKilos = round2(Math.min(uninvoicedDeliveredKilos, remainingOcKilos));
    } else {
      // Si es una orden abierta sin entregas (prefactura sobre OC), sugerir los kilos restantes de la OC
      suggestedKilos = remainingOcKilos;
    }

    return {
      id: it.id || `item_${idx}_${Date.now()}`,
      code: it.code || '24141500',
      description: it.description || 'Bolsa de Polietileno',
      unit: it.unit || 'KGM',
      unitPrice: it.unitPrice || defaultUnitPrice,
      ocQuantity: ocQty,
      alreadyDelivered: round2(physicalByItem[it.id]??itemDelivered),
      alreadyInvoiced: round2(itemInvoiced),
      uninvoicedDeliveredKilos,
      remainingOcKilos,
      suggestedKilosToInvoice: suggestedKilos,
      selected: suggestedKilos > 0.001,
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
  if (!invoiceId || !Number.isFinite(kilosToInvoice) || kilosToInvoice < 0) {
    throw new Error('La factura debe tener identificador y kilos válidos.');
  }
  // Reemplazar la asignación previa hace que guardar dos veces sea idempotente.
  let remaining = round2(kilosToInvoice);
  return unmarkDeliveriesByInvoiceId(deliveries, invoiceId).map((d) => {
    const billing = getDeliveryBilling(d);
    const portion = round2(Math.min(billing.pendingKilos, remaining));
    if (portion <= 0) return d;
    remaining = round2(remaining - portion);
    const allocations = getDeliveryAllocations(d);
    allocations.push({ invoiceId, kilos: portion });
    const invoicedKilos = round2(billing.invoicedKilos + portion);
    return {
      ...d,
      invoiced: invoicedKilos >= billing.kilos - 0.001,
      invoicedKilos,
      invoiceAllocations: allocations,
      invoiceId: [...new Set([...(d.invoiceId?.split(',').map(id => id.trim()).filter(Boolean) ?? []), invoiceId])].join(', '),
    };
  });
}

/** Totales físicos y facturados de una entrega, compatibles con registros anteriores. */
export function getDeliveryBilling(delivery: Delivery) {
  if (delivery.inferredFromInvoice) return {kilos: 0, invoicedKilos: 0, pendingKilos: 0};
  const itemsKilos = (delivery.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  const kilos = delivery.billingQuantityPolicy?deliveryBillableKilos(delivery):round2(Math.max(0, itemsKilos > 0 ? itemsKilos : Number(delivery.kilos) || 0));
  const allocated = (delivery.invoiceAllocations ?? []).reduce((sum, allocation) => sum + allocation.kilos, 0);
  const invoicedKilos = round2(Math.min(kilos, Math.max(0,
    delivery.invoicedKilos ?? (delivery.invoiced ? kilos : allocated), allocated)));
  return { kilos, invoicedKilos, pendingKilos: round2(Math.max(0, kilos - invoicedKilos)) };
}

function getDeliveryAllocations(delivery: Delivery): { invoiceId: string; kilos: number }[] {
  if (delivery.invoiceAllocations) return delivery.invoiceAllocations.map(allocation => ({ ...allocation }));
  const ids = delivery.invoiceId?.split(',').map(id => id.trim()).filter(Boolean) ?? [];
  return ids.length === 1 ? [{ invoiceId: ids[0], kilos: getDeliveryBilling(delivery).invoicedKilos }] : [];
}

/** Factura UNA entrega específica. */
export function buildInvoiceFromDelivery(
  delivery: Delivery,
  config: FinancialConfig,
  orderId: string,
): { invoice: Invoice; updatedDelivery: Delivery; kilos: number } | { error: string } {
  if (delivery.invoiced) return { error: 'Esta entrega ya fue facturada.' };
  const kilosDeEstaEntrega = getDeliveryBilling(delivery).pendingKilos;
  if (kilosDeEstaEntrega <= 0) {
    return { error: 'Esta entrega no tiene cantidades capturadas todavía.' };
  }
  const issue = new Date();
  const due = addDays(issue, config.creditDays);
  const newInvoiceId = crypto.randomUUID();
  const invoice: Invoice = {
    id: newInvoiceId,
    orderId,
    folio: '',
    kilos: kilosDeEstaEntrega,
    financials: computeFinancials(kilosDeEstaEntrega, config),
    creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
    collection: { paidAmount: 0, contrareciboNumber: '', notes: `Entrega del ${fmtDateForNote(delivery.date)}` },
  };
  const updatedDelivery = linkDeliveriesToInvoice([delivery], newInvoiceId, kilosDeEstaEntrega)[0];
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
  return deliveries.map((d) => {
    const ids = d.invoiceId?.split(',').map(id => id.trim()).filter(Boolean) ?? [];
    const allocations = getDeliveryAllocations(d);
    const released = allocations.filter(allocation => allocation.invoiceId === invoiceId)
      .reduce((sum, allocation) => sum + allocation.kilos, 0);
    if (!released && !ids.includes(invoiceId)) return d;
    if (!d.invoiceAllocations && ids.length > 1) {
      throw new Error('Esta entrega histórica tiene varias facturas sin desglose de kilos. Revisa sus vínculos antes de modificarla.');
    }
    const invoicedKilos = round2(Math.max(0, getDeliveryBilling(d).invoicedKilos - released));
    return {
      ...d,
      invoiced: invoicedKilos > 0 && invoicedKilos >= getDeliveryBilling(d).kilos - 0.001,
      invoicedKilos,
      invoiceAllocations: allocations.filter(allocation => allocation.invoiceId !== invoiceId),
      invoiceId: ids.filter(id => id !== invoiceId).join(', ') || undefined,
    };
  });
}

/** Migra expedientes sin eventos de entrega. */
export function migrateLegacyDeliveries(order: PurchaseOrder, existingDeliveries: Delivery[]): Delivery[] {
  if (existingDeliveries && existingDeliveries.length > 0) return existingDeliveries;
  if (Array.isArray(order.deliveries)) return [];

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
    await safeUpdateDoc(purchaseRef, { expectedKilos, receivedKilos, pricePerKg: costPerKg, totalAmount });
  } else {
    await safeSetDoc(purchaseRef, {
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
