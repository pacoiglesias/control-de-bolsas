import { Modal } from './ui';
import { money, kilos } from '../lib/format';
import type { ParsedOC } from '../lib/ocParser';

/**
 * Paso intermedio entre "pegar el texto de la OC" y "aplicarlo al
 * expediente". Antes ambos botones de "Pegar Texto de OC" escribian el
 * formulario directo -- si el parser interpretaba mal algo (paso de
 * verdad: una OC real subio con 120 kg en vez de 3,700 porque la regex
 * vieja agarraba una medida del producto como si fuera la cantidad), el
 * usuario se enteraba hasta despues de guardado. Aqui se ve primero lo
 * que se va a aplicar, con oportunidad de cancelar si algo no cuadra.
 */
export function OCPreviewModal({
  parsed,
  onConfirm,
  onCancel,
}: {
  parsed: ParsedOC;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const nadaDetectado = !parsed.folio && !parsed.oc && !parsed.client && !parsed.provider
    && parsed.items.length === 0 && parsed.totalKilograms === 0 && !parsed.estimatedDeliveryDate;

  return (
    <Modal title="📋 Confirma lo detectado en la OC" onClose={onCancel} wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {nadaDetectado && (
          <div className="alert warn" style={{ padding: '12px 16px', borderRadius: 'var(--radius)' }}>
            No se detectó ningún dato reconocible en el texto pegado. Puedes cancelar y capturar a mano.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Campo label="Folio Interno" valor={parsed.folio} />
          <Campo label="Número de OC" valor={parsed.oc} />
          <Campo label="Cliente" valor={parsed.client} />
          <Campo label="Proveedor" valor={parsed.provider} />
          <Campo label="Fecha de Entrega" valor={parsed.estimatedDeliveryDate ? parsed.estimatedDeliveryDate.toLocaleDateString('es-MX') : ''} />
          <Campo label="Kilos Totales" valor={parsed.totalKilograms > 0 ? kilos(parsed.totalKilograms) : ''} />
        </div>

        {parsed.items.length > 0 ? (
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Artículos detectados ({parsed.items.length})</h4>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th className="num">Cantidad</th>
                    <th className="num">P. Unitario</th>
                    <th className="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.items.map((it) => (
                    <tr key={it.id}>
                      <td className="mono">{it.code || '—'}</td>
                      <td>{it.description}</td>
                      <td className="num mono">{kilos(it.quantity)}</td>
                      <td className="num mono">{money(it.unitPrice)}</td>
                      <td className="num mono">{money(it.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="hint">No se detectaron artículos individuales línea por línea — solo se llenarán los campos de arriba si aplicas.</p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button className="btn" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" onClick={onConfirm} disabled={nadaDetectado}>
            ✅ Aplicar al Expediente
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, color: valor ? 'var(--ink)' : 'var(--warn)' }}>
        {valor || 'No detectado'}
      </div>
    </div>
  );
}
