import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui';
import { sound } from '../../lib/sounds';
import type { FinancialConfig, PurchaseOrder } from '../../lib/types';
import type { TabName } from './types';

import { OrderModalProvider } from './OrderModalProvider';
import { useOrderModal } from './OrderModalContext';

import TabResumen from './TabResumen';
import TabProductos from './TabProductos';
import TabEntregas from './TabEntregas';
import TabFacturas from './TabFacturas';
import { money } from '../../lib/format';

function OrderModalShell({ onClose }: { onClose: () => void }) {
  const ctx = useOrderModal();
  const {
    order,
    form,
    readOnly,
    products,
    knownClients,
    knownProviders,
    knownClientEmails,
    kilosFaltantes,
    tab,
    setTab,
    busy,
    clickEliminar,
    confirmandoEliminar,
    restore,
    save,
    handlePrintRemision,
    handlePrintPreFactura,
    printConsolidatedPackage,
    retryAI,
    cajaBalance,
    estimatedTotalCost,
    viabilityWarning
  } = ctx as any; // Need to clean up some types later if missing in Context. We can safely destructure from ctx since we know it's there.

  return (
    <Modal wide title={`Expediente ${order.folio ?? '(sin folio)'}`} onClose={onClose}>
      <datalist id="catalog-products">
        {products?.map((p: any) => (
          <option key={p.id} value={p.description} />
        ))}
      </datalist>
      <datalist id="known-clients">
        {knownClients.map((c: string) => <option key={c} value={c} />)}
      </datalist>
      <datalist id="known-providers">
        {knownProviders.map((p: string) => <option key={p} value={p} />)}
      </datalist>
      <datalist id="known-client-emails">
        {knownClientEmails.map((e: string) => <option key={e} value={e} />)}
      </datalist>

      {/* Auditoria de Caja Chica */}
      <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: viabilityWarning ? 'var(--warn-bg)' : 'var(--ok-bg)', border: `1px solid ${viabilityWarning ? 'var(--warn)' : 'var(--ok)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 24 }}>{viabilityWarning ? '⚠️' : '✅'}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: 'var(--ink)' }}>Auditoría de Viabilidad (Caja Chica vs Costo Producción)</div>
          <div style={{ fontSize: 13, color: 'var(--ink)' }}>
            Saldo actual en Caja Chica: <strong>{money(cajaBalance || 0)}</strong> &middot; Costo de Producción estimado: <strong>{money(estimatedTotalCost || 0)}</strong>.
            {viabilityWarning ? ' El saldo no es suficiente para cubrir esta orden por completo.' : ' Hay saldo suficiente para esta orden.'}
          </div>
        </div>
      </div>

      {/* Siguiente Paso Automático */}
      {!readOnly && (() => {
        const entregasSinFacturar = form.deliveries.filter((d: any) => !d.invoiced).length;
        let paso: { texto: string; boton: string; ir: TabName; tono: string } | null = null;
        if (!form.client.trim() || !form.provider.trim()) {
          paso = { texto: 'Faltan datos básicos (cliente o proveedor).', boton: 'Ir a Resumen', ir: 'resumen', tono: '#fef3c7' };
        } else if (form.items.length === 0) {
          paso = { texto: 'Agrega los productos de esta Orden de Compra.', boton: 'Ir a Productos', ir: 'productos', tono: '#fef3c7' };
        } else if (entregasSinFacturar > 0) {
          paso = { texto: `Tienes ${entregasSinFacturar} entrega(s) sin facturar.`, boton: 'Ir a Facturar', ir: 'entregas', tono: '#dbeafe' };
        } else if (kilosFaltantes > 0.01) {
          paso = { texto: `Faltan ${kilosFaltantes.toLocaleString('es-MX')} kg por entregar.`, boton: 'Ir a Entregas', ir: 'entregas', tono: '#dbeafe' };
        } else if (form.invoices.length > 0) {
          paso = { texto: '✅ Todo entregado y facturado — esta OC está completa.', boton: 'Ver Facturas', ir: 'facturas', tono: '#d1fae5' };
        }
        if (!paso) return null;
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: paso.tono, borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>
            <span style={{ fontWeight: 600 }}>👉 Siguiente paso: {paso.texto}</span>
            {tab !== paso.ir && (
              <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setTab(paso!.ir)}>{paso.boton} →</button>
            )}
          </div>
        );
      })()}
      
      {/* Tabs - Modernized Glassmorphism */}
      <div className="glass-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 24, padding: 6, borderRadius: 'var(--radius)', alignItems: 'center' }}>
        <button className={`btn ${tab === 'resumen' ? 'btn-primary' : ''}`} style={tab !== 'resumen' ? {border: 'none', background: 'transparent'} : {border: 'none', boxShadow: 'var(--shadow-sm)'}} onClick={() => { sound.playPop(); setTab('resumen'); }}>Resumen</button>
        <button className={`btn ${tab === 'productos' ? 'btn-primary' : ''}`} style={tab !== 'productos' ? {border: 'none', background: 'transparent'} : {border: 'none', boxShadow: 'var(--shadow-sm)'}} onClick={() => { sound.playPop(); setTab('productos'); }}>
          Productos <span className="badge" style={tab !== 'productos' ? {background: 'var(--line)', color: 'var(--ink)'} : {}}>{form.items.length}</span>
        </button>
        <button className={`btn ${tab === 'entregas' ? 'btn-primary' : ''}`} style={tab !== 'entregas' ? {border: 'none', background: 'transparent'} : {border: 'none', boxShadow: 'var(--shadow-sm)'}} onClick={() => { sound.playPop(); setTab('entregas'); }}>
          Entregas <span className="badge" style={tab !== 'entregas' ? {background: 'var(--line)', color: 'var(--ink)'} : {}}>{form.deliveries.length}</span>
        </button>
        <button className={`btn ${tab === 'facturas' ? 'btn-primary' : ''}`} style={tab !== 'facturas' ? {border: 'none', background: 'transparent'} : {border: 'none', boxShadow: 'var(--shadow-sm)'}} onClick={() => { sound.playPop(); setTab('facturas'); }}>
          Facturas <span className="badge" style={tab !== 'facturas' ? {background: 'var(--line)', color: 'var(--ink)'} : {}}>{form.invoices.length}</span>
        </button>
        <button className="btn" style={{ marginLeft: 'auto', background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))', color: '#fff', border: 'none', fontWeight: 600, borderRadius: 'var(--radius-sm)' }} onClick={printConsolidatedPackage}>
          🖨️ Exportar PDF
        </button>
      </div>

      {/* TABS CONTENT */}
      <div style={{ minHeight: '50vh', maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8, position: 'relative' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {tab === 'resumen' && <TabResumen />}
            {tab === 'productos' && <TabProductos />}
            {tab === 'entregas' && <TabEntregas />}
            {tab === 'facturas' && <TabFacturas />}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
        <p className="hint" style={{ margin: 0 }}>
          Archivo original: <code>{order.fileName ?? '—'}</code>
        </p>
        {order.aiError && !readOnly && (
          <button className="btn btn-primary" style={{ background: 'var(--warn)', borderColor: 'var(--warn)' }} onClick={() => retryAI && retryAI()} disabled={busy}>
            🤖 Reintentar IA
          </button>
        )}
      </div>

      <div className="modal-actions" style={{ marginTop: 16, position: 'sticky', bottom: 0, background: 'var(--bg-modal)', padding: '16px 0', borderTop: '1px solid var(--line)', zIndex: 10 }}>
        {(order as any).isDeleted ? (
          <button className="btn btn-primary" style={{ background: 'var(--ok)', borderColor: 'var(--ok)' }} onClick={() => restore && restore()} disabled={busy}>
            {busy ? <span className="spinner" style={{ marginRight: 8 }}></span> : '↩️ '} Restaurar Expediente
          </button>
        ) : !readOnly && (
          <button
            className="btn btn-danger"
            onClick={clickEliminar}
            disabled={busy}
            style={confirmandoEliminar ? { background: '#7f1d1d', animation: 'pulse 1s infinite' } : undefined}
          >
            {busy ? <span className="spinner" style={{ marginRight: 8 }}></span> : confirmandoEliminar ? '⚠️ ' : '🗑️ '}
            {confirmandoEliminar ? '¿Seguro? Clic para confirmar' : 'Eliminar Expediente'}
          </button>
        )}
        <button className="btn" onClick={handlePrintRemision} style={{ marginLeft: 12 }}>📄 Generar Remisión (PDF)</button>
        <button className="btn" onClick={handlePrintPreFactura} style={{ marginLeft: 12, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }}>📋 Pre-Factura CFDI 4.0 (PDF)</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
        {!readOnly && (
          <button className="btn btn-primary" onClick={() => save && save()} disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar cambios'}
          </button>
        )}
      </div>
    </Modal>
  );
}

// HOC for the modal entry point
export default function OrderModal({
  order,
  config,
  onClose,
  readOnly = false,
  initialTab = 'resumen',
  focusInvoiceId = null,
}: {
  order: PurchaseOrder;
  config: FinancialConfig;
  onClose: () => void;
  readOnly?: boolean;
  initialTab?: TabName;
  focusInvoiceId?: string | null;
}) {
  return (
    <OrderModalProvider
      order={order}
      config={config}
      readOnly={readOnly}
      initialTab={initialTab}
      focusInvoiceId={focusInvoiceId}
      onClose={onClose}
    >
      <OrderModalShell onClose={onClose} />
    </OrderModalProvider>
  );
}
