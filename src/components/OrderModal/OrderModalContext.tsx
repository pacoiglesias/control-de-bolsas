import { createContext, useContext } from 'react';
import type { OrderModalContextType } from './types';

const OrderModalContext = createContext<OrderModalContextType | null>(null);

export function useOrderModal(): OrderModalContextType {
  const context = useContext(OrderModalContext);
  if (!context) {
    throw new Error('useOrderModal must be used within an OrderModalProvider');
  }
  return context;
}

export default OrderModalContext;
