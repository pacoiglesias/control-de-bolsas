import React, { useEffect, useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { PasteTextModal } from '../PasteTextModal';
import { Timestamp } from 'firebase/firestore';
import { addDays } from '../../lib/finance';
import { useInvoiceActions } from './useInvoiceActions';
import { InvoiceWidget } from './InvoiceWidget';
import type { Invoice } from '../../lib/types';

export default function TabFacturas() {
  const ctx = useOrderModal();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [pegando, setPegando] = useState<'factura' | 'complemento' | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
    
    // Auto-save immediately using useInvoiceActions
    try {
      await saveInvoice(order, newInv, dynamicConfig);
      setExpandedIds(prev => new Set(prev).add(nuevoId));
      toast('Factura creada exitosamente', 'ok');
    } catch (e: any) {
      // error handled in saveInvoice
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0 }}>Facturas Emitidas</h3>
          <p className="hint" style={{ margin: 0 }}>Facturas vinculadas a este pedido.</p>
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="file" accept=".xml" ref={fileInputRef} style={{ display: 'none' }} onChange={handleXmlUpload} />
            
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
              <button className="btn btn-primary" onClick={addInvoiceLocal}>+ Manual</button>
              {kilosPendientesDeFacturar > 0.01 && (
                <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                  Sugerido: {kilosPendientesDeFacturar.toLocaleString('es-MX')} kg
                </span>
              )}
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
            📋 Copiar Todo para SAT
          </button>
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
            const ORDEN_ESTADO: Record<string, number> = { overdue: 0, pending: 0, paid: 1, collected: 2 };
            const TITULO_SECCION: Record<string, string> = {
              pending: '🔴 Por Cobrar', overdue: '🔴 Por Cobrar',
              paid: '🟡 Con el Contador', collected: '✅ Cobradas',
            };
            const ordenadas = [...invoices].sort(
              (a, b) => (ORDEN_ESTADO[a.creditCycle.status] ?? 9) - (ORDEN_ESTADO[b.creditCycle.status] ?? 9)
            );
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
