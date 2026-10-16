import {describe, expect, it} from 'vitest';
import type {PurchaseOrder, Delivery} from '../types';
import {buildOcGroups} from '../ocTracking';
import {getProductionProgress, summarizeProduction} from '../productionTracking';
import {computeItemInvoiceBreakdown, getDeliveryBilling, linkDeliveriesToInvoice, migrateLegacyDeliveries, assertDeliveryFitsOrder} from '../deliveries';
import {getOrderSummary} from '../finance';
const order=(id:string, kilos=1000):PurchaseOrder=>({id,oc:id,folio:id,client:'Cliente',totalKilograms:kilos,deliveries:[],invoices:[],creditCycle:{status:'pedido'}});
const invoice={id:'invoice',orderId:'o1',folio:'6167',kilos:800,financials:{invoiceTotal:39904,saleTotal:34400,salePricePerKg:43,costPricePerKg:38,netCashFlow:0},creditCycle:{status:'paid' as const},collection:{paidAmount:39904}};
describe('Seguimiento físico comprobable',()=>{
 it('cuenta producción pendiente aunque sus facturas estén pagadas y omite históricos y órdenes retiradas',()=>{
  const paid={...order('paid'),invoices:[invoice],creditCycle:{status:'paid' as const}};
  const rows=[paid,{...order('historical',9000),productionTrackingEnabled:false},{...order('deleted'),isDeleted:true},{...order('superseded'),isSuperseded:true},{...order('closed'),isClosedShort:true}];
  expect(summarizeProduction(rows)).toEqual({count:1,remaining:1000});
 });
 it('calcula pendientes por orden, sin compensar una sobreentrega con otra orden',()=>{
  expect(summarizeProduction([{...order('A',100),deliveries:[{id:'d',date:null,kilos:150}]},order('B',100)])).toEqual({count:1,remaining:100});
 });
 it('conserva la OC real 120267114014 y su factura 6167, sin una lista fija de exclusión',()=>{
  const [group]=buildOcGroups([{...order('120267114014'),productionTrackingEnabled:false,invoices:[invoice]}]);
  expect(group.order.invoices?.[0].folio).toBe('6167');
  expect(group.totalVentaFacturada).toBe(39904);
  expect(group.kilosFaltantes).toBe(0);
 });
 it('no convierte una factura histórica sin campo de entregas en kilos físicos ni al editar su expediente',()=>{
  const legacy={...order('legacy'),deliveries:undefined,invoices:[invoice]};
  expect(getOrderSummary(legacy).kilosDelivered).toBe(0);
  expect(migrateLegacyDeliveries(legacy,[])).toEqual([]);
  expect(getProductionProgress(legacy)).toMatchObject({ordered:1000,delivered:0,remaining:1000});
 });
 it('excluye entregas inferidas de los kilos disponibles, las asignaciones y el desglose por producto',()=>{
  const artificial:Delivery={id:'fiscal',date:null,kilos:900,inferredFromInvoice:true,items:[{itemId:'p',quantity:900}]};
  const real:Delivery={id:'real',date:null,kilos:100,items:[{itemId:'p',quantity:100}]};
  const record={...order('A'),items:[{id:'p',description:'Bolsa',quantity:1000,unitPrice:44,amount:44000,unit:'KGM'}],deliveries:[artificial,real]};
  expect(getDeliveryBilling(artificial)).toEqual({kilos:0,invoicedKilos:0,pendingKilos:0});
  const linked=linkDeliveriesToInvoice(record.deliveries,'invoice',100);
  expect(linked[0].invoiceId).toBeUndefined();expect(linked[1].invoicedKilos).toBe(100);
  expect(computeItemInvoiceBreakdown(record)[0]).toMatchObject({alreadyDelivered:100,uninvoicedDeliveredKilos:100,suggestedKilosToInvoice:100});
 });
 it('rechaza entregas fuera de producción, partidas ajenas y partidas repetidas',()=>{
  expect(()=>assertDeliveryFitsOrder({...order('A'),productionTrackingEnabled:false},10)).toThrow('fuera de producción');
  const record={...order('A'),items:[{id:'p',quantity:1000,description:'Bolsa',amount:44000,unitPrice:44,unit:'KGM'}]};
  expect(()=>assertDeliveryFitsOrder(record,10,[{itemId:'other',quantity:10}])).toThrow('no pertenece');
  expect(()=>assertDeliveryFitsOrder(record,10,[{itemId:'p',quantity:5},{itemId:'p',quantity:5}])).toThrow('repetidas');
 });
});
