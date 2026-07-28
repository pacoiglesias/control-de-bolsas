import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const config: FirebaseOptions = {
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
export const db = getFirestore(app);
export const storage = getStorage(app);

export const PATHS = {
  orders: 'purchaseOrders',
  expenses: 'expenses',
  purchases: 'purchases',
  config: 'config',
  configFinancials: 'financials',
  admins: 'admins',
  uploadsPrefix: 'uploads',
} as const;
