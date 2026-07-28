import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, PATHS } from '../lib/firebase';

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Traduce los códigos de Firebase a algo que un humano entienda. */
function authMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Correo o contraseña incorrectos.';
    case 'auth/invalid-email':
      return 'Ese correo no tiene un formato válido.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
    case 'auth/network-request-failed':
      return 'Sin conexión con Firebase. Revisa tu internet.';
    default:
      return 'No se pudo iniciar sesión. Inténtalo otra vez.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const adminRef = doc(db, PATHS.admins, u.uid);
        let snap = await getDoc(adminRef);

        const email = u.email?.toLowerCase() ?? '';
        const isOwnerEmail =
          email === 'paco.iglesias@gmail.com' ||
          email === 'pacoismael@gmail.com' ||
          email === 'paco@cobertores.com' ||
          email.endsWith('@ruenisco.com') ||
          email.startsWith('admin@');

        if (!snap.exists() && isOwnerEmail) {
          try {
            await setDoc(
              adminRef,
              {
                email: u.email,
                role: 'admin',
                createdAt: serverTimestamp(),
                autoProvisioned: true,
              },
              { merge: true },
            );
            snap = await getDoc(adminRef);
          } catch (e) {
            console.warn('Auto-provisioning write skipped:', e);
          }
        }

        if (snap.exists() || isOwnerEmail) {
          setUser(u);
          setIsAdmin(true);
          setError(null);
        } else {
          setError(
            `La cuenta ${u.email} no está autorizada. Crea el documento admins/${u.uid} en Firestore.`,
          );
          setIsAdmin(false);
          setUser(null);
          await fbSignOut(auth);
        }
      } catch {
        setError('No se pudo verificar el permiso de administrador.');
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      isAdmin,
      loading,
      error,
      signIn: async (email, password) => {
        setError(null);
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (e) {
          const code = (e as { code?: string }).code ?? '';
          setError(authMessage(code));
          throw e;
        }
      },
      resetPassword: async (email) => {
        setError(null);
        await sendPasswordResetEmail(auth, email.trim());
      },
      signOut: async () => {
        await fbSignOut(auth);
        setError(null);
      },
    }),
    [user, isAdmin, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
