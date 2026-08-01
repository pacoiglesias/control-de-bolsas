import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import type { Product } from '../lib/types';

interface ProductsContextState {
  products: Product[];
  loading: boolean;
  error: string | null;
}

const ProductsContext = createContext<ProductsContextState | undefined>(undefined);

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, PATHS.products),
      orderBy('description', 'asc'),
      limit(500)
    );
    
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.filter((d: any) => !d.data().isDeleted).map((d) => ({ id: d.id, ...d.data() } as Product));
        setProducts(items);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setError('Error al cargar productos');
        setLoading(false);
      }
    );
    
    return () => unsub();
  }, []);

  return (
    <ProductsContext.Provider value={{ products, loading, error }}>
      {children}
    </ProductsContext.Provider>
  );
};

export const useProductsContext = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProductsContext debe usarse dentro de un ProductsProvider');
  }
  return context;
};
