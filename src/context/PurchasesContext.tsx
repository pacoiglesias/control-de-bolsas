import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Purchase } from '../lib/types';

interface PurchasesState {
  purchases: Purchase[];
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<PurchasesState | null>(null);

export function PurchasesProvider({ children }: { children: ReactNode }) {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mismo patron peligroso que en OrdersContext: orderBy excluye en
    // silencio cualquier compra sin el campo `date`. Se ordena del lado
    // del cliente en su lugar.
    const q = query(
      collection(db, PATHS.purchases),
      limit(300)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .filter((d: any) => !d.data().isDeleted)
          .map((d) => ({ id: d.id, ...d.data() }) as Purchase);
        rows.sort((a: any, b: any) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));
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

  const value = useMemo(() => ({ purchases, loading, error }), [purchases, loading, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePurchasesContext(): PurchasesState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('usePurchasesContext debe usarse dentro de <PurchasesProvider>.');
  }
  return ctx;
}
