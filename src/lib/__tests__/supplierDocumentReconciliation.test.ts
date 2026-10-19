import {describe,it,expect} from 'vitest';
import {Timestamp} from 'firebase/firestore';
import {parseAndresStatementRows,parseAndresStatementPositions} from '../andresStatement';
import {planSupplierStatement} from '../supplierStatementPlan';
import {productDimensions,reconcileSupplierDelivery,mapRemissionItems,parseDeliveryDocument,parseVisionRemission} from '../documentReconciliation';
import {deliveryBillableKilos,assertInvoiceQuantityPolicy,getInvoiceDocumentCost,billableLineQuantity} from '../billingQuantities';
import {getDeliveryBilling,linkDeliveriesToInvoice,computeItemInvoiceBreakdown} from '../deliveries';
import {computeAndresBalance,getAndresPurchaseCost} from '../finance';
import type {PurchaseOrder,Delivery} from '../types';

const table=()=>[
 ['FECHA','NO. VM','PAGOS','ENTREGAS','0.00','Observaciones'],['','','','','100.00',''],
 ['01/10/2026','','100.00','','0.00',''],['02/10/2026','VM1','','21.50','21.50','10.50 KG $2.00 OC12026430001'],
 ['','','1,000.00','1,021.50','21.50','SALDO A FAVOR DEL PROVEEDOR'],
];
const physical=(id='d',kilos=10.5):Delivery=>({id,date:Timestamp.fromDate(new Date('2026-10-02T12:00:00Z')),docType:'remision',docFolio:id,kilos,items:[{itemId:'p',quantity:kilos}],billingQuantityPolicy:'truncate_each_line',invoiced:false,supplierCost:{amount:21.5,kilos,pricePerKg:2,remission:'VM1',statementDocumentId:'source',needsReview:true}});
const order=(id='order'):PurchaseOrder=>({id,oc:'12026430002',folio:'43/0002',client:'Cliente',creditCycle:{status:'pedido'},invoiceBillingPolicy:'truncate_each_line',totalKilograms:20,items:[{id:'p',code:'SKU',description:'BOLSA 1.00 M X 1.25 M',quantity:20,unitPrice:43,amount:860,unit:'KGM'}],deliveries:[physical()],invoices:[]});

