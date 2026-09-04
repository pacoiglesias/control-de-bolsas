import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemSettings {
  companyName: string;
  companyLogoUrl: string;
  providerName: string;
  providerTitle?: string;
  clientName?: string;
  clientShortName?: string;
  departments: string[];
  cajaChicaBalance: number;
  deptCodeTH?: string;
  deptCodeGT?: string;
  managerTH?: string;
  managerGT?: string;
  deptNameTH?: string;
  deptNameGT?: string;
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  companyName: 'BOLSAS ELEMENTAL',
  companyLogoUrl: '',
  providerName: 'Andrés',
  providerTitle: 'Proveedor de Bolsa / Fabricante',
  clientName: 'Grupo Textil Providencia SA de CV',
  clientShortName: 'Providencia',
  departments: ['TH', 'GT'],
  cajaChicaBalance: 0,
  deptCodeTH: 'TH',
  deptCodeGT: 'GT',
  managerTH: 'Lic. Nava',
  managerGT: 'Lic. Evelia',
  deptNameTH: 'Textil Hogar',
  deptNameGT: 'Grupo Textil',
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

/**
 * El PIN vive en un documento aparte (system_settings_private/maquila),
 * legible solo por super admins — nunca en el documento publico que Login
 * necesita leer sin sesion. No se usa onSnapshot en vivo a proposito: solo
 * se lee cuando un admin de verdad abre Configuracion para editarlo, no en
 * cada carga de la app.
 */
export async function getMaquilaPin(): Promise<string> {
  const snap = await getDoc(doc(db, 'system_settings_private', 'maquila'));
  return (snap.exists() ? (snap.data().pin as string) : '') || '2468';
}

export async function saveMaquilaPin(pin: string): Promise<void> {
  await setDoc(doc(db, 'system_settings_private', 'maquila'), { pin }, { merge: true });
}
