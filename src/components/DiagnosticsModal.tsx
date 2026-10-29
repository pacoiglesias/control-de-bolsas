// Vista del registro de diagnóstico local de la app.
//
// Se abre desde Configuración → Auditoría & Respaldo → "Diagnóstico de
// la app". Muestra los últimos eventos técnicos (errores de guardado en
// Firestore, cambios de sesión, errores de sincronización y errores
// generales) para que, si algo falla en el dispositivo real, el usuario
// pueda copiar el registro y pasarlo a quien revisa el problema — sin
// que nadie tenga que estar delante de la pantalla.
//
// El registro NUNCA contiene datos del negocio (ver src/lib/appDiag.ts):
// solo tipos de evento y códigos o mensajes técnicos.
import { useState } from 'react';
import { Modal } from './ui';
import { getDiagEvents, clearDiag, diagText, type DiagEvent } from '../lib/appDiag';

export function DiagnosticsModal({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<DiagEvent[]>(() => getDiagEvents());
  const [copied, setCopied] = useState(false);
  const [cleared, setCleared] = useState(false);

  const refresh = () => setEvents(getDiagEvents());

  const handleCopy = async () => {
    const text = diagText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Respaldo para navegadores sin acceso al portapapeles.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // Sin portapapeles.
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    clearDiag();
    setEvents([]);
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  const shown = [...events].reverse();

  return (
    <Modal title="🔍 Diagnóstico de la app" onClose={onClose} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p className="hint" style={{ margin: 0 }}>
          Control de Bolsas · {events.length} eventos · solo datos técnicos.
          Aquí no se guarda ningún nombre de cliente, importe, folio ni
          contenido de documentos.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn" onClick={refresh}>
            Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void handleCopy()}>
            {copied ? '¡Copiado!' : 'Copiar'}
          </button>
          <button type="button" className="btn" onClick={handleClear}>
            {cleared ? '¡Limpio!' : 'Limpiar'}
          </button>
        </div>
        {shown.length === 0 ? (
          <p className="hint">
            Aún no hay eventos. Usa la app con normalidad y vuelve aquí: cada
            error de guardado, cambio de sesión o fallo queda registrado.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {shown.map((e, i) => (
              <li
                key={`${e.t}-${i}`}
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  overflowWrap: 'anywhere',
                }}
              >
                <span style={{ opacity: 0.6 }}>{e.t.slice(11, 19)}</span>{' '}
                <strong>[{e.ev}]</strong> {JSON.stringify(e.d)}
              </li>
            ))}
          </ul>
        )}
        <p className="hint" style={{ margin: 0 }}>
          Si algo falla, toca Copiar y pasa el texto a quien lo revisa: ahí se
          ve si fue el guardado, la sesión, la conexión o la propia app.
        </p>
      </div>
    </Modal>
  );
}
