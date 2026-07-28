import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, PATHS } from '../lib/firebase';
import { DEFAULT_CONFIG, type FinancialConfig } from '../lib/types';

/** config/financials es la única fuente de verdad de precios y comisión:
 *  la lee el frontend y la lee la Cloud Function. */
export function useConfig() {
  const [config, setConfig] = useState<FinancialConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const ref = doc(db, PATHS.config, PATHS.configFinancials);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setConfig({ ...DEFAULT_CONFIG, ...(snap.data() as Partial<FinancialConfig>) });
          setExists(true);
        } else {
          setConfig(DEFAULT_CONFIG);
          setExists(false);
        }
        setLoading(false);
      },
      () => setLoading(false),
    );
  }, []);

  return { config, loading, exists };
}

export async function saveConfig(cfg: FinancialConfig) {
  await setDoc(doc(db, PATHS.config, PATHS.configFinancials), cfg, { merge: true });
}
