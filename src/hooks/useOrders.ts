import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { PurchaseOrder } from '../lib/types';

/** Suscripción en vivo a purchaseOrders. Cualquier cambio que escriba la
 *  Cloud Function aparece en pantalla sin recargar. */
export function useOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.orders), orderBy('processedAt', 'desc'), limit(300));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setOrders(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PurchaseOrder, 'id'>) })),
        );
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

  return { orders, loading, error };
}
