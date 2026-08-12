import React, { useEffect, useState } from 'react';
import { useOrderModal } from './OrderModalContext';
import { PasteTextModal } from '../PasteTextModal';
import { Timestamp } from 'firebase/firestore';
import { addDays } from '../../lib/finance';
import { useInvoiceActions } from './useInvoiceActions';
import { InvoiceWidget } from './InvoiceWidget';
import { parseXmlInvoice } from '../../lib/xmlParser';
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
  const { order, readOnly, provName, config, dynamicConfig, processFacturaText, processPagoText, processParsedXml, toast, kilosPendientesDeFacturar } = ctx;
  const invoices = order.invoices || [];

  // FIX 2026-08-11: este handler existia desde antes como un stub vacio
  // ("e.target.value = ''") -- el <input type="file" accept=".xml"> estaba
  // en el DOM pero ningun boton visible llamaba a fileInputRef.current.click(),
  // asi que la funcionalidad de subir el XML real del CFDI (ya implementada
  // en lib/xmlParser.ts + useInvoiceParser.processParsedXml, con pruebas
  // unitarias incluidas) nunca era alcanzable desde la interfaz. Se detecto
  // al preguntar el usuario "el sistema tiene para leer los xml de facturas?".
  const handleXmlUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permitir volver a subir el mismo archivo si hace falta reintentar
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseXmlInvoice(text);
      await processParsedXml(parsed);
    } catch (err: any) {
      toast(`No se pudo leer el XML: ${err?.message || 'archivo inválido'}`, 'bad');
    }
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

            <button className="btn" onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px dashed var(--line)' }} title="Sube el archivo .xml del CFDI timbrado por el SAT. Se lee el Folio, kilos, OC y fecha directo del archivo, sin copiar/pegar texto.">📄 Subir XML</button>
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
