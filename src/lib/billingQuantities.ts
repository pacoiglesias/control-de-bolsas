import type {Delivery, PurchaseOrder, PurchaseOrderItem,InvoiceQuantityPolicy} from './types';
import {round2} from '../../functions/src/shared/finance.core';

export function deliveryPhysicalKilos(delivery: Delivery): number {
  if(delivery.inferredFromInvoice)return 0;
  const items=(delivery.items||[]).reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
  return round2(items>0?items:Number(delivery.kilos)||0);
}
export function deliveryBillableKilos(delivery: Delivery): number {
  const physical=deliveryPhysicalKilos(delivery);if(!physical)return 0;
  if(!delivery.billingQuantityPolicy)return physical;
  return (delivery.items||[]).length?delivery.items!.reduce((sum,item)=>sum+billableLineQuantity(Number(item.quantity)||0,delivery.billingQuantityPolicy),0):billableLineQuantity(physical,delivery.billingQuantityPolicy);
}
export function billableLineQuantity(quantity:number,policy?:InvoiceQuantityPolicy):number {
  if(policy==='truncate_half_kilo_each_line')return Math.floor(quantity*2)/2;
  return policy==='truncate_each_line'?Math.floor(quantity):quantity;
}
export function billableDeliveredKilos(deliveries: Delivery[]): number {
  return round2(deliveries.reduce((sum,delivery)=>sum+deliveryBillableKilos(delivery),0));
}
/** Catalog for invoicing only: a remisión does not establish the OC's ordered quantity. */
export function getInvoiceProductCatalog(order: PurchaseOrder): PurchaseOrderItem[] {
  if(order.items?.length)return order.items;
  const catalog=new Map<string,PurchaseOrderItem>();
  for(const delivery of order.deliveries||[]){if(delivery.inferredFromInvoice)continue;
    for(const item of delivery.invoiceItems||[]){const previous=catalog.get(item.id);catalog.set(item.id,{...item,quantity:(previous?.quantity||0)+item.quantity});}
  }
  return [...catalog.values()];
}

export function assertInvoiceQuantityPolicy(order:PurchaseOrder,kilos:number,items?:PurchaseOrderItem[]) {
  const policy=order.invoiceBillingPolicy;if(!policy)return;
  const step=policy==='truncate_half_kilo_each_line'?2:1;
  if(!Number.isInteger(kilos*step)||(items||[]).some(item=>!Number.isInteger(item.quantity*step)))throw new Error(policy==='truncate_half_kilo_each_line'?'Usa kilos enteros o medios kilos por partida. Las fracciones menores se conservan como merma.':'Esta OC se factura sin decimales. Conserva los kilos físicos y usa kilos enteros por partida.');
}
/** Allocate the full documented supplier cost, including the nonbillable fractions. */
export function getInvoiceDocumentCost(order:PurchaseOrder,kilos:number,invoiceId?:string):{amount:number;needsReview:boolean}|null {
  let pending=kilos;let amount=0;let needsReview=false;
  for(const delivery of order.deliveries||[]){
    const billable=deliveryBillableKilos(delivery);if(!billable||pending<=0)continue;
    const allocations=delivery.invoiceAllocations;
    const allocated=allocations?allocations.filter(allocation=>allocation.invoiceId!==invoiceId).reduce((sum,allocation)=>sum+allocation.kilos,0):delivery.invoiceId===invoiceId?0:(delivery.invoicedKilos??(delivery.invoiced?billable:0));
    const portion=Math.min(pending,Math.max(0,billable-allocated));if(!portion)continue;
    const cost=delivery.supplierCost;if(!cost||!Number.isFinite(cost.amount))return null;
    amount+=round2(cost.amount*(allocated+portion)/billable)-round2(cost.amount*allocated/billable);
    needsReview=needsReview||Boolean(cost.needsReview);pending=round2(pending-portion);
  }
  return pending>0.01?null:{amount:round2(amount),needsReview};
}
