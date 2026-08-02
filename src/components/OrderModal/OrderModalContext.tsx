import { createContext, useContext } from 'react';

// Using 'any' for the context type to avoid exporting 50 types right now,
// we just want to split the God Component first without breaking TS.
const OrderModalContext = createContext<any>(null);

export function useOrderModal() {
  return useContext(OrderModalContext);
}

export default OrderModalContext;
