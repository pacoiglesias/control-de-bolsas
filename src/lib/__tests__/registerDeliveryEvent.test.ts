import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {PurchaseOrder, Delivery} from '../types';
const state = vi.hoisted(()=>({order:{} as PurchaseOrder,writes:[] as {path:string,data:Partial<PurchaseOrder>}[]}));
vi.mock('../firebase',()=>({db:{},PATHS:{orders:'purchaseOrders',purchases:'purchases'}}));
vi.mock('firebase/firestore', async original=>({
 ...await original<typeof import('firebase/firestore')>(),
 doc:(_db:unknown,collection:string,id:string)=>({path:collection+'/'+id}),
 runTransaction:async (_db:unknown,callback:(transaction:unknown)=>Promise<unknown>)=>{
  const pending:{path:string,data:Partial<PurchaseOrder>}[]=[];
  const result=await callback({get:async()=>({exists:()=>true,data:()=>structuredClone(state.order)}),update:(ref:{path:string},data:Partial<PurchaseOrder>)=>pending.push({path:ref.path,data})});
  for(const write of pending){state.writes.push(write);state.order={...state.order,...write.data};}return result;
 },
}));
import {registerDeliveryEvent} from '../registerDeliveryEvent';
const delivery=(id='d'):Delivery=>({id,date:null,kilos:100});
beforeEach(()=>{state.order={id:'o',oc:'OC',totalKilograms:1000,deliveries:[],invoices:[],creditCycle:{status:'pedido'}};state.writes=[];});
describe('Persistencia de remisiones sin compras implícitas',()=>{
 it('actualiza únicamente las entregas de la OC y conserva sus facturas y pagos',async()=>{
  state.order.invoices=[{id:'f',orderId:'o',folio:'f',kilos:100,collection:{paidAmount:100},creditCycle:{status:'paid'}}];
  expect(await registerDeliveryEvent('o',delivery())).toBe(100);
  expect(state.writes.map(write=>write.path)).toEqual(['purchaseOrders/o']);
  expect(Object.keys(state.writes[0].data).sort()).toEqual(['deliveries','updatedAt']);
  expect(state.order.invoices[0].collection?.paidAmount).toBe(100);
 });
 it('conserva entregas concurrentes y rechaza el reintento sin sumar dos veces',async()=>{
  state.order.deliveries=[{...delivery('other'),kilos:200}];
  expect(await registerDeliveryEvent('o',delivery())).toBe(300);
  await expect(registerDeliveryEvent('o',delivery())).rejects.toThrow('ya fue registrada');
  expect(state.order.deliveries).toHaveLength(2);
 });
 it('revalida los kilos disponibles con el expediente actual sin escribir cuando excede',async()=>{
  state.order.deliveries=[{...delivery('other'),kilos:950}];
  await expect(registerDeliveryEvent('o',delivery())).rejects.toThrow('Solo quedan');
  expect(state.writes).toEqual([]);
 });
});
