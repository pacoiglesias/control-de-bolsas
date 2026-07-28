import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
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
      // La verdad la manda Firestore Rules; esto solo evita mostrar una
      // interfaz que de todos modos no podría leer nada.
      try {
        const snap = await getDoc(doc(db, PATHS.admins, u.uid));
        if (snap.exists()) {
          setUser(u);
          setIsAdmin(true);
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
