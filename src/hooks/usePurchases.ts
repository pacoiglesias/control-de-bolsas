import { useEffect, useState } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Purchase } from '../lib/types';

export function usePurchases() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.purchases));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Purchase);
        rows.sort((a, b) => (b.date?.toMillis() ?? 0) - (a.date?.toMillis() ?? 0));
        setPurchases(rows);
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
