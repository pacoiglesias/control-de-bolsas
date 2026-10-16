import { round2 } from './finance';
import type { ProvidenciaEvidence, PortalInvoiceRow, PortalReceiptRow } from './providenciaEvidence';

export interface ReconciliationSource { id: string; evidence: ProvidenciaEvidence }
export interface PersistedRecord { id: string; data: Record<string, any> }
const validUuid=(value: unknown) => typeof value==='string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const dept=(oc:string)=>oc.startsWith('1202671')?'TH':oc.startsWith('1202643')?'GT':'';
const folioFor=(oc:string)=>oc.startsWith('1202671')?'71/'+oc.slice(7):oc.startsWith('1202643')?'43/'+oc.slice(7):oc;
const timestamp=(date:string)=>({__timestamp:new Date(date+(date.length===10?'T12:00:00-06:00':'-06:00')).toISOString()});
const cents=(n:number)=>Math.round(n*100);

/** A deterministic plan. It changes nothing until its caller commits with version preconditions. */
export function planProvidenciaReconciliation(sources:ReconciliationSource[], existingOrders:PersistedRecord[], mirror:PersistedRecord[], now=new Date().toLocaleDateString('en-CA',{timeZone:'America/Mexico_City'}), transfers:Array<{folio:string;cr:string;reference:string;date:string;amount:number}>=[]) {
  const invoices=new Map<string,PortalInvoiceRow & {source:string}>();
  const receipts=new Map<string,PortalReceiptRow & {source:string}>();
  const rep=new Map<string,any>();
  for(const source of [...sources].sort((a,b)=>a.evidence.capturedDate.localeCompare(b.evidence.capturedDate))) {
    if(source.evidence.warnings.some(w=>!w.startsWith('Listado parcial:'))) throw new Error('Documento con errores de lectura: '+source.id);
    for(const row of source.evidence.invoices) {
      const previous=invoices.get(row.folio);
      if(previous && (previous.oc!==row.oc || cents(previous.total)!==cents(row.total))) throw new Error('Fuentes contradictorias para factura '+row.folio);
      invoices.set(row.folio,{...row,source:source.id});
    }
    for(const row of source.evidence.receipts) receipts.set(row.cr,{...row,source:source.id});
    for(const row of source.evidence.allocations) rep.set(row.folio,{...row,source:source.id,repUuid:source.evidence.uuid,repFolio:source.evidence.folio,date:source.evidence.paymentDate});
  }
  const assigned=new Map<string,string>();
  const matches:Array<{cr:string;folios:string[];method:string;source:string}>=[];
  const unresolved:string[]=[];
  for(const receipt of [...receipts.values()].sort((a,b)=>a.issueDate.localeCompare(b.issueDate)||a.cr.localeCompare(b.cr))) {
    const eligible=[...invoices.values()].filter(i=>!assigned.has(i.folio) && dept(i.oc)===receipt.cr.slice(0,2) && i.issueDate.slice(0,10)<=receipt.issueDate);
    const solutions:PortalInvoiceRow[][]=[];
    const search=(at:number,sum:number,rows:PortalInvoiceRow[])=>{
      if(sum===cents(receipt.total)) {solutions.push(rows);return;}
      if(sum>cents(receipt.total) || rows.length>=6 || solutions.length>1) return;
      for(let i=at;i<eligible.length;i++) search(i+1,sum+cents(eligible[i].total),[...rows,eligible[i]]);
    };
    search(0,0,[]);
    if(solutions.length===1) {
      const rows=solutions[0];for(const row of rows) assigned.set(row.folio,receipt.cr);
      matches.push({cr:receipt.cr,folios:rows.map(r=>r.folio),method:'unique_department_date_exact_sum',source:receipt.source});
    } else if(receipt.remaining>0) unresolved.push(receipt.cr+': '+(solutions.length?'asignación ambigua':'faltan facturas del detalle'));
  }
  const candidates=[...existingOrders.flatMap(o=>(o.data.invoices||[]).map((i:any)=>({...i,__sourceOrder:o.id}))),...mirror.map(i=>({...i.data,__mirror:i.id}))];
  const normalized:any[]=[];
  const requirements:string[]=[];
  for(const row of invoices.values()) {
    const fiscalCandidates=candidates.filter(i=>String(i.folio||'').replace(/^F[-\s]*/i,'')===row.folio && validUuid(i.uuid));
    const knownUuids=[...new Set(fiscalCandidates.map(i=>i.uuid.toUpperCase()))];
    if(knownUuids.length>1 && !rep.has(row.folio))throw new Error('Hay UUID distintos para la factura '+row.folio+'. Requiere revisión fiscal.');
    const possible=candidates.filter(i=>String(i.folio||'').replace(/^F[-\s]*/i,'')===row.folio && (cents(i.financials?.invoiceTotal||0)===cents(row.total) || cents(round2((i.financials?.saleTotal||0)*1.16))===cents(row.total)));
    const score=(i:any)=> (validUuid(i.uuid)?100:0)+(i.items?.length?20:0)+(i.__mirror?10:0)+(i.financials?.saleTotal?5:0);
    const best=possible.sort((a,b)=>score(b)-score(a))[0] || {};
    const fiscal=rep.get(row.folio);
    if(fiscal && cents(fiscal.previous)!==cents(row.total) && fiscal.installment===1) throw new Error('El saldo inicial del REP no coincide con factura '+row.folio);
    const cr=assigned.get(row.folio)||'';const receipt=receipts.get(cr);
    const transfer=transfers.find(t=>t.folio===row.folio && cents(t.amount)===cents(fiscal?.paid||row.total));
    if(transfer && cr && transfer.cr!==cr) throw new Error('TR y contrarrecibo no coinciden para factura '+row.folio);
    const quantityCandidate=possible.find(i=>Number(i.kilos)>0 && Number(i.financials?.salePricePerKg)>0 && Math.abs(round2(i.kilos*i.financials.salePricePerKg*1.16)-row.total)<=0.05) || best;
    const unit=Number(quantityCandidate.financials?.salePricePerKg)||0;
    const recordedKg=Number(quantityCandidate.kilos)||0;
    const quantityVerified=recordedKg>0 && unit>0 && Math.abs(round2(recordedKg*unit*1.16)-row.total)<=0.05;
    const kg=quantityVerified?recordedKg:0;
    const subtotal=best.financials?.saleTotal && Math.abs(round2(best.financials.saleTotal*1.16)-row.total)<=0.02 ? best.financials.saleTotal : round2(row.total/1.16);
    const costKnown=quantityVerified && Number(best.financials?.costTotal)>0 && best.financials?.isEstimatedCost!==true;
    const commission=round2(subtotal*0.08);
    const sourcePaid=receipt?.status==='PAGADO' ? row.total : (fiscal ? round2(row.total-fiscal.remaining) : 0);
    const paid=Math.min(row.total,Math.max(sourcePaid,Number(best.collection?.paidAmount)||0));
    const cashConfirmed=Boolean(best.collection?.collectedAt);
    const status=cashConfirmed && paid>=row.total-0.01?'collected':paid>=row.total-0.01?'paid':receipt?(receipt.dueDate<now?'overdue':'pending'):'facturado';
    const id='prov-invoice-'+row.folio;const orderId='oc-'+row.oc;
    const history=best.collection?.paymentsHistory||[];
    const paymentId=fiscal?'PROV_'+row.folio+'_'+fiscal.date.replace(/-/g,'')+'_'+cents(fiscal.paid):'';
    const paymentDate=fiscal?timestamp(fiscal.date):undefined;
    normalized.push({
      ...best,id,orderId,oc:row.oc,folio:row.folio,isDeleted:false,isSuperseded:false,uuid:fiscal?.uuid || knownUuids[0] || '',
      kilos:kg,items:quantityVerified?(quantityCandidate.items||[]):[],quantityPending:!quantityVerified,
      financials:{...(best.financials||{}),invoiceTotal:row.total,saleTotal:subtotal,salePricePerKg:quantityVerified?unit:0,
        costPricePerKg:costKnown?best.financials.costPricePerKg:0,costTotal:costKnown?best.financials.costTotal:0,
        commissionRate:0.08,commission,tradeMargin:costKnown?round2(subtotal-best.financials.costTotal):0,
        netCashFlow:costKnown?round2(row.total-best.financials.costTotal-commission):0,isEstimatedCost:!costKnown,isEstimatedPrice:!quantityVerified},
      creditCycle:{status,issueDate:timestamp(row.issueDate),...(receipt?{dueDate:timestamp(receipt.dueDate)}:{})},
      collection:{...(best.collection||{}),contrareciboNumber:cr,contrareciboDate:receipt?timestamp(receipt.issueDate):null,
        paidAmount:paid,paidAt:paymentDate||(paid>0?best.collection?.paidAt:null)||null,collectedAt:cashConfirmed?best.collection.collectedAt:null,
        ...(transfer?{transferRef:transfer.reference}:{}),
        ...(fiscal?{complementStatus:'issued',paymentComplementUuid:fiscal.repUuid,paymentComplementFolio:fiscal.repFolio,
          paymentsHistory:history.some((h:any)=>h.receiptId===paymentId)?history:[...history,{receiptId:paymentId,reference:transfer?.reference||fiscal.repUuid,amount:fiscal.paid,date:paymentDate,notes:'Pago acreditado por REP '+fiscal.repFolio}]}:{}),
      },
      sourceDocuments:[...new Set([row.source,receipt?.source,fiscal?.source].filter(Boolean))],
      reconciliation:{version:1,invoiceSource:row.source,receiptSource:receipt?.source||'',matchMethod:cr?'unique_department_date_exact_sum':'unassigned',
        previousOrderId:best.__sourceOrder||best.orderId||'',quantityBasis:quantityVerified?'recorded_quantity_price_total_agree':'unknown',cashReceived:cashConfirmed},
      __sourceOrder:undefined,__mirror:undefined,
    });
    if(!quantityVerified) requirements.push('Factura '+row.folio+': faltan XML/PDF con conceptos y kilos.');
    if(!validUuid(fiscal?.uuid||knownUuids[0])) requirements.push('Factura '+row.folio+': falta UUID fiscal.');
  }
  const orderMap=new Map<string,any>();
  for(const invoice of normalized) {
    const id=invoice.orderId;
    if(!orderMap.has(id)) {
      const original=existingOrders.find(o=>o.id===id)?.data||{};
      const correctFolio=folioFor(invoice.oc);
      const mismatched=original.folio && original.folio!==correctFolio && !/^\d+$/.test(original.folio);
      orderMap.set(id,{...original,id,oc:invoice.oc,folio:correctFolio,department:dept(invoice.oc),
        client:'GRUPO TEXTIL PROVIDENCIA SA DE CV',isDeleted:false,isSuperseded:false,
        ...(mismatched?{items:[],totalKilograms:0,orderDocumentPending:true}:{}),
        deliveries:(original.deliveries||[]).map((d:any)=>({...d,...(/^del-billed-|^del-\d{4}$/.test(d.id||'') || d.notes?.startsWith('Entrega fiscal') ? {inferredFromInvoice:true}:{} )})),
        invoices:[],financials:undefined,processedAt:original.processedAt||invoice.creditCycle.issueDate,
        reconciliation:{source:'providencia_documents',version:1,sourceDocuments:[]}});
    }
    orderMap.get(id).invoices.push(invoice);
  }
  for(const order of orderMap.values()) {
    const original=existingOrders.find(o=>o.id===order.id)?.data;
    for(const previous of original?.invoices||[]) {
      const folio=String(previous.folio||'');
      if(folio && !invoices.has(folio) && !/\s|TR_|^(TH|GT)-/i.test(folio)) {
        order.invoices.push(previous);
        requirements.push('Factura '+folio+': se conservó; no está en las páginas del portal recibidas.');
      }
    }
    order.invoiceStatuses=order.invoices.map((i:any)=>i.creditCycle.status);
    order.creditCycle={...(order.creditCycle||{}),status:order.invoiceStatuses.every((s:string)=>s==='paid')?'paid':order.invoiceStatuses.includes('overdue')?'overdue':'pending'};
    order.collection={...(order.collection||{}),paidAmount:round2(order.invoices.reduce((s:number,i:any)=>s+(i.collection?.paidAmount||0),0))};
    order.reconciliation.sourceDocuments=[...new Set(order.invoices.flatMap((i:any)=>i.sourceDocuments||[]))];
  }
  const total=round2(normalized.reduce((s,i)=>s+i.financials.invoiceTotal,0));
  const paid=round2(normalized.reduce((s,i)=>s+i.collection.paidAmount,0));
  const balance=round2(total-paid);
  const sourceBalance=round2([...receipts.values()].reduce((s,r)=>s+r.remaining,0)+normalized.filter(i=>!i.collection.contrareciboNumber).reduce((s,i)=>s+i.financials.invoiceTotal-i.collection.paidAmount,0));
  // Later payments may reduce the balance after the portal snapshot; they must never be erased.
  if(!unresolved.length && balance>sourceBalance+0.01) throw new Error('La conciliación no conserva el saldo: '+balance+' vs '+sourceBalance);
  return {orders:[...orderMap.values()],invoices:normalized,receipts:[...receipts.values()],matches,unresolved,requirements,
    summary:{invoiceCount:normalized.length,invoiceTotal:total,paid,balance,sourceBalance,generatedReceipts:[...receipts.values()].filter(r=>r.remaining>0).length,
      generatedBalance:round2([...receipts.values()].reduce((s,r)=>s+r.remaining,0)),withoutCR:round2(normalized.filter(i=>!i.collection.contrareciboNumber).reduce((s,i)=>s+i.financials.invoiceTotal-i.collection.paidAmount,0))}};
}
