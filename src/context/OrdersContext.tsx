import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { PurchaseOrder } from '../lib/types';

/**
 * Suscripción ÚNICA a purchaseOrders.
 *
 * `useOrders()` se invocaba de forma independiente desde nueve pantallas
 * (Layout, Dashboard, Orders, Cobranza, Upload, Respaldo, Settings, Catalog y
 * OcTracking). El SDK de Firestore deduplica la consulta a nivel de red, pero
 * cada instancia del hook mantenía su propia copia del arreglo en el estado de
 * React y su propio ciclo de render: nueve copias en memoria y nueve
 * re-renders por cada cambio en la base.
 *
 * Con el proveedor, la suscripción vive una sola vez en la raíz y las
 * pantallas consumen la misma referencia. `useOrders()` conserva exactamente
 * la misma firma, así que ninguna pantalla necesitó cambiar.
 */
interface OrdersState {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<OrdersState | null>(null);

export function OrdersProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.orders), orderBy('processedAt', 'desc'), limit(500));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs.filter((d: any) => !d.data().isDeleted).map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) })),
        );
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(
          e.code === 'permission-denied'
            ? 'Firestore rechazó la lectura. Revisa que tu usuario exista en la colección admins y que las reglas estén desplegadas.'
            : e.message,
        );
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const value = useMemo(() => ({ orders, loading, error }), [orders, loading, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Si alguien lo usa fuera del proveedor, es un error de montaje: mejor que
 *  falle fuerte y visible que devolver una lista vacía que parezca datos. */
export function useOrdersContext(): OrdersState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useOrders debe usarse dentro de <OrdersProvider>. Revisa App.tsx.');
  }
  return ctx;
}
