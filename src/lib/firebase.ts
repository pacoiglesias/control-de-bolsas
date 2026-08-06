import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

export const config: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

/** Si falta una variable, la app lo dice en pantalla en vez de fallar en blanco. */
export const missingEnv = Object.entries(config)
  .filter(([, v]) => !v)
  .map(([k]) => k);

export const app = initializeApp(config);
export const auth = getAuth(app);
// Sin `tabManager: persistentMultipleTabManager()`, abrir el sitio en una
// segunda pestaña (o una segunda sesion, como la de este mismo navegador
// controlado) le quita a la primera el acceso exclusivo a la cache local —
// Firestore cae a memoria en silencio, sin ningun error visible en la UI.
// Los guardados pueden parecer exitosos en pantalla sin persistir de
// verdad, o las lecturas pueden quedarse en datos viejos. Esto explica muy
// probablemente varios de los "se guardo y luego desaparecio" de hoy.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const storage = getStorage(app);
export const functions = getFunctions(app, 'us-east1');

export const PATHS = {
  orders: 'purchaseOrders',
  expenses: 'expenses',
  purchases: 'purchases',
  invoices: 'invoices',
  products: 'products',
  config: 'config',
  configFinancials: 'financials',
  admins: 'admins',
  uploadsPrefix: 'uploads',
  maquilaDeliveries: 'maquilaDeliveries',
  priceLists: 'price_lists',
  ledger: 'ledger',
} as const;
