import {collection,getDocs,doc,getDoc,runTransaction,Timestamp,serverTimestamp} from 'firebase/firestore';
import {auth,db,PATHS} from './firebase';
import {cleanUndefined} from './cleanUndefined';
import type {PurchaseOrder} from './types';
import type {SupplierStatement} from './andresStatement';
import {planSupplierStatement} from './supplierStatementPlan';

function hydrate(value:any):any {
  if(value?.__timestamp)return Timestamp.fromDate(new Date(value.__timestamp));
  if(value instanceof Timestamp)return value;
  if(Array.isArray(value))return value.map(hydrate);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,hydrate(item)]));
  return value;
}
export async function applySupplierStatement(statement:SupplierStatement,documentId:string){
  const cfgRef=doc(db,PATHS.config,PATHS.configFinancials);
  const [purchases,expenses,orders,cfg]=await Promise.all([getDocs(collection(db,PATHS.purchases)),getDocs(collection(db,PATHS.expenses)),getDocs(collection(db,PATHS.orders)),getDoc(cfgRef)]);
  const rows=(snapshot:any)=>snapshot.docs.map((item:any)=>({...item.data(),id:item.id}));
  const plan=planSupplierStatement(statement,documentId,rows(purchases),rows(orders) as PurchaseOrder[],cfg.data()||{},rows(expenses));
  const snapshots=[...purchases.docs,...expenses.docs,...orders.docs,cfg];
  const updates=[...plan.purchases,...plan.superseded];
  if(updates.length>350)throw new Error('El estado requiere revisión por etapas por su tamaño.');
  const audit={userId:auth.currentUser?.uid||'',action:'SUPPLIER_STATEMENT_RECONCILIATION',sourceDocumentId:documentId,summary:plan.summary,matches:plan.matches,beforeConfig:cfg.data()||{},beforePurchases:rows(purchases)};
  if(new TextEncoder().encode(JSON.stringify(audit)).length>800000)throw new Error('El historial requiere respaldo por etapas antes de aplicar.');
  await runTransaction(db,async txn=>{
    for(const original of snapshots){const current=await txn.get(original.ref);if(JSON.stringify(current.data())!==JSON.stringify(original.data()))throw new Error('Los datos cambiaron durante la conciliación. Vuelve a procesar el estado.');}
    for(const purchase of plan.purchases.filter(purchase=>!purchases.docs.some(original=>original.id===purchase.id)))if((await txn.get(doc(db,PATHS.purchases,purchase.id))).exists())throw new Error('El movimiento ya fue creado en otra sesión. Vuelve a procesar.');
    updates.forEach(purchase=>txn.set(doc(db,PATHS.purchases,purchase.id),cleanUndefined(hydrate(purchase))));
    plan.deliveryOrders.forEach(order=>txn.update(doc(db,PATHS.orders,order.id),{deliveries:cleanUndefined(hydrate(order.deliveries)),updatedAt:serverTimestamp()}));
    txn.set(cfgRef,cleanUndefined(plan.config));
    txn.set(doc(db,'storedDocuments',documentId),{reconciliation:{applied:true,summary:plan.summary,matches:plan.matches,warnings:plan.warnings,appliedAt:serverTimestamp()}},{merge:true});
    txn.set(doc(db,'history','supplier-statement-'+crypto.randomUUID()),cleanUndefined({...audit,createdAt:serverTimestamp()}));
  });
  return plan;
}

export async function reconcileCurrentSupplierStatement(){
  const config=await getDoc(doc(db,PATHS.config,PATHS.configFinancials));
  const id=config.data()?.providerStatement?.documentId;if(!id)return null;
  const source=await getDoc(doc(db,'storedDocuments',id));
  if(!source.data()?.supplierStatement)return null;
  return applySupplierStatement(source.data()!.supplierStatement,id);
}
