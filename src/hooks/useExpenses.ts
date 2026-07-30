import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Expense } from '../lib/types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // orderBy en el propio query: antes se traía la colección completa y se
    // ordenaba con .sort() en el cliente en cada snapshot. Firestore ya sabe
    // ordenar por índice; ordenar 40 renglones a mano no dolía, pero seguía
    // siendo trabajo redundante en cada actualización en vivo.
    const q = query(collection(db, PATHS.expenses), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
        setExpenses(rows);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching expenses:', err);
        setError('Error al cargar la caja chica.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { expenses, loading, error };
}
