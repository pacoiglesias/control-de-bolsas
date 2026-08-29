import React, { useEffect, useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { PasteTextModal } from '../PasteTextModal';
import { useInvoiceActions } from './useInvoiceActions';
import { InvoiceWidget } from './InvoiceWidget';
import { EmitirFacturaModal } from './EmitirFacturaModal';
import type { Invoice } from '../../lib/types';
import { getEffectiveOrderItems } from '../../lib/types';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';

export default function TabFacturas() {
  const ctx = useOrderModal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pegando, setPegando] = useState<'factura' | 'complemento' | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showEmitirModal, setShowEmitirModal] = useState(false);

  const { saveInvoice } = useInvoiceActions();

  const toggleExpandida = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const focusInvoiceId = ctx?.focusInvoiceId ?? null;
  useEffect(() => {
    if (!focusInvoiceId) return;
    setExpandedIds(prev => new Set(prev).add(focusInvoiceId));
    const t = setTimeout(() => {
      const el = document.getElementById(`factura-card-${focusInvoiceId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const inputFolio = el?.querySelector('input[type="text"], input:not([type])') as HTMLInputElement | null;
      inputFolio?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [focusInvoiceId]);

  if (!ctx) return null;
  
  // NOTE: We now read invoices from the ACTUAL order in context, not the unsaved form state.
  const { order, readOnly, provName, config, dynamicConfig, processFacturaText, processPagoText, toast, kilosPendientesDeFacturar } = ctx;
  const invoices = order.invoices || [];

  const handleXmlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = '';
  };

  const addInvoiceLocal = async () => {
    // Kept as escape hatch for advanced users
    const { Timestamp } = await import('firebase/firestore');
    const { addDays } = await import('../../lib/finance');
    const issue = new Date();
    const due = addDays(issue, config.creditDays);
    const nuevoId = Date.now().toString();
    const newInv: Invoice = {
      id: nuevoId,
      orderId: order.id || '',
      folio: '',
      kilos: kilosPendientesDeFacturar,
      creditCycle: { status: 'pending', issueDate: Timestamp.fromDate(issue), dueDate: Timestamp.fromDate(due) },
      collection: { paidAmount: 0, contrareciboNumber: '', notes: '' }
    };
    try {
      await saveInvoice(order, newInv, dynamicConfig);
      setExpandedIds(prev => new Set(prev).add(nuevoId));
      toast('Factura creada exitosamente', 'ok');
    } catch {
      // error handled in saveInvoice
    }
  };

  return (
    <>
      {/* Modal de Emisión Guiada */}
      {showEmitirModal && (
        <EmitirFacturaModal
          order={order}
          kilosPendientes={kilosPendientesDeFacturar}
          dynamicConfig={dynamicConfig}
          config={config}
          onClose={() => setShowEmitirModal(false)}
          onCreated={(inv) => setExpandedIds(prev => new Set(prev).add(inv.id))}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Facturas Emitidas</h3>
          <p className="hint" style={{ margin: 0 }}>Facturas vinculadas a este pedido.</p>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={handleXmlUpload} />

            {/* Botón principal: asistente paso a paso */}
            <button
              className="btn btn-primary"
              onClick={() => setShowEmitirModal(true)}
              style={{ padding: '8px 16px', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              🧾 Emitir Factura
              {kilosPendientesDeFacturar > 0.01 && (
                <span style={{ background: 'rgba(255,255,255,0.25)', padding: '1px 7px', borderRadius: 20, fontSize: 11, fontWeight: 900 }}>
                  {kilosPendientesDeFacturar.toLocaleString('es-MX')} kg
                </span>
              )}
            </button>

            <button className="btn" onClick={() => setPegando('factura')} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }}>📋 PEGAR TEXTO (PDF)</button>
            <button className="btn" onClick={() => setPegando('complemento')} style={{ background: 'var(--bg-card)', border: '1px dashed var(--ok)', color: 'var(--ok)' }}>💰 PEGAR COMPLEMENTO</button>

            {pegando === 'factura' && (
              <PasteTextModal
                title="Pegar texto de la Factura"
                placeholder="Pega aquí el texto completo copiado del PDF de la Factura…"
                onConfirm={(text) => processFacturaText(text)}
                onClose={() => setPegando(null)}
              />
            )}
            {pegando === 'complemento' && (
              <PasteTextModal
                title="Pegar texto del Complemento de Pago"
                placeholder="Pega aquí el texto completo copiado del PDF del Complemento de Pago…"
                onConfirm={(text) => processPagoText(text)}
                onClose={() => setPegando(null)}
              />
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="btn" onClick={addInvoiceLocal} style={{ fontSize: 12, opacity: 0.7 }} title="Crear factura en blanco sin asistente">+ En Blanco</button>
            </div>
          </div>
        )}
      </div>

      {/* 🏛️ Widget de Datos Listos para Facturar en el Portal del SAT (CFDI 4.0) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(2,132,199,0.08) 0%, rgba(3,105,161,0.12) 100%)',
        border: '1px solid #0284c7',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>🏛️</span> Datos para emitir Factura SAT (CFDI 4.0) a Providencia
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 11, padding: '3px 8px', background: '#2563eb', color: '#fff', border: 'none', fontWeight: 700 }}
              onClick={async () => {
                toast('📄 Generando Prefactura en PDF...', 'info');
                await generatePrefacturaPdf(order, null);
                toast('✅ Prefactura descargada con éxito', 'ok');
              }}
            >
              📄 Prefactura PDF
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '3px 8px' }}
              onClick={() => {
                const rfc = 'GTP930115PU1';
                const razon = 'GRUPO TEXTIL PROVIDENCIA';
                const regimen = '601 - General de Ley Personas Morales';
                const uso = 'G01 - Adquisición de mercancías';
                const claveProd = '24111500';
                const claveUnidad = 'KGM';
                const precio = (dynamicConfig.salePricePerKg || config.salePricePerKg || 43).toFixed(2);
                const txt = `RFC: ${rfc}\nNombre: ${razon}\nRégimen: ${regimen}\nUso CFDI: ${uso}\nClave ProdServ: ${claveProd}\nUnidad: ${claveUnidad}\nPrecio Unitario: $${precio}\nObjeto Impuesto: 02 - Sí objeto de impuesto (IVA 16%)\nMétodo de Pago: PPD\nForma de Pago: 99`;
                navigator.clipboard.writeText(txt);
                toast('📋 Datos fiscales copiados para el portal del SAT', 'ok');
              }}
            >
              📋 Copiar para SAT
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 11 }}>
          <div style={{ background: 'var(--paper)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>RFC Receptor:</span><br/>
            <strong>GTP930115PU1</strong>
          </div>
          <div style={{ background: 'var(--paper)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>Clave SAT:</span><br/>
            <strong>24111500</strong> (Bolsas)
          </div>
          <div style={{ background: 'var(--paper)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>Unidad:</span><br/>
            <strong>KGM</strong> (Kilogramo)
          </div>
          <div style={{ background: 'var(--paper)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>Precio Sugerido:</span><br/>
            <strong style={{ color: 'var(--ok)' }}>${(dynamicConfig.salePricePerKg || config.salePricePerKg || 43).toFixed(2)}</strong> / kg
          </div>
          <div style={{ background: 'var(--paper)', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--line-soft)' }}>
            <span style={{ color: 'var(--ink-soft)' }}>Impuesto / Pago:</span><br/>
            <strong>IVA 16% · PPD (99)</strong>
          </div>
        </div>

        {/* Partidas de la OC disponibles para facturar */}
        {(() => {
          const effectiveItems = getEffectiveOrderItems(order);
          if (effectiveItems.length === 0) return null;
          return (
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(2,132,199,0.2)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📦 Partidas de la OC ({effectiveItems.length} conceptos disponibles):</span>
                <button
                  type="button"
                  className="btn-small"
                  style={{ fontSize: 10, padding: '2px 6px', background: '#0284c7', color: '#fff', border: 'none', fontWeight: 700 }}
                  onClick={() => setShowEmitirModal(true)}
                >
                  ⚡ Facturar con Partidas
                </button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
                {effectiveItems.map((it, idx) => (
                  <div key={it.id || idx} style={{ background: 'var(--paper)', padding: '5px 8px', borderRadius: 6, border: '1px solid var(--line-soft)', fontSize: 11, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ minWidth: 0, paddingRight: 6 }}>
                      <span className="mono" style={{ fontWeight: 800, color: '#2563eb' }}>{it.code || 'S/C'}</span> · <span style={{ fontWeight: 600 }}>{it.description}</span>
                    </div>
                    <strong className="mono" style={{ whiteSpace: 'nowrap', fontSize: 11.5 }}>
                      {(Number(it.quantity) || 0).toLocaleString('es-MX')} kg
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
      
      {invoices.length === 0 ? (

        <div className="empty">
          <span className="empty-icon">🧾</span>
          <strong style={{ display: 'block', fontSize: 14, color: 'var(--ink)' }}>Sin Facturas</strong>
          No hay facturas registradas. Si la IA detecta que este PDF es una factura, la agregará aquí automáticamente.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {(() => {
            const ORDEN_ESTADO: Record<string, number> = { overdue: 0, pending: 0, in_review: 0, paid: 1, collected: 2 };
            const TITULO_SECCION: Record<string, string> = {
              pending: '🔴 Por Cobrar',
              in_review: '🔴 Por Cobrar',
              overdue: '🔴 Por Cobrar',
              paid: '🟡 Con el Contador',
              collected: '✅ Cobradas',
            };
            const ordenadas = [...invoices].sort((a, b) => {
              const ga = ORDEN_ESTADO[a.creditCycle.status] ?? 9;
              const gb = ORDEN_ESTADO[b.creditCycle.status] ?? 9;
              if (ga !== gb) return ga - gb;
              // Orden secundario: vencimiento más próximo primero
              const toMs = (ts: any) => ts ? (typeof ts.toDate === 'function' ? ts.toDate().getTime() : new Date(ts).getTime()) : Infinity;
              return toMs(a.creditCycle.dueDate) - toMs(b.creditCycle.dueDate);
            });
            return ordenadas.map((inv: Invoice, i: number) => {
              const statusActual = inv.creditCycle.status;
              const statusAnterior = i > 0 ? ordenadas[i - 1].creditCycle.status : null;
              const grupoActual = TITULO_SECCION[statusActual] || 'Otras';
              const grupoAnterior = statusAnterior ? (TITULO_SECCION[statusAnterior] || 'Otras') : null;
              const nuevaSeccion = grupoActual !== grupoAnterior;
              
              return (
                <React.Fragment key={inv.id}>
                  {nuevaSeccion && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginTop: i > 0 ? 8 : 0, paddingBottom: 4, borderBottom: '1px solid var(--line)' }}>
                      {grupoActual}
                    </div>
                  )}
                  <InvoiceWidget
                    invoice={inv}
                    order={order}
                    provName={provName}
                    config={config}
                    dynamicConfig={dynamicConfig}
                    readOnly={readOnly}
                    expanded={expandedIds.has(inv.id)}
                    onToggleExpand={() => toggleExpandida(inv.id)}
                    enFoco={inv.id === focusInvoiceId}
                  />
                </React.Fragment>
              );
            });
          })()}
        </div>
      )}
    </>
  );
}
