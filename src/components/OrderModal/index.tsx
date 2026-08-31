import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../ui';
import { sound } from '../../lib/sounds';
import type { FinancialConfig, PurchaseOrder } from '../../lib/types';
import type { TabName } from './types';

import { OrderModalProvider } from './OrderModalProvider';
import { useOrderModal } from './OrderModalContext';
import { FacturasCRModal } from './FacturasCRModal';
import { confirmDialog } from '../../lib/confirmDialog';

import TabResumen from './TabResumen';
import TabProductos from './TabProductos';
import TabEntregas from './TabEntregas';
import TabFacturas from './TabFacturas';
import { TabAndresOrder } from './TabAndresOrder';
import { OrderStepper } from './OrderStepper';
import { NextActionBanner } from './NextActionBanner';
import { EmitirFacturaModal } from './EmitirFacturaModal';
import { money, nombreClienteVisible } from '../../lib/format';
import { useProducts } from '../../hooks/useProducts';
import { useSystemSettings } from '../../hooks/useSystemSettings';

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
    config,
    dynamicConfig,
    kilosPendientesDeFacturar,
    knownClients,
    knownProviders,
    knownClientEmails,
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

  // Estado local: ¿mostrar el modal de Facturas & CR? o Emitir Factura
  const [showCRModal, setShowCRModal] = useState(initialOpenCR);
  const [showEmitirFacturaModal, setShowEmitirFacturaModal] = useState(false);

  // Antes, cerrar el expediente (X, Escape, clic afuera, o el boton
  // "Cancelar") descartaba SIEMPRE lo escrito sin avisar -- form vive en
  // estado local hasta que se presiona "Guardar cambios" explicitamente.
  // Pegar una OC entera, capturar entregas o editar precios y luego cerrar
  // sin querer (un Escape reflejo, un clic afuera del modal) borraba todo
  // sin ningun aviso. Se compara el formulario actual contra una foto del
  // momento en que se abrio el expediente; si cambio algo, se pide
  // confirmacion antes de cerrar. Despues de "Guardar cambios" el cierre
  // sigue siendo directo (save() ya usa el onClose original del contexto).
  const [snapshotInicial] = useState(() => JSON.stringify(form));
  const hayCambiosSinGuardar = !readOnly && JSON.stringify(form) !== snapshotInicial;
  const handleClose = async () => {
    if (hayCambiosSinGuardar) {
      const confirmar = await confirmDialog({
        message: 'Tienes cambios sin guardar en este expediente. Si cierras ahora, se perderán.\n\n¿Cerrar sin guardar?',
        danger: true,
      });
      if (!confirmar) return;
    }
    onClose();
  };
  const { products } = useProducts();

  // CRs únicos del expediente para mostrar en la cabecera
  const crs = [...new Set(
    (form.invoices ?? [])
      .map((inv: any) => inv.collection?.contrareciboNumber)
      .filter(Boolean)
  )] as string[];

  const invoiceCount: number = form.invoices?.length ?? 0;


  const hasUninvoicedDeliveries = form.deliveries.some((d: any) => !d.invoiced);

  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';

  const TABS: { key: TabName; label: string; count?: number; alert?: boolean }[] = [
    { key: 'resumen',   label: '📋 Expediente' },
    { key: 'productos', label: '📦 Orden de Compra', count: form.items.length },
    { key: 'andres',    label: `🏭 Pedido a ${provName}` },
    { key: 'entregas',  label: '🚛 Entregas', count: form.deliveries.length, alert: hasUninvoicedDeliveries },
    { key: 'facturas',  label: '🧾 Facturas & Cobros', count: invoiceCount, alert: hasUninvoicedDeliveries },
  ];

  return (
    <>
      <Modal
        wide
        title={
          /* ── Cabecera de identidad: PED · OC · CR siempre visibles sin duplicados ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {order.folio && order.folio !== order.oc ? (
                  <DocBadge type="ped" value={order.folio} />
                ) : !order.oc ? (
                  <DocBadge type="ped" value={order.folio ?? `#${order.id?.slice(0,6)}`} />
                ) : null}
                {order.oc && <DocBadge type="oc" value={order.oc} />}
                {crs.map(cr => <DocBadge key={cr} type="cr" value={cr} />)}
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={async () => {
                    const isClosed = form.isClosedShort;
                    if (isClosed) {
                      const ok = await confirmDialog({
                        message: '¿Deseas reabrir esta OC para permitir nuevas entregas de material?',
                      });
                      if (!ok) return;
                      form.isClosedShort = false;
                      save();
                    } else {
                      const ok = await confirmDialog({
                        message: '¿Deseas cerrar definitivamente esta OC con los kilos entregados hasta ahora?\n\nEsto quitará la alerta de kilos pendientes por entregar.',
                      });
                      if (!ok) return;
                      form.isClosedShort = true;
                      save();
                    }
                  }}
                  style={{
                    background: form.isClosedShort ? 'rgba(59, 130, 246, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                    color: form.isClosedShort ? '#2563eb' : '#d97706',
                    border: `1px solid ${form.isClosedShort ? 'rgba(59, 130, 246, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                    borderRadius: 8,
                    padding: '4px 10px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                  title={form.isClosedShort ? 'Clic para reabrir OC' : 'Clic para cerrar OC por menos kilos'}
                >
                  <span>{form.isClosedShort ? '🔓 OC Cerrada (Reabrir)' : '🔒 Cerrar OC (Menos Kilos)'}</span>
                </button>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', fontWeight: 500 }}>
              {nombreClienteVisible(order.client)}
              {order.provider && !/ELEMENTAL\s*DENIM|N0321/i.test(order.provider) ? (
                <>
                  <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
                  <span>{order.provider}</span>
                </>
              ) : null}
            </div>
          </div>
        }
        onClose={handleClose}
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
        <datalist id="known-departments">
          <option value="TH" />
          <option value="GT" />
        </datalist>
        <datalist id="known-client-emails">
          {knownClientEmails.map((e: string) => <option key={e} value={e} />)}
        </datalist>

        {/* ── Pipeline Visual del Expediente ── */}
        <OrderStepper
          order={order}
          activeTab={tab}
          onSelectTab={(t) => {
            if (t === 'facturas') setShowCRModal(true);
            else setTab(t as any);
          }}
        />

        {/* ── Asistente Proactivo de Siguiente Acción ── */}
        <NextActionBanner
          order={order}
          config={config}
          onNavigateTab={(t) => {
            if (t === 'facturas') setShowCRModal(true);
            else setTab(t as any);
          }}
        />

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

        {/* ── BOTONES DE ACCIÓN: EMITIR FACTURA Y FACTURAS/CR ────────────────── */}
        {(() => {
          const kilosEntregados = (form.deliveries || []).reduce((sum: number, d: any) => sum + (Number(d.kilos) || 0), 0);
          const kilosFacturados = (form.invoices || []).reduce((sum: number, inv: any) => sum + (Number(inv.kilos) || 0), 0);
          const pendingKgToBill = Math.max(0, kilosEntregados - kilosFacturados);

          return (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              {/* Botón Principal: EMITIR FACTURA */}
              <button
                type="button"
                onClick={() => { sound.playPop(); setShowEmitirFacturaModal(true); }}
                style={{
                  flex: '1 1 260px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
                  background: pendingKgToBill > 0 
                    ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' 
                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none', color: '#ffffff',
                  fontWeight: 800, fontSize: 14,
                  boxShadow: pendingKgToBill > 0 
                    ? '0 4px 16px rgba(245, 158, 11, 0.4)' 
                    : '0 4px 16px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>🧾</span>
                  <span>
                    {pendingKgToBill > 0 
                      ? `EMITIR FACTURA (${pendingKgToBill.toLocaleString('es-MX')} kg listos)`
                      : `+ Emitir Factura`}
                  </span>
                </span>
                <span style={{ fontSize: 12.5, background: 'rgba(255,255,255,0.25)', padding: '3px 8px', borderRadius: 6 }}>
                  Asistente 3 Pasos ➔
                </span>
              </button>

              {/* Botón: Facturas & Contrarecibos (Historial y Cobros) */}
              <button
                type="button"
                onClick={() => { sound.playPop(); setShowCRModal(true); }}
                style={{
                  flex: '1 1 200px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--paper-sunk)',
                  border: '1px solid var(--line)', color: 'var(--ink)',
                  fontWeight: 700, fontSize: 13.5,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>💰</span>
                  <span>
                    Facturas &amp; CR ({invoiceCount})
                  </span>
                </span>
                <span style={{ color: 'var(--ink-soft)' }}>Ver Historial →</span>
              </button>
            </div>
          );
        })()}

        {/* ── Tabs: SOLO Expediente · OC · Pedido Andrés · Entregas ── */}
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
              {t.alert && (
                <span 
                  style={{
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    marginLeft: 5,
                    boxShadow: '0 0 6px #f59e0b',
                  }} 
                  title="Hay entregas pendientes de facturar"
                />
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
              {tab === 'andres'    && <TabAndresOrder order={order} config={config} customCostPrice={form.customCostPrice} customSellPrice={form.customSellPrice} />}
              {tab === 'entregas'  && <TabEntregas />}
              {tab === 'facturas'  && <TabFacturas />}
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
          <button
            type="button"
            className="btn"
            style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            onClick={handlePrintRemision}
            title="Imprimir o ver Remisión Oficial de Báscula"
          >
            <span>📄</span> Remisión de Báscula
          </button>
          <button
            type="button"
            className="btn"
            style={{ marginLeft: 8, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: '#fff', border: 'none', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            onClick={handlePrintPreFactura}
            title="Descargar Pre-Factura en formato PDF oficial para facturar en SAT"
          >
            <span>📋</span> Descargar Pre-Factura PDF
          </button>
          <span className="spacer" />
          <button className="btn" onClick={handleClose} disabled={busy}>{readOnly ? 'Cerrar' : 'Cancelar'}</button>
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

      {/* ── Modal de Emisión Rápida Asistida de Factura ── */}
      {showEmitirFacturaModal && (
        <EmitirFacturaModal
          order={order}
          kilosPendientes={kilosPendientesDeFacturar}
          dynamicConfig={dynamicConfig}
          config={config}
          onClose={() => setShowEmitirFacturaModal(false)}
          onCreated={() => {
            setShowEmitirFacturaModal(false);
            sound.playChaChing();
          }}
        />
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
  const openCRDirectly = !!focusInvoiceId;
  const realInitialTab: TabName = initialTab;

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
