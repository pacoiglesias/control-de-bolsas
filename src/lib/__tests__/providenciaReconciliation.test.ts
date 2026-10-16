import { describe, expect, it } from 'vitest';
import { planProvidenciaReconciliation as plan, type ReconciliationSource } from '../providenciaReconciliation';
import { enrichPortalInvoice } from '../enrichPortalInvoice';
import { buildReceivables } from '../receivables';
import { computeAndresBalance } from '../finance';
import { computeDeliveredTotals } from '../deliveries';
import type { ProvidenciaEvidence } from '../providenciaEvidence';

const source=(part:Partial<ProvidenciaEvidence>,id='source'):ReconciliationSource=>({id,evidence:{kind:'invoice_list',title:'Portal',capturedDate:'2026-10-15',total:0,sourceCount:0,partial:false,receipts:[],invoices:[],allocations:[],uuid:'',folio:'',paymentDate:'',warnings:[],...part}});
const row=(folio:string,total:number,oc='12026431001')=>({folio,total,oc,issueDate:'2026-10-01T12:00:00'});
const receipt=(total:number,status='GENERADO')=>({cr:'GT-1',issueDate:'2026-10-02',dueDate:'2026-11-01',total,paid:status==='PAGADO'?total:0,remaining:status==='PAGADO'?0:total,status});
const uuid='AAAAAAAA-1111-2222-3333-AAAAAAAAAAAA';