describe('Prioridad de originales y conciliación del proveedor',()=>{
 it('concilia cada saldo, separa acumulados y conserva la diferencia de multiplicación',()=>{
  const statement=parseAndresStatementRows(table(),'2026-10-03');
  expect(statement).toMatchObject({openingSupplierBalance:100,closingSupplierBalance:21.5,totalPayments:100,totalDeliveries:21.5,cumulativePayments:1000,totalKilos:10.5});
  expect(statement.rows[1].quantityAmountDifference).toBe(.5);expect(statement.warnings.join()).toContain('0.50');
 });
 it('detiene una lectura que no cuadra en un saldo intermedio',()=>{const cells=table();cells[3][4]='22.00';expect(()=>parseAndresStatementRows(cells,'2026-10-03')).toThrow('no cuadra');});
 it('rechaza la pérdida de una columna o de la fecha de corte',()=>{expect(()=>parseAndresStatementPositions([{str:'FECHA',x:10,y:50}],'2026-10-03')).toThrow('columnas');expect(()=>parseAndresStatementRows(table(),'')).toThrow('fecha de corte');});
 it('corrige la referencia equivocada solo con una remisión física única y fechada',()=>{
  const result=reconcileSupplierDelivery({reference:'VM1',date:'2026-10-02',kilos:10.5,orderReference:'12026430001'},[order()]);
  expect(result).toMatchObject({status:'matched',oc:'12026430002',reportedOc:'12026430001',ocMismatch:true,quantityDifference:0});
  expect(result.warnings[0]).toContain('12026430001');
 });
 it('señala una diferencia pequeña de kilos y no adivina entre dos remisiones',()=>{
  const row={reference:'VM1',date:'2026-10-02',kilos:10.75,orderReference:'12026430001'};
  expect(reconcileSupplierDelivery(row,[order()])).toMatchObject({status:'matched',quantityDifference:.25});
  expect(reconcileSupplierDelivery(row,[order('a'),order('b')]).status).toBe('ambiguous');
  expect(reconcileSupplierDelivery({...row,kilos:90},[order()]).status).toBe('unresolved');
 });
 it('no utiliza una factura como evidencia de entrega para asignar la compra',()=>{
  const record=order();record.deliveries![0].inferredFromInvoice=true;
  expect(reconcileSupplierDelivery({reference:'VM1',date:'2026-10-02',kilos:10.5,orderReference:record.oc!},[record]).status).toBe('unresolved');
 });
 it('normaliza el ancho desarrollado del fuelle y vincula por medidas y precio de OC',()=>{
  expect(productDimensions('60+40X125 CM C/250')).toBe('100x125');
  expect(productDimensions('1.20 M X 1.60 M')).toBe('120x160');
  expect(mapRemissionItems(order(),[{description:'60+40X125 CM C/250',quantity:10.5,unitPrice:43,amount:451.5}])).toEqual([{itemId:'p',quantity:10.5}]);
  expect(()=>mapRemissionItems(order(),[{description:'60+40X125 CM',quantity:10.5,unitPrice:44,amount:462}])).toThrow('precio');
 });
 it('respeta equivalencias de producto aprobadas y no adivina una medida desconocida',()=>{
  const record=order();record.items![0]={...record.items![0],description:'BOLSA 1.20 M X 1.60 M',dimensionAliases:['100x160']};
  expect(mapRemissionItems(record,[{description:'BOLSA 60+40X160 CM',quantity:10.5,unitPrice:43,amount:451.5}])).toEqual([{itemId:'p',quantity:10.5}]);
  record.items![0].dimensionAliases=[];expect(()=>mapRemissionItems(record,[{description:'BOLSA 60+40X160 CM',quantity:10.5,unitPrice:43,amount:451.5}])).toThrow('única');
 });
 it('reemplaza registros del periodo con historial y no genera caja ni altera otras compras',()=>{
  const statement=parseAndresStatementRows(table(),'2026-10-03');const expenses:any[]=[];
  const plan=planSupplierStatement(statement,'source',[{id:'old',provider:'Andres',date:'2026-10-02',receivedKilos:7,pricePerKg:3},{id:'other',provider:'Otro',date:'2026-10-02',receivedKilos:7,pricePerKg:3}],[order()],{costPricePerKg:2},expenses);
  expect(plan.superseded.map(p=>p.id)).toEqual(['old']);expect(plan.summary.saldoProveedor).toBe(-21.5);expect(expenses).toEqual([]);
  expect(plan.config.providerStatement.payments).toHaveLength(1);expect(plan.purchases[0].oc).toBe('12026430002');expect(getAndresPurchaseCost(plan.purchases[0],2)).toBe(21.5);
  expect(plan.deliveryOrders[0].deliveries![0].supplierCost?.amount).toBe(21.5);
  expect(computeAndresBalance(plan.purchases,[{provider:'Andres',date:'2026-10-01',type:'egreso',amount:100}],plan.config).saldoProveedor).toBe(-21.5);
 });
 it('no aplica un estado con pagos adicionales sin conciliar ni un corte anterior al vigente',()=>{
  const statement=parseAndresStatementRows(table(),'2026-10-03');
  expect(()=>planSupplierStatement(statement,'source',[],[],{costPricePerKg:2},[{provider:'Andres',date:'2026-10-02',type:'egreso',amount:1}])).toThrow('adicionales');
  expect(()=>planSupplierStatement(statement,'source',[],[],{costPricePerKg:2},[{provider:'Andres',date:'2026-10-01',type:'egreso',amount:100},{provider:'Andres',date:'2026-10-01',type:'egreso',amount:100}])).toThrow('adicionales');
  expect(()=>planSupplierStatement(statement,'source',[],[],{providerStatement:{asOf:'2026-10-04'}},[])).toThrow('anterior');
 });
});
describe('Kilos físicos, facturables y costo documentado',()=>{
 it('acepta enteros y medios kilos, baja cada partida al medio kilo y conserva la merma',()=>{
  expect([100.1,100.2,100.3,100.5,100.8].map(kilos=>billableLineQuantity(kilos,'truncate_half_kilo_each_line'))).toEqual([100,100,100,100.5,100.5]);
  const record={...order(),invoiceBillingPolicy:'truncate_half_kilo_each_line' as const};
  expect(()=>assertInvoiceQuantityPolicy(record,100.5)).not.toThrow();expect(()=>assertInvoiceQuantityPolicy(record,100.3)).toThrow('medios kilos');
  const delivery={...physical(),billingQuantityPolicy:'truncate_half_kilo_each_line' as const,kilos:21.8,items:[{itemId:'a',quantity:10.9},{itemId:'b',quantity:10.9}]};
  expect(deliveryBillableKilos(delivery)).toBe(21);expect(getDeliveryBilling(linkDeliveriesToInvoice([delivery],'invoice',21)[0]).pendingKilos).toBe(0);
 });
 it('quita los decimales de cada partida, preserva báscula y no deja residuos pendientes después de facturar',()=>{
  const delivery={...physical(),kilos:21.8,items:[{itemId:'a',quantity:10.9},{itemId:'b',quantity:10.9}]};
  expect(deliveryBillableKilos(delivery)).toBe(20);expect(delivery.kilos).toBe(21.8);
  const linked=linkDeliveriesToInvoice([delivery],'invoice',20)[0];expect(getDeliveryBilling(linked).pendingKilos).toBe(0);expect(linked.kilos).toBe(21.8);
 });
 it('sugiere kilos enteros con las partidas de OC y rechaza decimales capturados',()=>{
  expect(computeItemInvoiceBreakdown(order())[0]).toMatchObject({alreadyDelivered:10.5,suggestedKilosToInvoice:10});
  expect(()=>assertInvoiceQuantityPolicy(order(),10.5)).toThrow('sin decimales');expect(()=>assertInvoiceQuantityPolicy(order(),10)).not.toThrow();
 });
 it('incluye el costo completo de las fracciones y reparte el centavo exacto entre facturas parciales',()=>{
  const record=order();expect(getInvoiceDocumentCost(record,10)).toEqual({amount:21.5,needsReview:true});
  record.deliveries=linkDeliveriesToInvoice(record.deliveries!,'first',3);
  expect(getInvoiceDocumentCost(record,7)?.amount).toBe(15.05);expect(getInvoiceDocumentCost(record,3,'first')?.amount).toBe(6.45);
 });
 it('detecta remisión antes de CFDI, suma todas las filas y rechaza importes mal leídos',()=>{
  const text='ORDEN DE ENTREGA 6430002\nFECHA: 02/10/2026\nOC:12026430002\n10.50 KG BOLSA 60+40X125 CM C/250 $43.00 $451.50\n1 KG BOLSA 60+40X125 CM C/250 $43.00 $43.00\nSUB TOTAL $494.50\nIVA $79.12\nTOTAL $573.62';
  expect(parseDeliveryDocument(text)).toMatchObject({folio:'6430002',oc:'12026430002',kilos:11.5,total:573.62});
  expect(()=>parseDeliveryDocument(text.replace('451.50','452.50'))).toThrow('no cuadra');
 });
 it('exige datos visuales completos y verifica las multiplicaciones sin inventar kilos',()=>{
  const extracted={tipoDocumento:'remision',folio:'6430002',oc:'12026430002',fecha:'2026-10-02',subtotal:451.5,total:523.74,conceptos:[{descripcion:'BOLSA 60+40X125 CM',cantidad:10.5,precioUnitario:43,importe:451.5}]};
  expect(parseVisionRemission(extracted).kilos).toBe(10.5);
  expect(()=>parseVisionRemission({...extracted,conceptos:[{...extracted.conceptos[0],cantidad:11}]})).toThrow('no cuadra');
  expect(()=>parseVisionRemission({...extracted,fecha:''})).toThrow('fecha');
 });
});
