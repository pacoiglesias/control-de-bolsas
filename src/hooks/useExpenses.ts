import { useExpensesContext } from '../context/ExpensesContext';

export function useExpenses() {
  return useExpensesContext();
}
