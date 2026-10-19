import type {SupplierStatement} from './andresStatement';
import type {PurchaseOrder} from './types';
import {reconcileSupplierDelivery} from './documentReconciliation';
import {computeAndresBalance,normalizarTexto,round2} from '../../functions/src/shared/finance.core';

/** The original supplier balance remains reported evidence, including flagged arithmetic. */
export function planSupplierStatement(statement:SupplierStatement,documentId:string,purchases:any[],orders:PurchaseOrder[],config:any,expenses:any[]) {
  if(statement.provider!=='Andres'||!statement.rows.length)throw new Error('Estado de proveedor no compatible.');
  if(config.providerStatement?.asOf>statement.asOf)throw new Error('Este estado es anterior al corte vigente. Se conserva como antecedente sin reemplazar el saldo actual.');
  const firstDate=statement.rows.reduce((date,row)=>row.date<date?row.date:date,statement.asOf);
  const timestamp=(date:string)=>({__timestamp:date+'T12:00:00.000Z'});
  const day=(value:any)=>{const date=value?.toDate?.()||new Date(value?.__timestamp||value);return Number.isFinite(date?.getTime?.())?date.toISOString().slice(0,10):'';};
  const covered=(value:any)=>{const date=day(value.date||value.createdAt);return date>=firstDate&&date<=statement.asOf;};
  const matches=statement.rows.filter(row=>row.deliveryAmount).map(row=>({reference:row.reference,...reconcileSupplierDelivery(row,orders)}));
  const warnings=[...statement.warnings,...matches.flatMap(match=>match.warnings.map(warning=>warning.startsWith(match.reference)?warning:match.reference+': '+warning))];
  const canonical=statement.rows.filter(row=>row.deliveryAmount).map(row=>{
    const match=matches.find(candidate=>candidate.reference===row.reference)!;
    return {id:'andres-statement-'+row.reference,provider:'Andres',date:timestamp(row.date),createdAt:timestamp(row.date),expectedKilos:row.kilos,receivedKilos:row.kilos,pricePerKg:row.pricePerKg,totalAmount:row.deliveryAmount,paidAmount:0,status:'recibido',remissionNumber:row.reference,
      documentAmountVerified:true,statementDocumentId:documentId,sourceSequence:row.sequence,reportedOc:row.orderReference,notes:row.notes,
      quantityAmountDifference:row.quantityAmountDifference,needsReview:!!row.quantityAmountDifference||match.status!=='matched'||!!match.quantityDifference||match.ocMismatch,
      ...(match.status==='matched'?{orderId:match.orderId,oc:match.oc,deliveryId:match.deliveryId}:{}),reconciliation:match};
  });
  const deliveryOrders=orders.flatMap(order=>{
    const linked=matches.filter(match=>match.status==='matched'&&match.orderId===order.id);
    if(!linked.length)return [];
    return [{...order,deliveries:(order.deliveries||[]).map(delivery=>{
      const match=linked.find(candidate=>candidate.deliveryId===delivery.id);if(!match)return delivery;
      const row=statement.rows.find(candidate=>candidate.reference===match.reference)!;
      return {...delivery,supplierWarnings:match.warnings,supplierCost:{amount:row.deliveryAmount,kilos:row.kilos,pricePerKg:row.pricePerKg,remission:row.reference,statementDocumentId:documentId,needsReview:Boolean(row.quantityAmountDifference||match.quantityDifference||delivery.sourceWarnings?.length)}};
    })}];
  });
  const canonicalIds=new Set(canonical.map(purchase=>purchase.id));
  const superseded=purchases.filter(purchase=>!purchase.isDeleted&&!purchase.isSuperseded&&normalizarTexto(purchase.provider)==='andres'&&covered(purchase)&&!canonicalIds.has(purchase.id))
    .map(purchase=>({...purchase,isSuperseded:true,supersededBy:documentId,supersededReason:'Sustituido por movimientos individualizados del estado original; registro anterior conservado para auditoría.'}));
  const newConfig={...config,providerBalanceCutoff:firstDate+'T00:00:00.000Z',historicalDebtAndres:-statement.openingSupplierBalance,
    providerStatement:{provider:'Andres',documentId,asOf:statement.asOf,openingSupplierBalance:statement.openingSupplierBalance,closingSupplierBalance:statement.closingSupplierBalance,
      payments:statement.rows.filter(row=>row.payment).map(row=>({id:'andres-statement-'+row.reference,date:row.date+'T12:00:00.000Z',amount:row.payment,sequence:row.sequence})),
      totalPayments:statement.totalPayments,totalDeliveries:statement.totalDeliveries,totalKilos:statement.totalKilos,cumulativePayments:statement.cumulativePayments,cumulativeDeliveries:statement.cumulativeDeliveries,warnings,
      arithmeticDifference:round2(statement.rows.reduce((sum,row)=>sum+Math.abs(row.quantityAmountDifference),0)),referenceCorrections:matches.filter(match=>match.ocMismatch).length,quantityDifferences:matches.filter(match=>match.quantityDifference).length,unmatchedRemissions:matches.filter(match=>match.status!=='matched').length}};
  const replacedIds=new Set([...canonicalIds,...superseded.map(purchase=>purchase.id)]);
  const after=[...purchases.filter(purchase=>!replacedIds.has(purchase.id)),...canonical,...superseded];
  const atCutoff=computeAndresBalance(after.filter(purchase=>day(purchase.date||purchase.createdAt)<=statement.asOf),expenses.filter(expense=>day(expense.date||expense.createdAt)<=statement.asOf),newConfig);
  if(Math.abs(round2(atCutoff.saldoProveedor+statement.closingSupplierBalance))>0.01)throw new Error('Hay compras o pagos adicionales que no cuadran con el estado. Se conserva el original para revisar antes de reemplazar el saldo.');
  return {purchases:canonical,superseded,deliveryOrders,config:newConfig,matches,warnings,summary:atCutoff};
}
