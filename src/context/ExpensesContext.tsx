import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
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
    const q = query(
      collection(db, PATHS.expenses),
      orderBy('date', 'desc'),
      limit(150)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.filter((d: any) => !d.data().isDeleted).map((d) => ({ id: d.id, ...d.data() }) as Expense);
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
