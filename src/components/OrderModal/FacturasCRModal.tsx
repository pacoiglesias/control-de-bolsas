import { Modal } from '../ui';
import { useOrderModal } from './OrderModalContext';
import TabFacturas from './TabFacturas';
import { money } from '../../lib/format';

/**
 * Modal dedicado exclusivamente a Facturas & Contrarecibos (CR).
 * Se abre desde el botón "📄 Facturas & CR" del modal principal del Expediente.
 * Mantiene todo el contexto del OrderModal activo (useOrderModal funciona).
 */
export function FacturasCRModal({ onClose }: { onClose: () => void }) {
  const ctx = useOrderModal();
  if (!ctx) return null;

  const { order, form, liveSummary } = ctx as any;
  const invoiceCount = form.invoices?.length ?? 0;

  // Agrupar CRs únicos para mostrar en el header
  const crs = [...new Set(
    (form.invoices ?? [])
      .map((inv: any) => inv.collection?.contrareciboNumber)
      .filter(Boolean)
  )] as string[];

  return (
    <Modal
      wide
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            background: '#16a34a', color: '#fff', borderRadius: 6,
            padding: '2px 10px', fontSize: 13, fontWeight: 800, letterSpacing: 1
          }}>
            💰 FACTURAS & CR
          </span>
          <span style={{ color: 'var(--ink-soft)', fontSize: 14, fontWeight: 400 }}>
            {order.folio ?? '—'} · {order.client ?? '—'}
          </span>
        </span>
      }
      onClose={onClose}
    >
      {/* Barra resumen de facturas y CRs */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20,
        padding: '12px 16px', borderRadius: 10,
        background: 'var(--glass-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--line)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Facturas emitidas
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, fontFamily: 'monospace' }}>
            {invoiceCount}
          </span>
        </div>
        <div style={{ width: 1, background: 'var(--line)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Contrarecibos (CR)
          </span>
          <span style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
            {crs.length > 0 ? crs.join(' · ') : '—'}
          </span>
        </div>
        <div style={{ width: 1, background: 'var(--line)' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Total Facturado
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
            {money(liveSummary?.invoiceTotal ?? 0)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Cobrado
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: 'var(--ok)' }}>
            {money(liveSummary?.paidAmount ?? 0)}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Por Cobrar
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace', color: 'var(--bad)' }}>
            {money((liveSummary?.invoiceTotal ?? 0) - (liveSummary?.paidAmount ?? 0))}
          </span>
        </div>
      </div>

      {/* Contenido completo del tab de facturas */}
      <div style={{ minHeight: '50vh', maxHeight: '65vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8 }}>
        <TabFacturas />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <button className="btn" onClick={onClose}>Cerrar</button>
      </div>
    </Modal>
  );
}
