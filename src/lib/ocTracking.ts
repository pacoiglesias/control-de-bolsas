import type {PurchaseOrder, Invoice, Delivery, OrderStatus} from './types';
import {getOrderSummary, round2, extractCr} from './finance';
import {toDate} from './format';
import {isProductionTracked} from './productionTracking';

export interface OcGroup {
  oc: string;
  order: PurchaseOrder;
  kilosPedidos: number;
  kilosEntregados: number;
  kilosFaltantes: number;
  kilosFacturados: number;
  kilosPendientesFacturar: number;
  totalVentaFacturada: number;
  statusCategory: 'por_entregar' | 'pendiente_factura' | 'en_cobranza' | 'completada';
  invoices: {
    folio: string;
    kilos: number;
    amount: number;
    cr: string;
    dueDate: Date | null;
    status: string;
    paid: boolean;
    order: PurchaseOrder;
  }[];
}

export function buildOcGroups(orders: PurchaseOrder[]): OcGroup[] {
    // Agrupar órdenes por su clave canónica de OC
    const ocMap = new Map<string, PurchaseOrder[]>();

    for (const order of orders) {
      if (!order || order.isDeleted || order.isSuperseded) continue;
      const rawOc = (order.oc || order.folio || order.id).trim();
      const rawFolio = (order.folio || '').trim().toUpperCase();
      const ocKey = rawOc.toUpperCase();

      // Excluir expedientes cuyo identificador es exclusivamente un Contrarecibo (viven en Cobranza)
      if (ocKey.startsWith('TH-') || ocKey.startsWith('GT-') || rawFolio.startsWith('TH-') || rawFolio.startsWith('GT-')) continue;
      
      const existing = ocMap.get(ocKey) || [];
      existing.push(order);
      ocMap.set(ocKey, existing);
    }

    const list: OcGroup[] = [];

    for (const [ocKey, groupOrders] of ocMap.entries()) {
      // Tomar la orden más completa
      const primaryOrder = groupOrders.reduce((best, curr) => {
        const bestScore = (best.items?.length || 0) * 10 + (best.invoices?.length || 0) * 5 + (best.deliveries?.length || 0);
        const currScore = (curr.items?.length || 0) * 10 + (curr.invoices?.length || 0) * 5 + (curr.deliveries?.length || 0);
        return currScore > bestScore ? curr : best;
      }, groupOrders[0]);

      // Fusionar facturas y entregas sin duplicados
      const allInvoicesRaw: Invoice[] = [];
      const invoiceFolioSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const inv of ord.invoices || []) {
          const key = (inv.folio || inv.id || '').toUpperCase().trim();
          if (key && !invoiceFolioSet.has(key)) {
            invoiceFolioSet.add(key);
            allInvoicesRaw.push(inv);
          }
        }
      }

      const allDeliveriesRaw: Delivery[] = [];
      const deliveryIdSet = new Set<string>();
      for (const ord of groupOrders) {
        for (const del of ord.deliveries || []) {
          const key = (del.id || `${del.kilos}-${del.date}`).trim();
          if (key && !deliveryIdSet.has(key)) {
            deliveryIdSet.add(key);
            allDeliveriesRaw.push(del);
          }
        }
      }

      const mergedOrder: PurchaseOrder = {
        ...primaryOrder,
        invoices: allInvoicesRaw.length > 0 ? allInvoicesRaw : primaryOrder.invoices,
        deliveries: allDeliveriesRaw.length > 0 ? allDeliveriesRaw : primaryOrder.deliveries,
      };

      const summary = getOrderSummary(mergedOrder);
      const itemsKg = (mergedOrder.items || []).reduce((a, it) => a + (Number(it.quantity) || 0), 0);
      const kilosPedidos = itemsKg > 0 ? itemsKg : Number(mergedOrder.totalKilograms) || 0;
      const kilosEntregados = Number(summary.kilosDelivered ?? 0);
      const kilosFaltantes = mergedOrder.isClosedShort || !isProductionTracked(mergedOrder) ? 0 : Math.max(0, kilosPedidos - kilosEntregados);
      const kilosFacturados = Number(summary.kilosInvoiced ?? 0);
      const kilosPendientesFacturar = summary.invoiceQuantityPending || (mergedOrder.isClosedShort && kilosFacturados >= summary.kilosBillableDelivered - 0.05) ? 0 : Math.max(0, summary.kilosBillableDelivered - kilosFacturados);

      const invoices = (mergedOrder.invoices ?? []).map(inv => {
        const st = inv.creditCycle?.status ?? 'pending';
        return {
          folio: inv.folio ?? '—',
          kilos: Number(inv.kilos) || 0,
          amount: inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0,
          cr: extractCr(inv, mergedOrder),
          dueDate: toDate(inv.creditCycle?.dueDate),
          status: st,
          paid: st === 'paid' || st === 'collected',
          order: mergedOrder,
        };
      });

      const totalVentaFacturada = invoices.reduce((acc, i) => acc + i.amount, 0);
      const allInvoicesPaid = invoices.length > 0 && invoices.every(i => i.paid || i.status === 'collected' || i.status === 'paid');
      const allDelivered = (kilosPedidos > 0 && kilosEntregados >= kilosPedidos - 0.01) || (kilosPedidos === 0 && kilosEntregados > 0);
      const ocCreditStatus = mergedOrder.creditCycle?.status ?? ('' as OrderStatus);
      const isCompleted = ocCreditStatus === 'completed' || Boolean(mergedOrder.isClosedShort && allInvoicesPaid) || ((summary.status === 'collected' || summary.status === 'paid') && allInvoicesPaid && (allDelivered || kilosFaltantes <= 0.01 || Boolean(mergedOrder.isClosedShort)));

      let statusCategory: OcGroup['statusCategory'] = 'en_cobranza';
      if (!isProductionTracked(mergedOrder)) {
        statusCategory = allInvoicesPaid ? 'completada' : 'en_cobranza';
      } else if (isCompleted) {
        statusCategory = 'completada';
      } else if (kilosFaltantes > 0.01 && !mergedOrder.isClosedShort) {
        statusCategory = 'por_entregar';
      } else if (kilosPendientesFacturar > 0.01) {
        statusCategory = 'pendiente_factura';
      } else if (invoices.length > 0 && !allInvoicesPaid) {
        statusCategory = 'en_cobranza';
      } else {
        statusCategory = 'completada';
      }

      list.push({
        oc: primaryOrder.oc || primaryOrder.folio || ocKey,
        order: mergedOrder,
        kilosPedidos: round2(kilosPedidos),
        kilosEntregados: round2(kilosEntregados),
        kilosFaltantes: round2(kilosFaltantes),
        kilosFacturados: round2(kilosFacturados),
        kilosPendientesFacturar: round2(kilosPendientesFacturar),
        totalVentaFacturada: round2(totalVentaFacturada),
        statusCategory,
        invoices,
      });
    }

    return list.sort((a, b) => {
      if (a.oc === 'SIN-OC') return 1;
      if (b.oc === 'SIN-OC') return -1;
      return b.oc.localeCompare(a.oc);
    });

}
