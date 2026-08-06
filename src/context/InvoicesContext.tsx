import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Invoice } from '../lib/types';

interface InvoicesState {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<InvoicesState | null>(null);

export function InvoicesProvider({ children }: { children: ReactNode }) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Al igual que OrdersContext, ordenamos en el cliente para evitar
    // exclusiones silenciosas por falta de campos en documentos viejos.
    // Asumimos que PATHS.invoices será 'invoices'.
    const q = query(collection(db, PATHS.invoices), limit(2000));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as Omit<Invoice, 'id'>) }));
          
        docs.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta;
        });
        setInvoices(docs);
        setError(null);
        setLoading(false);
      },
      (e) => {
        setError(
          e.code === 'permission-denied'
            ? 'Firestore rechazó la lectura de facturas. Revisa las reglas.'
            : e.message,
        );
        setLoading(false);
      },
    );
    return unsub;
  }, []);

  const value = useMemo(() => ({ invoices, loading, error }), [invoices, loading, error]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInvoicesContext(): InvoicesState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error('useInvoicesContext debe usarse dentro de <InvoicesProvider>.');
  }
  return ctx;
}
