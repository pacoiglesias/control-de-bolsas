import type { PurchaseOrder } from './types';
import { computeDeliveredTotals } from './deliveries';
import { round2 } from './finance';
import { toDate } from './format';
import {billableDeliveredKilos} from './billingQuantities';

export type WorkCategory = 'delivery' | 'invoice' | 'receipt' | 'collection' | 'cash';
export interface OperationalTask {
  id: string;
  orderId: string;
  invoiceId?: string;
  category: WorkCategory;
  title: string;
  detail: string;
  action: string;
  needsReview?: boolean;
  reference: string;
  client: string;
  kilos?: number;
  amount?: number;
  urgent: boolean;
  sortDate: number;
}

/** Una siguiente acción por factura; el cierre de producción no oculta la cobranza. */
export function buildOperationalTasks(orders: PurchaseOrder[], now = new Date()): OperationalTask[] {
  const tasks: OperationalTask[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const order of orders) {
    if (order.isDeleted || (order as any).isSuperseded) continue;
    const base = { orderId: order.id, reference: order.oc || order.folio || 'Sin folio', client: order.client || 'Sin cliente' };
    const delivered = computeDeliveredTotals(order.deliveries ?? [], order.items).kilosEntregados;
    const invoiced = (order.invoices ?? []).reduce((sum, invoice) => sum + (Number(invoice.kilos) || 0), 0);
    const itemKilos = (order.items ?? []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    const pendingDelivery = round2(Math.max(0, (itemKilos || order.totalKilograms || 0) - delivered));
    const date = toDate(order.estimatedDeliveryDate);
    if (!order.isClosedShort && (order as any).productionTrackingEnabled!==false && pendingDelivery > 0.01) {
      tasks.push({ ...base, id: `delivery-${order.id}`, category: 'delivery', title: 'Registrar la siguiente entrega',
        detail: date ? `Programada: ${date.toLocaleDateString('es-MX')}` : 'Falta programar la entrega.',
        action: 'Registrar entrega', kilos: pendingDelivery, urgent: Boolean(date && date.getTime() < today), sortDate: date?.getTime() ?? Infinity });
    }
    const quantityPending=(order.invoices||[]).some(invoice=>(invoice as any).quantityPending);
    const pendingInvoice = quantityPending?0:round2(Math.max(0, billableDeliveredKilos(order.deliveries||[]) - invoiced));
    if(quantityPending&&delivered>0)tasks.push({...base,id:'fiscal-quantity-'+order.id,category:'invoice',title:'Completar facturas existentes',detail:'Hay entregas y facturas registradas sin kilos o conceptos. Vincula el XML/PDF antes de crear otra venta.',action:'Completar facturas',needsReview:true,urgent:false,sortDate:0});
    if (pendingInvoice > 0.01) tasks.push({ ...base, id: `invoice-${order.id}`, category: 'invoice',
      title: delivered > (itemKilos || order.totalKilograms || 0) + 0.01 ? 'Revisar kilos entregados contra la orden' : 'Registrar factura de kilos entregados',
      detail: delivered > (itemKilos || order.totalKilograms || 0) + 0.01 ? 'Las entregas superan los kilos pedidos. Revisa la orden y las remisiones antes de facturar.' : 'La entrega ya está registrada. Vincula la factura para continuar a cobranza.',
      action: delivered > (itemKilos || order.totalKilograms || 0) + 0.01 ? 'Revisar expediente' : 'Registrar factura',
      needsReview: delivered > (itemKilos || order.totalKilograms || 0) + 0.01,
      kilos: pendingInvoice, urgent: false, sortDate: 0 });

    for (const invoice of order.invoices ?? []) {
      const status = invoice.creditCycle?.status;
      if (status === 'collected' || invoice.collection?.collectedAt) continue;
      const invoiceBase = { ...base, invoiceId: invoice.id, id: `invoice-task-${order.id}-${invoice.id}` };
      const label = invoice.folio || 'sin folio';
      const total = invoice.financials?.invoiceTotal ?? invoice.financials?.saleTotal ?? 0;
      const remaining = round2(Math.max(0, total - (invoice.collection?.paidAmount ?? 0)));
      const paid = status === 'paid' || Boolean(invoice.collection?.paidAt) || (total > 0 && remaining <= 0.01);
      if (paid) {
        tasks.push({ ...invoiceBase, category: 'cash', title: `Confirmar ingreso · factura ${label}`,
          detail: 'Pago registrado. Verifica la recepción del dinero en Cobranza.', action: 'Revisar ingreso',
          amount: invoice.collection?.paidAmount ?? total, urgent: false, sortDate: 0 });
        continue;
      }
      const due = toDate(invoice.creditCycle?.dueDate);
      const overdue = Boolean(due && due.getTime() < today);
      // El CR debe pertenecer a esta factura: no se hereda de otro documento de la OC.
      if (!invoice.collection?.contrareciboNumber?.trim()) {
        tasks.push({ ...invoiceBase, category: 'receipt', title: `Agregar contrarrecibo · factura ${label}`,
          detail: 'Falta el contrarrecibo para gestionar el cobro.', action: 'Agregar contrarrecibo',
          amount: remaining, urgent: overdue, sortDate: due?.getTime() ?? Infinity });
      } else {
        tasks.push({ ...invoiceBase, category: 'collection', title: `${overdue ? 'Cobro vencido' : 'Dar seguimiento al cobro'} · factura ${label}`,
          detail: due ? `Vencimiento: ${due.toLocaleDateString('es-MX')}` : 'Falta definir la fecha de vencimiento.',
          action: 'Ver cobranza', amount: remaining, urgent: overdue, sortDate: due?.getTime() ?? Infinity });
      }
    }
  }
  const rank: Record<WorkCategory, number> = { invoice: 0, receipt: 1, cash: 2, collection: 3, delivery: 4 };
  return tasks.sort((a, b) => Number(b.urgent) - Number(a.urgent) || rank[a.category] - rank[b.category] || a.sortDate - b.sortDate || a.id.localeCompare(b.id));
}
