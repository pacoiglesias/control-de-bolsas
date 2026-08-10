import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui';
import { sound } from '../../lib/sounds';
import type { FinancialConfig, PurchaseOrder } from '../../lib/types';
import type { TabName } from './types';

import { OrderModalProvider } from './OrderModalProvider';
import { useOrderModal } from './OrderModalContext';
import { FacturasCRModal } from './FacturasCRModal';

import TabResumen from './TabResumen';
import TabProductos from './TabProductos';
import TabEntregas from './TabEntregas';
import { money } from '../../lib/format';
import { useProducts } from '../../hooks/useProducts';

// ─── Identidad visual de cada documento ───────────────────────────────────────
const BADGE = {
  ped: { bg: '#ede9fe', color: '#7c3aed', label: 'PED' },
  oc:  { bg: '#dbeafe', color: '#2563eb', label: 'OC'  },
  cr:  { bg: '#d1fae5', color: '#047857', label: 'CR'  },
} as const;

function DocBadge({ type, value }: { type: keyof typeof BADGE; value?: string | null }) {
  if (!value) return null;
  const s = BADGE[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      padding: '3px 10px', borderRadius: 6,
      fontSize: 12, fontWeight: 800, fontFamily: 'monospace',
      letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <span style={{ opacity: 0.6, fontSize: 10 }}>{s.label}</span>
      {value}
    </span>
  );
}

