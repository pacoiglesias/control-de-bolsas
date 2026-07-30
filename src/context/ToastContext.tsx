import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { sound } from '../lib/sounds';

type Tone = 'info' | 'ok' | 'bad';
interface Toast {
  id: number;
  msg: string;
  tone: Tone;
}

interface ToastOptions {
  /** Omite el sonido automático: para flujos que ya reprodujeron uno propio
   *  y más específico (playCash, playNotify) justo antes de este toast. */
  silent?: boolean;
}

const Ctx = createContext<(msg: string, tone?: Tone, opts?: ToastOptions) => void>(() => {});

function formatErrorMessage(msg: string): string {
  if (!msg) return 'Ocurrió un error inesperado.';
  if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
    return '🔒 Acceso denegado: No tienes permisos de administrador para realizar esta acción.';
  }
  if (msg.includes('network-request-failed')) {
    return '📶 Error de conexión: Revisa tu señal de internet e intenta de nuevo.';
  }
  if (msg.includes('auth/user-not-found') || msg.includes('auth/wrong-password')) {
    return '🔑 Credenciales incorrectas: Verifica tu correo o contraseña.';
  }
  return msg;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((msg: string, tone: Tone = 'info', opts?: ToastOptions) => {
    const sanitized = tone === 'bad' ? formatErrorMessage(msg) : msg;
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg: sanitized, tone }]);
    // Feedback sonoro unificado: todo el sistema pasa por este mismo punto
    // para mostrar un toast, así que es el sitio natural para el sonido.
    // Antes vivía repartido a mano en OrderModal y Upload, con pantallas
    // enteras (CajaChica, Compras, Settings, Users...) sin ningún sonido.
    if (!opts?.silent) {
      if (tone === 'ok') sound.playSuccess();
      else if (tone === 'bad') sound.playError();
    }
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-root">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role="status">
            {t.msg}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
