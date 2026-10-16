import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {collection,onSnapshot,query} from 'firebase/firestore';
import {db,PATHS} from '../lib/firebase';
import type {PurchaseOrder} from '../lib/types';
import {toDate} from '../lib/format';

interface OrdersState {orders:PurchaseOrder[];documentOrders:PurchaseOrder[];loading:boolean;error:string|null;activeOrders:PurchaseOrder[];closedOrders:PurchaseOrder[]}
const Ctx=createContext<OrdersState|null>(null);
/** The persisted records are the only source of orders, invoices and deliveries. */
export function OrdersProvider({children}:{children:ReactNode}) {
  const [orders,setOrders]=useState<PurchaseOrder[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>onSnapshot(query(collection(db,PATHS.orders)),snap=>{
    const records=snap.docs.filter(d=>!d.data().isDeleted && !d.data().isSuperseded)
      .map(d=>({...d.data(),id:d.id} as PurchaseOrder));
    records.sort((a,b)=>(toDate(b.processedAt||b.createdAt)?.getTime()||0)-(toDate(a.processedAt||a.createdAt)?.getTime()||0));
    setOrders(records);setLoading(false);setError(null);
  },e=>{setError(e.message);setLoading(false);}),[]);
  const activeOrders=useMemo(()=>orders.filter(o=>!o.isClosedShort && o.creditCycle?.status!=='completed'),[orders]);
  const closedOrders=useMemo(()=>orders.filter(o=>o.isClosedShort || o.creditCycle?.status==='completed'),[orders]);
  const value=useMemo(()=>({orders,documentOrders:orders,loading,error,activeOrders,closedOrders}),[orders,loading,error,activeOrders,closedOrders]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useOrdersContext():OrdersState {
  const value=useContext(Ctx);if(!value)throw new Error('useOrders debe usarse dentro de <OrdersProvider>. Revisa App.tsx.');return value;
}
