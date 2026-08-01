import { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemSettings {
  companyName: string;
  companyLogoUrl: string;
  providerName: string;
  departments: string[];
  cajaChicaBalance: number;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  companyName: 'BOLSAS ELEMENTAL',
  companyLogoUrl: '',
  providerName: 'Andrés',
  departments: ['TH', 'GT'],
  cajaChicaBalance: 0,
};

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, 'system_settings', 'global');
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setSettings({ ...DEFAULT_SYSTEM_SETTINGS, ...(snap.data() as Partial<SystemSettings>) });
        } else {
          setSettings(DEFAULT_SYSTEM_SETTINGS);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching system settings', err);
        setLoading(false);
      },
    );
  }, []);

  return { settings, loading };
}

export async function saveSystemSettings(cfg: Partial<SystemSettings>) {
  await setDoc(doc(db, 'system_settings', 'global'), cfg, { merge: true });
}
