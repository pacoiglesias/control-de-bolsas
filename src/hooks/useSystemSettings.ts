import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// FIX (auditoría v8.9.5): "cajaChicaBalance" vivía aquí, adentro del mismo
// documento que Login necesita leer SIN sesión iniciada (para mostrar el
// logo y nombre de la empresa antes de autenticarse) -- `firestore.rules`
// tiene `system_settings/global` con `allow read: if true` a propósito para
// eso. El problema: el saldo real de efectivo en caja viajaba en ese mismo
// documento público, así que cualquiera sin cuenta podía leer cuánto
// efectivo hay en caja ahora mismo, en `onSnapshot` de esta misma función.
// Se movió al mismo patrón privado que ya usa el PIN del Portal Maquilador
// (`system_settings_private/maquila`, ver `getMaquilaPin` abajo): ahora
// vive en `system_settings_private/finanzas`, protegido por
// `isSuperAdmin()`. No se encontró ninguna pantalla que hoy lea este campo
// desde aquí (el saldo que se ve en Caja Chica se calcula en vivo sumando
// `expenses`), así que se quitó del tipo público en vez de dejarlo muerto.
export interface SystemSettings {
  companyName: string;
  companyLogoUrl: string;
  providerName: string;
  providerTitle?: string;
  clientName?: string;
  clientShortName?: string;
  departments: string[];
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
