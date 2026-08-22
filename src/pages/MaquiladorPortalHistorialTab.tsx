import { glass } from './MaquiladorPortal.shared';

/**
 * FIX (v8.9.8, split de MaquiladorPortal.tsx — ~1530 lineas): tab
 * "Historial de Entregas" extraido tal cual, sin cambiar logica.
 *
 * FIX (v8.9.9, auditoría Staff Engineer -- contraste WCAG AA): el texto
 * secundario usaba blanco al 30%/40% de opacidad sobre fondo oscuro, muy por
 * debajo del contraste mínimo AA (4.5:1) -- este portal es el único flujo
 * con usuario externo (Andrés, sin cuenta de Firebase, en campo con luz
 * solar), así que la legibilidad aquí pesa más que en el resto de la app.
 * Subido a 60%/65%.
 */
export default function MaquiladorPortalHistorialTab({
  historial,
  handleDownloadDeliveryTicket,
}: {
  historial: any[];
  handleDownloadDeliveryTicket: (h: any) => void;
}) {
  return (
    <div style={{ ...glass, padding: 22 }}>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(255,255,255,0.6)',
          fontWeight: 800,
          textTransform: 'uppercase',
          marginBottom: 16,
        }}
      >
        Registro Reciente de Entregas ({historial.length})
      </div>

      {historial.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'rgba(255,255,255,0.65)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>Aún no has registrado entregas recientemente.</div>
        </div>
      ) : (
        historial.map((h, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>OC {h.folio}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {h.productDescription}
              </div>
              {h.notes && (
                <div style={{ fontSize: 11, color: '#a78bfa', marginTop: 3 }}>
                  📝 {h.notes}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {h.date ? new Date(h.date).toLocaleString('es-MX') : 'Reciente'}
              </div>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#34d399' }}>
                {h.kilos.toLocaleString('es-MX')} kg
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: 6,
                  background:
                    h.status === 'pending_approval'
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(16, 185, 129, 0.2)',
                  color: h.status === 'pending_approval' ? '#fbbf24' : '#34d399',
                }}
              >
                {h.status === 'pending_approval' ? '⏳ Pendiente Aprobación' : '✓ Registrado'}
              </span>
              <button
                onClick={() => handleDownloadDeliveryTicket(h)}
                title="Descargar Remisión Oficial de esta entrega en PDF"
                style={{
                  background: 'rgba(167, 139, 250, 0.15)',
                  border: '1px solid rgba(167, 139, 250, 0.3)',
                  borderRadius: 8,
                  padding: '4px 8px',
                  color: '#c4b5fd',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <span>📄</span> Remisión PDF
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
