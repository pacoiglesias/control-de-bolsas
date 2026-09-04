import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CARTERA_OFICIAL as LEGACY_CARTERA } from '../lib/constants';

export interface CarteraEntry {
  cr: string;
  monto: number;
  factura: string;
  dept: string;
}

interface ConfigState {
  carteraOficial: CarteraEntry[];
  totalCarteraOficial: number;
  validCrs: string[];
  loading: boolean;
}

const ConfigContext = createContext<ConfigState | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfigState>({
    carteraOficial: [],
    totalCarteraOficial: 0,
    validCrs: [],
    loading: true,
  });

  useEffect(() => {
    const docRef = doc(db, 'config', 'carteraOficial');

    const unsubscribe = onSnapshot(docRef, async (snapshot) => {
      if (!snapshot.exists()) {
        // One-time migration/seed
        console.warn('Seeding config/carteraOficial from constants...');
        await setDoc(docRef, { crs: LEGACY_CARTERA });
        return;
      }

      const data = snapshot.data();
      const crs = (data.crs || []) as CarteraEntry[];
      
      const total = crs.reduce((sum, entry) => sum + (entry.monto || 0), 0);
      const validCrs = crs.map(c => c.cr);

      setConfig({
        carteraOficial: crs,
        totalCarteraOficial: total,
        validCrs,
        loading: false,
      });
    });

    return () => unsubscribe();
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return ctx;
}
