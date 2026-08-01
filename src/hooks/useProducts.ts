import { useProductsContext } from '../context/ProductsContext';

export function useProducts() {
  return useProductsContext();
}
