import { useEffect, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui';

// FIX 2026-08-10 (Staff Engineer -- task ERP #11): reemplaza los 28
// window.confirm(...) repartidos por toda la app. window.confirm() bloquea
// el hilo principal, no respeta el tema oscuro/glassmorphism del sistema, y
// en Firefox/Chrome modernos se puede desactivar por el usuario ("no volver
// a mostrar"), lo que rompe silenciosamente cualquier flujo que dependa de
// su resultado. confirmDialog() es una API imperativa (funciona igual que
// antes: `if (await confirmDialog('¿Seguro?')) { ... }`) pero se resuelve
// como un <Modal> real de la app -- reutiliza el mismo componente que ya
// usan los demás modales, así que hereda el modo oscuro, el foco atrapado
// (focus trap) y el cierre con Escape sin código extra.
//
// Uso:
//   const ok = await confirmDialog('¿Eliminar este registro?');
//   const ok = await confirmDialog({ title: 'Eliminar', message: '...', danger: true });

export type ConfirmOptions = {
  title?: ReactNode;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void };

let currentListener: ((state: ConfirmRequest | null) => void) | null = null;

export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const options: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise<boolean>((resolve) => {
    if (!currentListener) {
      // Red de seguridad: si por algún motivo <ConfirmDialogHost /> no está
      // montado (p. ej. un test aislado), no rompemos el flujo -- caemos de
      // vuelta al confirm nativo del navegador en vez de colgar la promesa.
      // eslint-disable-next-line no-alert
      resolve(window.confirm(typeof options.message === 'string' ? options.message : 'Confirmar acción'));
      return;
    }
    currentListener({ ...options, resolve });
  });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    currentListener = setState;
    return () => {
      if (currentListener === setState) currentListener = null;
    };
  }, []);

  if (!state) return null;

  const settle = (result: boolean) => {
    state.resolve(result);
    setState(null);
  };

  return (
    <Modal title={state.title ?? 'Confirmar acción'} onClose={() => settle(false)}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ color: 'var(--ink-soft)', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-line' }}>{state.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn" onClick={() => settle(false)}>
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button
            type="button"
            className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => settle(true)}
            autoFocus
          >
            {state.confirmLabel ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
