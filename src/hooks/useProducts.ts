import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Product } from '../lib/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, PATHS.products), orderBy('description', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product));
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Error al cargar productos');
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  return { products, loading, error };
}
