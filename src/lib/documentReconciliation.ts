import type {PurchaseOrder, PurchaseOrderItem,InvoiceQuantityPolicy} from './types';
import {round2, normalizarTexto} from '../../functions/src/shared/finance.core';
import {deliveryPhysicalKilos,billableLineQuantity} from './billingQuantities';

export interface RemissionItem {description:string; quantity:number; unitPrice:number; amount:number; code?:string}
export interface ParsedRemission {folio:string; oc:string; date:string; kilos:number; subtotal:number; total:number; items:RemissionItem[]}
const number=(value:string)=>Number(value.replace(/[$,\s]/g,''));

/** Recognizes delivery evidence before fiscal documents, and checks every printed line. */
export function parseDeliveryDocument(text:string):ParsedRemission|null {
  if(!/ORDEN\s+DE\s+ENTREGA|REMISI[OÓ]N/i.test(text))return null;
  const oc=text.match(/\bOC\s*[:.#-]?\s*(120\d{8,9})\b/i)?.[1]||'';
  const folio=text.match(/ORDEN\s+DE\s+ENTREGA\s*[:#-]?\s*(\d{6,10})/i)?.[1]||text.match(/REMISI[OÓ]N\s*(?:NO\.?|N[ÚU]MERO|FOLIO|#)?\s*[:#-]?\s*(\d{4,10})/i)?.[1]||'';
  const dateMatch=text.match(/FECHA\s*:?\s*(\d{2})[/-](\d{2})[/-](\d{4})/i);
  const date=dateMatch?`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`:'';
  const items:RemissionItem[]=[];
  for(const raw of text.split(/\r?\n/)){
    const match=raw.trim().match(/^([\d,]+(?:\.\d+)?)\s*KG\s+(.+?)\s+\$?\s*([\d,]+\.\d{2})\s+\$?\s*([\d,]+\.\d{2})\s*$/i);
    if(!match)continue;
    const item={quantity:number(match[1]),description:match[2].trim(),unitPrice:number(match[3]),amount:number(match[4])};
    if(!item.quantity||!item.unitPrice||Math.abs(round2(item.quantity*item.unitPrice)-item.amount)>0.01)throw new Error('La partida de la remisión no cuadra: '+item.description);
    items.push(item);
  }
  const subtotal=number(text.match(/SUB\s*TOTAL\s*\$?\s*([\d,]+\.\d{2})/i)?.[1]||'');
  const total=number(text.match(/(?:^|\n)\s*TOTAL\s*\$?\s*([\d,]+\.\d{2})/i)?.[1]||'');
  if(!oc||!folio||!date||!items.length||!subtotal||!total)throw new Error('Se detectó una remisión, pero faltan folio, OC, fecha, partidas o importes legibles. Revisa el original.');
  if(Math.abs(round2(items.reduce((sum,item)=>sum+item.amount,0))-subtotal)>0.01||Math.abs(round2(subtotal*1.16)-total)>0.02)throw new Error('Las partidas o el total de la remisión no cuadran. Revisa la lectura.');
  return {folio,oc,date,kilos:round2(items.reduce((sum,item)=>sum+item.quantity,0)),subtotal,total,items};
}

/** A 60+40 cm gusset has the same developed width as the OC's 100 cm. */
export function productDimensions(description:string):string|null {
  const match=description.toUpperCase().match(/(\d+(?:\.\d+)?)(?:\s*\+\s*(\d+(?:\.\d+)?))?\s*(CM|M)?\s*[X×]\s*(\d+(?:\.\d+)?)\s*(CM|M)?/);
  if(!match)return null;
  const width=(Number(match[1])+Number(match[2]||0))*(match[3]==='M'?100:1);
  const length=Number(match[4])*(match[5]==='M'?100:1);
  return `${round2(width)}x${round2(length)}`;
}
export function reconcileRemissionItems(order:PurchaseOrder,items:RemissionItem[]):{items:{itemId:string;quantity:number}[];warnings:string[]}{
  const used=new Set<string>();
  const warnings:string[]=[];
  const mapped=items.map(item=>{
    const dimensions=productDimensions(item.description);
    const matches=(order.items||[]).filter(candidate=>(item.code&&candidate.code===item.code)||
      (dimensions&&(productDimensions(candidate.description)===dimensions||candidate.dimensionAliases?.includes(dimensions)))||normalizarTexto(candidate.description)===normalizarTexto(item.description));
    if(matches.length!==1||used.has(matches[0]?.id))throw new Error('No hay una partida única de la OC para '+item.description+'. Revisa las medidas.');
    if(Math.abs(matches[0].unitPrice-item.unitPrice)>0.001)throw new Error('El precio de la remisión difiere del precio autorizado en la OC.');
    used.add(matches[0].id);return {itemId:matches[0].id,quantity:item.quantity};
  });
  return {items:mapped,warnings};
}
export function mapRemissionItems(order:PurchaseOrder,items:RemissionItem[]):{itemId:string;quantity:number}[]{
  return reconcileRemissionItems(order,items).items;
}
export function parseVisionRemission(data:any):ParsedRemission {
  if(data?.tipoDocumento!=='remision')throw new Error('El lector visual no identificó una remisión. Revisa el tipo de documento.');
  if(!Array.isArray(data.conceptos)||!data.conceptos.length)throw new Error('El lector visual no pudo leer todas las partidas.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.fecha||''))throw new Error('No se pudo comprobar la fecha de la remisión.');
  const lines=data.conceptos.map((item:any)=>{
    if([item.cantidad,item.precioUnitario,item.importe].some(value=>typeof value!=='number'||!Number.isFinite(value)))throw new Error('Partida visual incompleta.');
    return `${item.cantidad} KG ${item.descripcion} $${item.precioUnitario.toFixed(2)} $${item.importe.toFixed(2)}`;
  });
  if(typeof data.subtotal!=='number'||typeof data.total!=='number')throw new Error('Importes visuales incompletos.');
  const text=`ORDEN DE ENTREGA ${data.folio}\nFECHA: ${data.fecha.split('-').reverse().join('/')}\nOC:${data.oc}\n${lines.join('\n')}\nSUB TOTAL $${data.subtotal.toFixed(2)}\nTOTAL $${data.total.toFixed(2)}`;
  return parseDeliveryDocument(text)!;
}
export function invoiceItemsFromRemission(order:PurchaseOrder,items:RemissionItem[],policy?:InvoiceQuantityPolicy):PurchaseOrderItem[]{
  return mapRemissionItems(order,items).map(line=>{
    const contract=order.items!.find(item=>item.id===line.itemId)!;
    const quantity=billableLineQuantity(line.quantity,policy);
    return {...contract,quantity,amount:round2(quantity*contract.unitPrice)};
  });
}

export interface SupplierDeliveryMatch {status:'matched'|'ambiguous'|'unresolved'; orderId?:string; oc?:string; deliveryId?:string; reportedOc:string; ocMismatch:boolean; quantityDifference?:number; warnings:string[]}
/** Supplier references cannot override uniquely identified, dated physical evidence. */
export function reconcileSupplierDelivery(row:{date:string;kilos:number;orderReference:string;reference:string},orders:PurchaseOrder[]):SupplierDeliveryMatch {
  const candidates=orders.filter(order=>!order.isDeleted&&!order.isSuperseded).flatMap(order=>(order.deliveries||[]).filter(delivery=>{
    if(delivery.inferredFromInvoice||!delivery.docFolio||delivery.docType!=='remision')return false;
    const raw:any=delivery.date;const date=raw?.toDate?.()||new Date(raw?.__timestamp||raw);
    return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===row.date&&Math.abs(deliveryPhysicalKilos(delivery)-row.kilos)<=0.5;
  }).map(delivery=>({order,delivery})));
  const base={reportedOc:row.orderReference,ocMismatch:false,warnings:[] as string[]};
  if(candidates.length!==1)return {...base,status:candidates.length?'ambiguous':'unresolved',warnings:[candidates.length?'Hay varias remisiones compatibles; no se asignó automáticamente.':'Falta una remisión original compatible para comprobar la OC.']};
  const {order,delivery}=candidates[0];const difference=round2(row.kilos-deliveryPhysicalKilos(delivery));
  base.warnings.push(...(delivery.sourceWarnings||[]).map(warning=>row.reference+': '+warning));
  const mismatch=!!row.orderReference&&row.orderReference!==order.oc;
  if(mismatch)base.warnings.push(`${row.reference}: el estado indica OC ${row.orderReference}; la remisión ${delivery.docFolio} y la OC original corresponden a ${order.oc}.`);
  if(difference)base.warnings.push(`${row.reference}: diferencia de ${difference} kg entre el estado del proveedor y la remisión de entrega.`);
  return {...base,status:'matched',orderId:order.id,oc:order.oc,deliveryId:delivery.id,ocMismatch:mismatch,quantityDifference:difference};
}
