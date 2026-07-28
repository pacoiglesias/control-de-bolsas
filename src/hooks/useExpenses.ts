import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Expense } from '../lib/types';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.expenses));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Expense);
        rows.sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0));
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
