import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Purchase } from '../lib/types';

export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.purchases), orderBy('date', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPurchases(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase));
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('Error fetching purchases:', err);
        setError('Error al cargar las compras al fabricante.');
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return { purchases, loading, error };
}
