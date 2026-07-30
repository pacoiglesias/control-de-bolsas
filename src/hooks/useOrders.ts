import { useOrdersContext } from '../context/OrdersContext';

/**
 * Suscripción en vivo a purchaseOrders.
 *
 * La suscripción real vive en <OrdersProvider> (src/context/OrdersContext.tsx),
 * montado una sola vez en App.tsx. Este hook queda como fachada para no tocar
 * las nueve pantallas que ya lo importan: la firma es idéntica a la de antes.
 */
export function useOrders() {
  return useOrdersContext();
}
