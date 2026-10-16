import {collection,getDocs,doc,runTransaction,Timestamp} from 'firebase/firestore';
import {auth,db,PATHS} from './firebase';
import {planProvidenciaReconciliation,type ReconciliationSource} from './providenciaReconciliation';
import {cleanUndefined} from './cleanUndefined';

function hydrate(value:any):any {
  if(value?.__timestamp) return Timestamp.fromDate(new Date(value.__timestamp));
  if(value instanceof Timestamp) return value;
  if(Array.isArray(value))return value.map(hydrate);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([k,v])=>[k,hydrate(v)]));
  return value;
}

/** Applies all related portal documents together; a changed snapshot aborts the whole commit. */
export async function applyStoredProvidenciaReconciliation() {
  const [ordersSnap,invoiceSnap,sourceSnap]=await Promise.all([getDocs(collection(db,PATHS.orders)),getDocs(collection(db,PATHS.invoices)),getDocs(collection(db,'storedDocuments'))]);
  const sourceDocs=sourceSnap.docs.filter(d=>d.data().evidence);
  const sources=sourceDocs.map(d=>({id:d.id,evidence:d.data().evidence} as ReconciliationSource));
  if(!sources.some(s=>s.evidence.kind==='invoice_list'))return null;
  const existing=ordersSnap.docs.map(d=>({id:d.id,data:d.data()}));
  const mirror=invoiceSnap.docs.map(d=>({id:d.id,data:d.data()}));
  const plan=planProvidenciaReconciliation(sources,existing,mirror,new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'}));
  if(plan.unresolved.length)throw new Error('Falta detalle para conciliar: '+plan.unresolved.join('; '));
  const updates:Array<{path:string;data:any}>=[];
  for(const order of plan.orders)updates.push({path:PATHS.orders+'/'+order.id,data:hydrate(order)});
  for(const invoice of plan.invoices)updates.push({path:PATHS.invoices+'/'+invoice.id,data:hydrate(invoice)});
  for(const old of existing)if(/^(?:CR-)?(?:GT|TH)-/i.test(old.data.oc||old.data.folio||'') && plan.receipts.some(r=>r.cr===(old.data.oc||old.data.folio)))
    updates.push({path:PATHS.orders+'/'+old.id,data:{...old.data,isSuperseded:true,supersededReason:'Detalle individual conciliado desde documentos Providencia; original conservado.',supersededAt:Timestamp.now()}});
  for(const old of mirror)if(!plan.invoices.some(i=>i.id===old.id) && (plan.invoices.some(i=>i.folio===old.data.folio) || plan.receipts.some(r=>r.cr===old.data.collection?.contrareciboNumber)))
    updates.push({path:PATHS.invoices+'/'+old.id,data:{...old.data,isSuperseded:true,supersededReason:'Espejo anterior; ver factura individual prov-invoice-{folio}.'}});
  for(const source of sourceDocs)updates.push({path:'storedDocuments/'+source.id,data:{...source.data(),reconciliation:{applied:true,appliedAt:Timestamp.now(),summary:plan.summary,matches:plan.matches,requirements:plan.requirements},notes:'Información aplicada a órdenes, facturas y cobranza. Ver conciliación y trazabilidad.'}});
  const id='providencia-reconciliation-'+Date.now();
  const snapshots=[...ordersSnap.docs,...invoiceSnap.docs,...sourceDocs];
  const paymentRecords=plan.invoices.flatMap(invoice=>(invoice.collection?.paymentsHistory||[]).filter((p:any)=>String(p.receiptId).startsWith('PROV_'+invoice.folio+'_')).map((p:any)=>({
    ref:doc(db,'payment_receipts',p.receiptId),data:hydrate({receiptKey:p.receiptId,orderId:invoice.orderId,invoiceId:invoice.id,invoiceFolio:invoice.folio,
      amount:p.amount,status:'applied',bankReference:invoice.collection.transferRef||invoice.collection.paymentComplementUuid,
      appliedBy:auth.currentUser?.email||auth.currentUser?.uid,appliedAt:Timestamp.now(),paymentDate:p.date,sourceDocuments:invoice.sourceDocuments,cashReceived:false})
  })));
  const audit=cleanUndefined({userId:auth.currentUser?.uid,createdAt:Timestamp.now(),action:'PROVIDENCIA_DOCUMENT_RECONCILIATION',summary:plan.summary,sources:sources.map(s=>s.id),matches:plan.matches,requirements:plan.requirements,beforeOrders:existing,beforeInvoices:mirror});
  if(new TextEncoder().encode(JSON.stringify(audit)).length>850000)throw new Error('El historial requiere respaldo por etapas antes de aplicar este lote.');
  if(updates.length+paymentRecords.length>450)throw new Error('El lote excede el límite seguro. Requiere conciliación por etapas.');
  await runTransaction(db,async txn=>{
    for(const snapshot of snapshots) {
      const fresh=await txn.get(snapshot.ref);
      if(JSON.stringify(fresh.data())!==JSON.stringify(snapshot.data()))throw new Error('Los datos cambiaron durante la revisión. Vuelve a procesar el documento.');
    }
    const originalPaths=new Set(snapshots.map(snapshot=>snapshot.ref.path));
    for(const update of updates)if(!originalPaths.has(update.path)) {
      if((await txn.get(doc(db,update.path))).exists())throw new Error('Se creó un registro durante la revisión. Vuelve a procesar para conservarlo.');
    }
    const paymentExists:boolean[]=[];
    for(const payment of paymentRecords)paymentExists.push((await txn.get(payment.ref)).exists());
    for(const update of updates)txn.set(doc(db,update.path),cleanUndefined(update.data));
    paymentRecords.forEach((payment,index)=>{if(!paymentExists[index])txn.set(payment.ref,cleanUndefined(payment.data));});
    txn.set(doc(db,'history',id),audit);
  });
  return {...plan.summary,auditId:id};
}
