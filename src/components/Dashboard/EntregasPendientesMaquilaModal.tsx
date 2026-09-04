import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../lib/firebase';
import { Modal } from '../ui';
import { useMaquilaDeliveries } from '../../hooks/useMaquilaDeliveries';
import { useToast } from '../../context/ToastContext';
import { logError } from '../../lib/logger';
import { fmtDateTime } from '../../lib/format';

/**
 * NUEVO (auditoría v8.9.10): diagnóstico + herramienta de reconciliación
 * para el rezago de entregas de Andrés que quedó atascado ANTES del fix de
 * v8.9.9 (`registrarEntregaMaquila` solo escribía a `maquilaDeliveries`,
 * nunca a `purchaseOrders/{id}.deliveries[]`, así que un expediente ya
 * entregado -- con contrarecibo del lado del cliente -- seguía apareciendo
 * como pendiente en el Portal Maquilador).
 *
 * `useMaquilaDeliveries()` ya trae TODOS los registros con `status:
 * 'pending'` de cualquier expediente (no filtra por orden) -- eso es
 * exactamente el rezago que quedó huérfano: cualquier entrega confirmada
 * DESPUÉS del fix se auto-asigna al instante y nunca llega a esta lista.
 *
 * A propósito NO se hace un "importar todo de un clic": cada fila requiere
 * que un admin la revise y apruebe una por una (mismo criterio de
 * "nunca automatizar una escritura financiera/de inventario en bloque sin
 * supervisión" ya aplicado en el resto de esta auditoría). La escritura
 * real la hace `importarEntregaMaquilaPendiente` (Cloud Function,
 * transaccional, valida rol admin/manager en el servidor).
 */
export function EntregasPendientesMaquilaModal({ onClose }: { onClose: () => void }) {
  const { deliveries, loading, error } = useMaquilaDeliveries();
  const toast = useToast();
  const [importingId, setImportingId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const handleImport = async (deliveryLogId: string) => {
    setImportingId(deliveryLogId);
    try {
      const fn = httpsCallable<{ deliveryLogId: string }, { ok: boolean; alreadyAssigned?: boolean }>(
        functions,
        'importarEntregaMaquilaPendiente'
      );
      const res = await fn({ deliveryLogId });
      if (res.data?.alreadyAssigned) {
        toast('Esa entrega ya se había importado antes.', 'ok');
      } else {
        toast('Entrega importada al expediente correctamente.', 'ok');
      }
      setDoneIds((prev) => new Set(prev).add(deliveryLogId));
    } catch (e: any) {
      console.error(e);
      logError(e, { context: 'EntregasPendientesMaquilaModal.handleImport', deliveryLogId });
      toast(e?.message || 'Error al importar la entrega.', 'bad');
    } finally {
      setImportingId(null);
    }
  };

  const pendientes = deliveries.filter((d) => !doneIds.has(d.id));

  return (
    <Modal title="🏭 Entregas de Andrés sin asignar a un expediente" onClose={onClose} wide>
      <p className="hint" style={{ marginTop: 0 }}>
        Estas son entregas que Andrés confirmó desde el Portal Maquilador pero que nunca quedaron
        reflejadas en el expediente real -- casi siempre por el bug de <code>registrarEntregaMaquila</code> corregido
        en v8.9.9. Revisa cada una y presiona "Importar" para que cuente de verdad en los kilos pendientes
        y en la facturación del expediente. Si la lista está vacía, no tienes ningún caso suelto.
      </p>

      {loading && <p className="hint">Cargando…</p>}
      {error && <p className="hint" style={{ color: 'var(--bad)' }}>{error}</p>}

      {!loading && !error && pendientes.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <p style={{ fontSize: 32, margin: 0 }}>✅</p>
          <p className="hint">No hay ninguna entrega del Portal Maquilador sin asignar. Todo cuadra.</p>
        </div>
      )}

      {!loading && pendientes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '60vh', overflowY: 'auto' }}>
          {pendientes.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 12,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <strong>{d.kilos} kg</strong> — {d.productDescription || 'Producto sin descripción'}
                <div className="hint" style={{ fontSize: 12 }}>
                  Expediente: {d.folio || d.orderId || '(sin folio guardado)'} · {fmtDateTime(d.createdAt)}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={importingId === d.id}
                onClick={() => void handleImport(d.id)}
              >
                {importingId === d.id ? 'Importando…' : 'Importar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
