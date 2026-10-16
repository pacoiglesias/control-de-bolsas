import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoHealAndPurgeErpDatabase } from '../autoHealEngine';
import * as firestore from 'firebase/firestore';
vi.mock('firebase/firestore',async()=>({...await vi.importActual<any>('firebase/firestore'),collection:vi.fn(()=>({})),getDocs:vi.fn(),writeBatch:vi.fn()}));
describe('Revisión sin sustituir registros reales',()=>{
 beforeEach(()=>vi.clearAllMocks());
 it('no borra órdenes por nombre, ni restaura cifras fijas al revisar',async()=>{
  vi.mocked(firestore.getDocs).mockResolvedValue({docs:[{data:()=>({oc:'DUMMY-999',invoices:[{creditCycle:{status:'pending'},collection:{contrareciboNumber:'GT-8'}}]})},{data:()=>({oc:'120267114400',invoices:[]})}]} as any);
  const result=await autoHealAndPurgeErpDatabase();
  expect(result).toMatchObject({purgedCount:0,healedCount:0,activeCrsCount:1});
  expect(firestore.writeBatch).not.toHaveBeenCalled();
 });
 it('rechaza la restauración sin respaldo o documento de origen',async()=>{
  await expect(autoHealAndPurgeErpDatabase({reseedHistoricalCrs:true})).rejects.toThrow('respaldo o documento');
  expect(firestore.writeBatch).not.toHaveBeenCalled();
  expect(firestore.getDocs).not.toHaveBeenCalled();
 });
});
