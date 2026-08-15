import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';

export interface MaquilaDelivery {
  id: string;
  date: any;
  productCode: string;
  productDescription: string;
  orderId?: string;
  folio?: string;
  kilos: number;
  status: 'pending' | 'assigned';
  createdAt: any;
}

export function useMaquilaDeliveries() {
  const [deliveries, setDeliveries] = useState<MaquilaDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, PATHS.maquilaDeliveries),
      where('status', '==', 'pending')
    );
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as MaquilaDelivery));
        // Sort locally
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis() || 0;
          const tB = b.createdAt?.toMillis() || 0;
          return tA - tB;
        });
        setDeliveries(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Error al cargar entregas del portal');
        setLoading(false);
      }
    );
    
    return () => unsub();
  }, []);

  return { deliveries, loading, error };
}
