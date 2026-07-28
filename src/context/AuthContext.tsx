import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { logAction } from '../lib/logger';
import { auth, db, PATHS } from '../lib/firebase';

interface AuthState {
  user: User | null;
  role: 'admin' | 'manager' | 'viewer' | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
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
  const [role, setRole] = useState<'admin' | 'manager' | 'viewer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
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
          email.endsWith('@ruenisco.com');

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
          const userRole = snap.exists() ? (snap.data().role || 'viewer') : 'admin';
          setRole(isOwnerEmail ? 'admin' : userRole);
          setError(null);
        } else {
          setError(
            `La cuenta ${u.email} no está autorizada. Crea el documento admins/${u.uid} en Firestore.`,
          );
          setRole(null);
          setUser(null);
          await fbSignOut(auth);
        }
      } catch {
        setError('No se pudo verificar el permiso de administrador.');
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      role,
      loading,
      error,
      signIn: async (email, password) => {
        setError(null);
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
          // No se guarda la contraseña ni el resultado detallado: solo que
          // alguien entro, con que correo y cuando. Es rastro de seguridad,
          // no un registro de credenciales.
          void logAction(email.trim(), 'Inicio de Sesión', { ok: true });
        } catch (e) {
          // Un intento fallido ocurre SIN sesion, y system_logs exige estar
          // autenticado para escribir (isAuthenticatedUser() en las reglas).
          // Registrarlo aqui fallaria en silencio siempre, asi que no se
          // intenta: solo queda constancia de los inicios que si entraron.
          const code = (e as { code?: string }).code ?? '';
          setError(authMessage(code));
          throw e;
        }
      },
      signInWithGoogle: async () => {
        setError(null);
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          void logAction(result.user.email ?? 'google', 'Inicio de Sesión (Google)', { ok: true });
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
        void logAction(user?.email, 'Cierre de Sesión', {});
        await fbSignOut(auth);
        setError(null);
      },
    }),
    [user, role, loading, error],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
