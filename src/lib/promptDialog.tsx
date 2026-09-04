import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from '../components/ui';

// FIX 2026-08-10 (Staff Engineer -- task ERP #16, sugerido tras la revision
// de los .bat de deploy): mismo problema que window.confirm() -- window.
// prompt() bloquea el hilo principal, no respeta el tema oscuro del
// sistema, y algunos navegadores lo desactivan igual que a confirm().
// promptDialog() es la version imperativa de un <input> real dentro de un
// <Modal>, con el mismo comportamiento que window.prompt(): Cancelar (o
// Escape) resuelve `null`, Aceptar (o Enter) resuelve el texto escrito
// (puede ser cadena vacia, igual que el nativo).
//
// Uso:
//   const cr = await promptDialog('Ingresa el numero de Contrarecibo (CR):');
//   const fecha = await promptDialog({ message: 'Nueva fecha:', defaultValue: actual, inputType: 'date' });

export type PromptOptions = {
  title?: ReactNode;
  message?: ReactNode;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputType?: 'text' | 'date';
};

type PromptRequest = PromptOptions & { resolve: (value: string | null) => void };

let currentListener: ((state: PromptRequest | null) => void) | null = null;

export function promptDialog(opts: PromptOptions | string): Promise<string | null> {
  const options: PromptOptions = typeof opts === 'string' ? { message: opts } : opts;
  return new Promise<string | null>((resolve) => {
    if (!currentListener) {
      // Red de seguridad: si <PromptDialogHost/> no esta montado, no
      // colgamos la promesa -- caemos de vuelta al prompt nativo.
      resolve(window.prompt(typeof options.message === 'string' ? options.message : 'Ingresa un valor:', options.defaultValue));
      return;
    }
    currentListener({ ...options, resolve });
  });
}

export function PromptDialogHost() {
  const [state, setState] = useState<PromptRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    currentListener = (req) => {
      setState(req);
      setValue(req?.defaultValue ?? '');
    };
    return () => {
      if (currentListener) currentListener = null;
    };
  }, []);

  // Enfoca y selecciona el valor por defecto al abrir, igual que hace el
  // prompt() nativo del navegador -- para poder sobreescribirlo de un tirón.
  useEffect(() => {
    if (state) {
      const id = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [state]);

  if (!state) return null;

  const settle = (result: string | null) => {
    state.resolve(result);
    setState(null);
  };

  return (
    <Modal title={state.title ?? '⚡ Confirmación / Captura Rápida'} onClose={() => settle(null)}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          settle(value);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 320, maxWidth: 520 }}
      >
        {state.message && (
          <div
            style={{
              background: 'var(--paper-sunk)',
              border: '1px solid var(--line)',
              borderRadius: 10,
              padding: '12px 14px',
              color: 'var(--ink)',
              lineHeight: 1.5,
              fontSize: 13.5,
              whiteSpace: 'pre-line',
            }}
          >
            {state.message}
          </div>
        )}

        <div>
          <input
            ref={inputRef}
            type={state.inputType ?? 'text'}
            className="input boxed"
            value={value}
            placeholder={state.placeholder}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              fontSize: 16,
              fontWeight: 700,
              padding: '10px 14px',
              borderRadius: 8,
              border: '2px solid var(--accent)',
              boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.12)',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
            <span>💡 Tip: Presiona <kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 4px' }}>Enter ↵</kbd> para aceptar</span>
            <span><kbd style={{ background: 'var(--bg-card)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 4px' }}>Esc</kbd> para cancelar</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button type="button" className="btn" onClick={() => settle(null)} style={{ padding: '8px 16px', fontWeight: 600 }}>
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 18px', fontWeight: 800 }}>
            {state.confirmLabel ?? '✓ Aceptar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
