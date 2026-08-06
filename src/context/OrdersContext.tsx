import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, limit, where } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { PurchaseOrder } from '../lib/types';
import { useInvoicesContext } from './InvoicesContext';

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
    // ANTES: `orderBy('processedAt', 'desc')` — Firestore EXCLUYE por
    // completo, en silencio, cualquier documento que no tenga el campo
    // usado en orderBy. Al menos un expediente real (el que agrupa los 10
    // contrarecibos originales de la migracion, creado antes de que
    // `processedAt` se capturara consistentemente) no tenia ese campo, y
    // por eso era invisible en TODAS las pantallas que usan useOrders() —
    // Dashboard, Cobranza, Compras, Expedientes — aunque la Auditoria
    // Maestra si lo veia, porque esa pantalla usa una consulta distinta,
    // sin orderBy. Se ordena del lado del cliente para que ningun
    // documento pueda desaparecer por faltarle un campo.
    const q = query(
      collection(db, PATHS.orders), 
      where('isArchived', '==', false),
      limit(500)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .filter((d: any) => !d.data().isDeleted)
          .map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) }));
        docs.sort((a, b) => {
          const ta = a.processedAt?.toMillis?.() ?? 0;
          const tb = b.processedAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setOrders(docs);
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

  const { invoices } = useInvoicesContext();

  const ordersWithInvoices = useMemo(() => {
    return orders.map(o => {
      const orderInvoices = invoices.filter(inv => inv.orderId === o.id);
      return {
        ...o,
        invoices: orderInvoices,
        invoiceStatuses: orderInvoices.map(i => i.creditCycle?.status || 'pending')
      };
    });
  }, [orders, invoices]);

  const value = useMemo(() => ({ orders: ordersWithInvoices, loading, error }), [ordersWithInvoices, loading, error]);

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
