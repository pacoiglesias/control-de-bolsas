import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { sound } from '../lib/sounds';

export type Tone = 'info' | 'ok' | 'bad';
interface ToastAction {
  label: string;
  onClick: () => void;
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
  const push = useCallback((msg: string, tone: Tone = 'info', action?: ToastAction) => {
    const sanitized = tone === 'bad' ? formatErrorMessage(msg) : msg;
    
    // Feedback sonoro sutil
    if (tone === 'ok') sound.playSuccess();
    else if (tone === 'bad') sound.playError();
    else sound.playNotify();

    const options: any = {
      duration: action ? 6000 : 4000,
      position: 'bottom-center',
      style: {
        background: 'var(--bg-card)',
        color: 'var(--ink)',
        fontWeight: 500,
        borderRadius: '8px',
        border: `1px solid ${tone === 'ok' ? 'var(--ok)' : tone === 'bad' ? 'var(--bad)' : 'var(--border)'}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      },
    };

    if (action) {
      toast((t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>{sanitized}</span>
          <button
            onClick={() => {
              action.onClick();
              toast.dismiss(t.id);
            }}
            className="btn-small btn-primary"
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4 }}
          >
            {action.label}
          </button>
        </div>
      ), options);
    } else {
      if (tone === 'ok') toast.success(sanitized, options);
      else if (tone === 'bad') toast.error(sanitized, options);
      else toast(sanitized, options);
    }
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <Toaster />
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

