import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { sound } from '../lib/sounds';

type Tone = 'info' | 'ok' | 'bad';
interface ToastAction {
  label: string;
  onClick: () => void;
}
interface Toast {
  id: number;
  msg: string;
  tone: Tone;
  action?: ToastAction;
}

const Ctx = createContext<(msg: string, tone?: Tone, action?: ToastAction) => void>(() => {});

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

  const push = useCallback((msg: string, tone: Tone = 'info', action?: ToastAction) => {
    const sanitized = tone === 'bad' ? formatErrorMessage(msg) : msg;
    const id = Date.now() + Math.random();
    
    // Feedback sonoro sutil según el tono
    if (tone === 'ok') sound.playSuccess();
    else if (tone === 'bad') sound.playError();
    else sound.playNotify();

    setToasts((t) => [...t, { id, msg: sanitized, tone, action }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000); // Dar más tiempo si hay acción (6s)
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toast-root">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`} role="status">
            <span>{t.msg}</span>
            {t.action && (
              <button 
                onClick={() => { t.action!.onClick(); setToasts(current => current.filter(x => x.id !== t.id)); }}
                style={{ marginLeft: 12, padding: '4px 10px', fontSize: 12, borderRadius: 4, background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
