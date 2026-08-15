import { useState } from 'react';
import { Modal } from './ui';

/**
 * Reemplaza a `window.prompt()`, usado antes en tres lugares distintos
 * (pegar OC, pegar Factura, pegar Complemento de Pago) para capturar texto
 * largo de varias lineas. El cuadro nativo del navegador es una caja de una
 * sola linea — pegar un documento completo ahi es facil de hacer mal (se ve
 * como una sola linea larga, sin forma de revisar que se pegó completo, y
 * un clic fuera de lugar lo cierra y pierde todo el texto). Este modal usa
 * un textarea real, visible, con boton de confirmar explicito.
 */
export function PasteTextModal({
  title,
  placeholder,
  onConfirm,
  onClose,
}: {
  title: string;
  placeholder?: string;
  onConfirm: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');

  return (
    <Modal title={title} onClose={onClose}>
      <p className="hint" style={{ marginTop: 0 }}>
        Copia el texto completo del documento (Ctrl+C) y pégalo aquí (Ctrl+V).
      </p>
      <textarea
        className="input boxed mono"
        style={{ width: '100%', minHeight: 260, resize: 'vertical' }}
        placeholder={placeholder || 'Pega aquí el texto completo del documento…'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="modal-actions" style={{ marginTop: 16 }}>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Cancelar</button>
        <button
          className="btn btn-primary"
          disabled={!text.trim()}
          onClick={() => { onConfirm(text); onClose(); }}
        >
          Procesar texto
        </button>
      </div>
    </Modal>
  );
}
