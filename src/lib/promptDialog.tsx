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
      // eslint-disable-next-line no-alert
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
    <Modal title={state.title ?? 'Ingresa un valor'} onClose={() => settle(null)} elevated>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          settle(value);
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 20 }}
      >
        {state.message && (
          <div style={{ color: 'var(--ink-soft)', lineHeight: 1.6, fontSize: 14, whiteSpace: 'pre-line' }}>{state.message}</div>
        )}
        <input
          ref={inputRef}
          type={state.inputType ?? 'text'}
          className="input boxed"
          value={value}
          placeholder={state.placeholder}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn" onClick={() => settle(null)}>
            {state.cancelLabel ?? 'Cancelar'}
          </button>
          <button type="submit" className="btn btn-primary">
            {state.confirmLabel ?? 'Aceptar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