describe('Conciliación basada en documentos',()=>{
  it('agrupa varias facturas y OCs por suma exacta, departamento y fechas',()=>{
    const result=plan([source({invoices:[row('1',116),row('2',232,'12026431002'),row('3',348,'12026711003')]}),source({kind:'receipt_list',receipts:[receipt(348)]},'cr')],[],[],'2026-10-15');
    expect(result.matches[0].folios).toEqual(['1','2']);
    expect(result.summary).toMatchObject({invoiceCount:3,invoiceTotal:696,balance:696,generatedBalance:348,withoutCR:348});
    expect(result.orders.flatMap(o=>o.deliveries)).toEqual([]);
    expect(result.invoices.every(i=>i.quantityPending && i.kilos===0)).toBe(true);
  });
  it('detiene una asignación ambigua en vez de elegir una factura por el importe',()=>{
    const result=plan([source({invoices:[row('1',116),row('2',116)]}),source({kind:'receipt_list',receipts:[receipt(116)]})],[],[]);
    expect(result.unresolved).toEqual(['GT-1: asignación ambigua']);
    expect(result.matches).toHaveLength(0);
  });
  it('REP y transferencia acreditan un solo pago y conservan su identidad al repetir',()=>{
    const sources=[source({invoices:[row('1',116)]}),source({kind:'receipt_list',receipts:[receipt(116,'PAGADO')]},'cr'),source({kind:'payment_rep',uuid,folio:'9',paymentDate:'2026-10-13',allocations:[{folio:'1',uuid,previous:116,paid:116,remaining:0,installment:1}]},'rep')];
    const transfers=[{folio:'1',cr:'GT-1',reference:'TR_1',date:'2026-10-13',amount:116}];
    const first=plan(sources,[],[],'2026-10-15',transfers);
    const second=plan(sources,first.orders.map(data=>({id:data.id,data})),first.invoices.map(data=>({id:data.id,data})),'2026-10-15',transfers);
    expect(second.summary).toMatchObject({paid:116,balance:0});
    expect(second.invoices[0].collection.paymentsHistory).toHaveLength(1);
    expect(second.invoices[0].creditCycle.status).toBe('paid');
    expect(second.invoices[0].collection.collectedAt).toBeNull();
    expect(second.invoices[0].reconciliation.cashReceived).toBe(false);
    expect(second.invoices[0].financials.commission).toBe(8);
  });
  it('respeta el precio histórico 47 y no infiere kilos cuando faltan datos',()=>{
    const original={id:'i1',folio:'1',kilos:2,uuid,financials:{invoiceTotal:109.04,saleTotal:94,salePricePerKg:47,costTotal:84,costPricePerKg:42},collection:{},creditCycle:{status:'pending'}};
    const result=plan([source({invoices:[row('1',109.04),row('2',116)]})],[],[{id:'i1',data:original}]);
    expect(result.invoices[0]).toMatchObject({kilos:2,financials:{salePricePerKg:47,costTotal:84,commission:7.52}});
    expect(result.invoices[1]).toMatchObject({kilos:0,uuid:'',quantityPending:true,financials:{costTotal:0,netCashFlow:0,isEstimatedCost:true}});
  });
  it('conserva abonos posteriores al listado y facturas ajenas a las páginas recibidas',()=>{
    const later={id:'i1',folio:'1',financials:{invoiceTotal:116},collection:{paidAmount:20},creditCycle:{status:'in_review'}};
    const other={id:'i9',folio:'9',financials:{invoiceTotal:58},collection:{paidAmount:0},creditCycle:{status:'pending'}};
    const order={id:'oc-12026431001',data:{oc:'12026431001',invoices:[later,other]}};
    const result=plan([source({invoices:[row('1',116)]})],[order],[]);
    expect(result.invoices[0].collection.paidAmount).toBe(20);
    expect(result.orders[0].invoices.map((i:any)=>i.folio)).toEqual(['1','9']);
    expect(result.summary.balance).toBe(96);
  });
  it('una fecha de pago heredada sin abono no liquida una factura pendiente del portal',()=>{
    const old={id:'i1',folio:'1',financials:{invoiceTotal:116},collection:{paidAmount:0,paidAt:'2026-10-09'},creditCycle:{status:'overdue'}};
    const result=plan([source({invoices:[row('1',116)]})],[],[{id:'i1',data:old}]);
    expect(result.invoices[0].collection.paidAt).toBeNull();
    expect(buildReceivables(result.orders).total).toBe(116);
  });
  it('completa conceptos sin duplicar factura, perder pagos ni crear entrega física',()=>{
    const current=plan([source({invoices:[row('1',116)]})],[],[]).invoices[0];
    current.collection={paidAmount:50,contrareciboNumber:'GT-1'};
    const completed=enrichPortalInvoice(current,{uuid,total:116,subtotal:100,items:[{id:'it',description:'Bolsa',quantity:2,unit:'KGM',unitPrice:50,amount:100}]});
    expect(completed).toMatchObject({id:current.id,kilos:2,quantityPending:false,collection:{paidAmount:50,contrareciboNumber:'GT-1'}});
    expect(buildReceivables([{id:'oc',invoices:[completed]}]).total).toBe(66);
    expect(()=>enrichPortalInvoice(current,{uuid,total:117,subtotal:100})).toThrow('no coincide');
  });
  it('una entrega inferida de una factura no acredita kilos físicos',()=>{
    expect(computeDeliveredTotals([{id:'fake',kilos:100,inferredFromInvoice:true},{id:'real',kilos:20}] as any).kilosEntregados).toBe(20);
  });
  it('Andrés usa movimientos posteriores al saldo inicial, costos reales y egresos activos',()=>{
    const result=computeAndresBalance([{provider:'Andrés',receivedKilos:100,pricePerKg:38,date:'2026-10-01'},{provider:'Andres',receivedKilos:1000,pricePerKg:42,date:'2026-08-01'}],
      [{provider:'Andres',type:'egreso',amount:500,date:'2026-10-02'},{provider:'Andres',type:'egreso',amount:900,date:'2026-10-02',isDeleted:true}],
      {costPricePerKg:37,historicalDebtAndres:1000,providerBalanceCutoff:'2026-09-02'});
    expect(result).toMatchObject({totalPurchasesCost:3800,totalPagado:500,saldoProveedor:-2300});
  });
});