// ─── Shell principal del modal ─────────────────────────────────────────────────
function OrderModalShell({ onClose, initialOpenCR }: { onClose: () => void; initialOpenCR: boolean }) {
  const ctx = useOrderModal();
  const {
    order,
    form,
    readOnly,
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
    viabilityWarning,
  } = ctx as any;

  // Estado local: ¿mostrar el modal de Facturas & CR?
  const [showCRModal, setShowCRModal] = useState(initialOpenCR);
  const { products } = useProducts();

  // CRs únicos del expediente para mostrar en la cabecera
  const crs = [...new Set(
    (form.invoices ?? [])
      .map((inv: any) => inv.collection?.contrareciboNumber)
      .filter(Boolean)
  )] as string[];

  const invoiceCount: number = form.invoices?.length ?? 0;

  // ── Siguiente paso automático ──────────────────────────────────────────────
  const siguientePaso = (() => {
    const entregasSinFacturar = form.deliveries.filter((d: any) => !d.invoiced).length;
    if (!form.client.trim() || !form.provider.trim())
      return { texto: 'Faltan datos básicos (cliente o proveedor).', boton: 'Ir a Resumen', ir: 'resumen' as TabName, tono: '#fef3c7' };
    if (form.items.length === 0)
      return { texto: 'Agrega los productos de esta Orden de Compra (o usa "📋 Pegar Texto OC" / "🤖 Escanear OC" para autollenarlos).', boton: 'Ir a Productos', ir: 'productos' as TabName, tono: '#fef3c7' };
    if (entregasSinFacturar > 0)
      return { texto: `${entregasSinFacturar} entrega(s) sin facturar.`, boton: 'Ir a Facturar', ir: 'entregas' as TabName, tono: '#dbeafe' };
    if (kilosFaltantes > 0.01)
      return { texto: `Faltan ${kilosFaltantes.toLocaleString('es-MX')} kg por entregar.`, boton: 'Ir a Entregas', ir: 'entregas' as TabName, tono: '#dbeafe' };
    return null;
  })();

  const TABS: { key: Exclude<TabName, 'facturas'>; label: string; count?: number }[] = [
    { key: 'resumen',   label: '📋 Expediente' },
    { key: 'productos', label: '📦 Orden de Compra', count: form.items.length },
    { key: 'entregas',  label: '🚛 Entregas',        count: form.deliveries.length },
  ];

  return (
    <>
      <Modal
        wide
        title={
          /* ── Cabecera de identidad: PED · OC · CR siempre visibles ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <DocBadge type="ped" value={order.folio ?? `#${order.id?.slice(0,6)}`} />
              {order.oc && <DocBadge type="oc" value={order.oc} />}
              {crs.map(cr => <DocBadge key={cr} type="cr" value={cr} />)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
              {order.client ?? '—'}
              {order.provider ? <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span> : null}
              {order.provider ?? ''}
            </div>
          </div>
        }
        onClose={onClose}
      >
        {/* datalists para autocomplete */}
        <datalist id="catalog-products">
          {products?.map((p: any) => <option key={p.id} value={p.description} />)}
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

        {/* ── Auditoría de Viabilidad ── */}
        <div style={{
          marginBottom: 12, padding: '8px 14px', borderRadius: 8,
          background: viabilityWarning ? 'var(--warn-bg)' : 'var(--ok-bg)',
          border: `1px solid ${viabilityWarning ? 'var(--warn)' : 'var(--ok)'}`,
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13,
        }}>
          <span style={{ fontSize: 18 }}>{viabilityWarning ? '⚠️' : '✅'}</span>
          <div>
            <strong>Caja Chica:</strong> {money(cajaBalance || 0)} &nbsp;·&nbsp;
            <strong>Costo estimado:</strong> {money(estimatedTotalCost || 0)}
            {viabilityWarning && <span style={{ color: 'var(--bad)', marginLeft: 8 }}>Saldo insuficiente</span>}
          </div>
        </div>

        {/* ── Siguiente paso automático ── */}
        {!readOnly && siguientePaso && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: siguientePaso.tono, borderRadius: 8, padding: '10px 14px',
            marginBottom: 12, fontSize: 14,
          }}>
            <span style={{ fontWeight: 600 }}>👉 {siguientePaso.texto}</span>
            {tab !== siguientePaso.ir && (
              <button className="btn btn-primary" style={{ fontSize: 13 }}
                onClick={() => setTab(siguientePaso!.ir)}>
                {siguientePaso.boton} →
              </button>
            )}
          </div>
        )}

        {/* ── BOTÓN DESTACADO: Facturas & CR ────────────────────────────────── */}
        <button
          onClick={() => { sound.playPop(); setShowCRModal(true); }}
          style={{
            width: '100%', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderRadius: 10, cursor: 'pointer',
            background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
            border: '1px solid #047857', color: '#fff',
            fontWeight: 700, fontSize: 14, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>💰</span>
            <span>
              Facturas &amp; Contrarecibos
              {invoiceCount > 0 && (
                <span style={{
                  marginLeft: 10, background: 'rgba(255,255,255,0.2)',
                  padding: '1px 8px', borderRadius: 99, fontSize: 12,
                }}>
                  {invoiceCount} factura{invoiceCount !== 1 ? 's' : ''}
                </span>
              )}
              {crs.length > 0 && (
                <span style={{
                  marginLeft: 6, background: 'rgba(255,255,255,0.15)',
                  padding: '1px 8px', borderRadius: 99, fontSize: 12,
                }}>
                  CR: {crs.join(' · ')}
                </span>
              )}
            </span>
          </span>
          <span style={{ opacity: 0.7 }}>Abrir →</span>
        </button>

        {/* ── Tabs: SOLO Expediente · OC · Entregas ── */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 16,
          borderBottom: '2px solid var(--line)', paddingBottom: 0,
        }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => { sound.playPop(); setTab(t.key); }}
              style={{
                padding: '8px 16px', borderRadius: '8px 8px 0 0',
                border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13,
                background: tab === t.key ? 'var(--brand)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--ink-soft)',
                borderBottom: tab === t.key ? '2px solid var(--brand)' : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.15s',
              }}
            >
              {t.label}
              {t.count !== undefined && (
                <span style={{
                  marginLeft: 6, fontSize: 11, fontWeight: 800,
                  background: tab === t.key ? 'rgba(255,255,255,0.25)' : 'var(--line)',
                  padding: '0 6px', borderRadius: 99,
                }}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <button className="btn" style={{ marginBottom: 2, fontSize: 12 }} onClick={printConsolidatedPackage}>
            🖨️ PDF Consolidado
          </button>
        </div>

        {/* ── Contenido de tabs ── */}
        <div style={{ minHeight: '45vh', maxHeight: '55vh', overflowY: 'auto', overflowX: 'hidden', paddingRight: 8, position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18, ease: 'easeInOut' }}
            >
              {tab === 'resumen'   && <TabResumen />}
              {tab === 'productos' && <TabProductos />}
              {tab === 'entregas'  && <TabEntregas />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Pie del modal ── */}
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
          Archivo: <code>{order.fileName ?? '—'}</code>
        </div>

        <div className="modal-actions" style={{
          marginTop: 14, position: 'sticky', bottom: 0,
          background: 'var(--bg-modal)', padding: '14px 0',
          borderTop: '1px solid var(--line)', zIndex: 10,
        }}>
          {(order as any).isDeleted ? (
            <button className="btn btn-primary" style={{ background: 'var(--ok)', borderColor: 'var(--ok)' }}
              onClick={() => restore && restore()} disabled={busy}>
              {busy ? <span className="spinner" style={{ marginRight: 8 }} /> : '↩️ '}Restaurar
            </button>
          ) : !readOnly && (
            <button className="btn btn-danger" onClick={clickEliminar} disabled={busy}
              style={confirmandoEliminar ? { background: '#7f1d1d', animation: 'pulse 1s infinite' } : undefined}>
              {busy ? <span className="spinner" style={{ marginRight: 8 }} /> : confirmandoEliminar ? '⚠️ ' : '🗑️ '}
              {confirmandoEliminar ? '¿Seguro? Confirmar' : 'Eliminar'}
            </button>
          )}
          {order.aiError && !readOnly && (
            <button className="btn btn-primary" style={{ background: 'var(--warn)', borderColor: 'var(--warn)', marginLeft: 8 }}
              onClick={() => retryAI && retryAI()} disabled={busy}>
              🤖 Reintentar IA
            </button>
          )}
          <button className="btn" style={{ marginLeft: 8 }} onClick={handlePrintRemision}>📄 Remisión</button>
          <button className="btn" style={{ marginLeft: 8, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', fontWeight: 600 }}
            onClick={handlePrintPreFactura}>📋 Pre-Factura</button>
          <span className="spacer" />
          <button className="btn" onClick={onClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
          {!readOnly && (
            <button className="btn btn-primary" onClick={() => save && save()} disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar cambios'}
            </button>
          )}
        </div>
      </Modal>

      {/* ── Modal secundario: Facturas & CR (se monta dentro del Provider) ── */}
      {showCRModal && (
        <FacturasCRModal onClose={() => setShowCRModal(false)} />
      )}
    </>
  );
}

// ─── Entry point ──────────────────────────────────────────────────────────────
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
  // Si llega con focusInvoiceId o initialTab='facturas' (desde Cobranza),
  // el CR modal se abre directo sin pasar por el tab de facturas (ya no existe).
  const openCRDirectly = !!focusInvoiceId || initialTab === 'facturas';
  const realInitialTab: TabName = openCRDirectly ? 'resumen' : initialTab;

  return (
    <OrderModalProvider
      order={order}
      config={config}
      readOnly={readOnly}
      initialTab={realInitialTab}
      focusInvoiceId={focusInvoiceId}
      onClose={onClose}
    >
      <OrderModalShell onClose={onClose} initialOpenCR={openCRDirectly} />
    </OrderModalProvider>
  );
}
