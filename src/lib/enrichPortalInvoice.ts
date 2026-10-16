import { round2 } from './finance';
import type { Invoice, PurchaseOrderItem } from './types';

/** Complete an existing portal row without creating a second sale or resetting payments. */
export function enrichPortalInvoice(current:Invoice,input:{uuid:string;total:number;subtotal:number;items?:PurchaseOrderItem[]}) {
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(input.uuid))throw new Error('Falta un UUID fiscal válido para completar esta factura.');
  if(current.uuid && current.uuid.toUpperCase()!==input.uuid.toUpperCase())throw new Error('El UUID no coincide con la factura registrada. Revisa el documento.');
  if(Math.abs((current.financials?.invoiceTotal||0)-input.total)>0.01)throw new Error('El total del documento no coincide con el portal. No se modificó la factura.');
  if(!(input.subtotal>0) || input.subtotal>input.total)throw new Error('Falta un subtotal válido en el documento.');
  const items=input.items||[];
  const kg=round2(items.reduce((sum,i)=>sum+i.quantity,0));
  if(items.length && (items.some(i=>i.quantity<=0 || i.unit!=='KGM') || Math.abs(round2(items.reduce((s,i)=>s+i.amount,0))-input.subtotal)>0.02))throw new Error('Los conceptos deben estar en kilos y sumar el subtotal. Revisa descuentos o unidades.');
  return {...current,uuid:input.uuid.toUpperCase(),...(kg>0?{items,kilos:kg,quantityPending:false}:{}),
    financials:{...current.financials!,saleTotal:input.subtotal,commission:round2(input.subtotal*0.08),commissionRate:0.08,
      ...(kg>0?{salePricePerKg:input.subtotal/kg,isEstimatedPrice:false}:{}),
      ...(current.financials?.isEstimatedCost?{netCashFlow:0,tradeMargin:0}:{netCashFlow:round2(input.total-(current.financials?.costTotal||0)-input.subtotal*0.08),tradeMargin:round2(input.subtotal-(current.financials?.costTotal||0))})},
    reconciliation:{...(current as any).reconciliation,detailsVerified:true}};
}
