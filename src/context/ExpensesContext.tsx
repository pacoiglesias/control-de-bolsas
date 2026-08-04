import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Expense } from '../lib/types';

interface ExpensesContextState {
  expenses: Expense[];
  loading: boolean;
  error: string | null;
}

const ExpensesContext = createContext<ExpensesContextState | undefined>(undefined);

export const ExpensesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Mismo patron peligroso: orderBy excluye en silencio cualquier
    // movimiento de caja sin el campo `date`. Critico aqui — un movimiento
    // invisible significa un saldo de CAJA incorrecto sin ningun aviso.
    const q = query(
      collection(db, PATHS.expenses),
      limit(500)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs
          .filter((d: any) => !d.data().isDeleted)
          .map((d) => ({ id: d.id, ...d.data() }) as Expense);
        rows.sort((a: any, b: any) => (b.date?.toMillis?.() ?? 0) - (a.date?.toMillis?.() ?? 0));
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
    return () => unsub();
  }, []);

  return (
    <ExpensesContext.Provider value={{ expenses, loading, error }}>
      {children}
    </ExpensesContext.Provider>
  );
};

export const useExpensesContext = () => {
  const context = useContext(ExpensesContext);
  if (!context) {
    throw new Error('useExpensesContext debe usarse dentro de un ExpensesProvider');
  }
  return context;
};
