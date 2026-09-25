import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import { money } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
import type { PurchaseOrder } from '../../lib/types';

interface SmartPasteCrModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: PurchaseOrder[];
}

export const SmartPasteCrModal: React.FC<SmartPasteCrModalProps> = ({
  isOpen,
  onClose,
  orders,
}) => {
  const toast = useToast();
  const [rawText, setRawText] = useState('');
  const [saving, setSaving] = useState(false);

  // Heurística de extracción de datos del texto
  const parsedData = useMemo(() => {
    if (!rawText.trim()) return null;

    // 1. Extraer Contrarecibo (TH-xxx, GT-xxx)
    const crMatch = rawText.match(/\b(TH|GT)[-\s]?(\d{2,4})\b/i);
    const cr = crMatch ? `${crMatch[1].toUpperCase()}-${crMatch[2]}` : null;

    // 2. Extraer Factura (F-xxxx, Factura xxxx, #xxxx)
    const invMatch = rawText.match(/(?:factura|fac|f-|#)\s*(\d{4,6})\b/i) || rawText.match(/\b(6\d{3})\b/);
    const invoiceFolio = invMatch ? invMatch[1] : null;

    // 3. Extraer Monto ($xx,xxx.xx)
    const amountMatch = rawText.match(/\$\s*([\d,]+(?:\.\d{2})?)/) || rawText.match(/\b([\d,]{4,}(?:\.\d{2})?)\s*(?:pesos|mxn|\b)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null;

    // 4. Extraer Fecha (DD/MM/AAAA, DD-MM-AAAA, o "24 de octubre")
    const dateMatch = rawText.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    let dueDate: Date | null = null;
    if (dateMatch) {
      const day = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      let year = parseInt(dateMatch[3], 10);
      if (year < 100) year += 2000;
      dueDate = new Date(year, month, day);
    }

    // Buscar orden correspondiente en la base de datos
    let matchedOrder: PurchaseOrder | null = null;
    let matchedInvoice: any = null;

    if (invoiceFolio) {
      for (const o of orders) {
        const inv = (o.invoices || []).find((i: any) => String(i.folio || i.id).includes(invoiceFolio));
        if (inv) {
          matchedOrder = o;
          matchedInvoice = inv;
          break;
        }
      }
    }

    return {
      cr,
      invoiceFolio,
      amount,
      dueDate,
      matchedOrder,
      matchedInvoice,
    };
  }, [rawText, orders]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText(text);
        toast('Texto pegado desde el portapapeles', 'ok');
      } else {
        toast('El portapapeles está vacío', 'bad');
      }
    } catch {
      toast('Permiso de portapapeles denegado. Pega el texto manualmente con Ctrl+V.', 'bad');
    }
  };

  const handleApply = async () => {
    if (!parsedData?.cr) {
      toast('No se detectó un número de contrarecibo válido (ej. TH-990)', 'bad');
      return;
    }

    if (!parsedData.matchedOrder) {
      toast('No se encontró una orden vinculada a la factura detectada. Verifica el texto.', 'bad');
      return;
    }

    setSaving(true);
    try {
      const order = parsedData.matchedOrder;
      const orderRef = doc(db, PATHS.orders, order.id);

      const updatedInvoices = (order.invoices || []).map((inv: any) => {
        const isTarget = !parsedData.invoiceFolio || String(inv.folio || inv.id).includes(parsedData.invoiceFolio);
        if (isTarget) {
          return {
            ...inv,
            collection: {
              ...(inv.collection || {}),
              contrareciboNumber: parsedData.cr,
              ...(parsedData.dueDate ? { contrareciboDate: Timestamp.fromDate(parsedData.dueDate) } : {}),
            },
            creditCycle: {
              ...(inv.creditCycle || {}),
              status: 'pending',
              ...(parsedData.dueDate ? { dueDate: Timestamp.fromDate(parsedData.dueDate) } : {}),
            },
          };
        }
        return inv;
      });

      await updateDoc(orderRef, {
        'collection.contrareciboNumber': parsedData.cr,
        invoices: updatedInvoices,
        updatedAt: serverTimestamp(),
      });

      toast(`Contrarecibo ${parsedData.cr} asignado con éxito a OC ${order.oc || order.folio}`, 'ok');
      onClose();
      setRawText('');
    } catch (err: any) {
      toast(`Error al aplicar contrarecibo: ${err.message}`, 'bad');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--paper-raised, #0f172a)',
            border: '1px solid var(--border, rgba(255, 255, 255, 0.15))',
            borderRadius: 18,
            width: '100%',
            maxWidth: 540,
            padding: 24,
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
            color: 'var(--ink, #fff)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>📋</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Pegado Inteligente (Smart Paste)</h3>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-soft)' }}>
                  Pega mensajes de WhatsApp o correo de Providencia para auto-capturar CR
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'var(--ink-soft)', cursor: 'pointer', fontSize: 18 }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)' }}>
                Texto copiado:
              </label>
              <button
                type="button"
                onClick={handlePasteClipboard}
                style={{
                  background: 'rgba(124, 58, 237, 0.15)',
                  border: '1px solid rgba(124, 58, 237, 0.35)',
                  color: '#a78bfa',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                📋 Pegar Portapapeles
              </button>
            </div>
            <textarea
              rows={4}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Ejemplo: Hola Paco, el folio TH-1045 ampara la factura 6307 por $99,061.68 paga el 24/10/2026..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid var(--border, rgba(255,255,255,0.15))',
                background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
                color: 'var(--ink, #fff)',
                fontSize: 12.5,
                lineHeight: 1.45,
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Tarjeta de Datos Detectados */}
          {parsedData && (
            <div
              style={{
                background: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 12,
                padding: 14,
                marginBottom: 18,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#34d399', textTransform: 'uppercase', marginBottom: 8 }}>
                ✨ Datos Detectados por la IA:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
                <div>
                  <span style={{ color: 'var(--ink-soft)' }}>Contrarecibo: </span>
                  <strong style={{ color: parsedData.cr ? '#fbbf24' : '#f87171' }}>
                    {parsedData.cr || 'No detectado'}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)' }}>Factura: </span>
                  <strong>{parsedData.invoiceFolio ? `#${parsedData.invoiceFolio}` : 'No detectada'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)' }}>Monto: </span>
                  <strong>{parsedData.amount ? money(parsedData.amount) : '—'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)' }}>Fecha Pago: </span>
                  <strong>{parsedData.dueDate ? parsedData.dueDate.toLocaleDateString('es-MX') : '—'}</strong>
                </div>
              </div>

              {parsedData.matchedOrder ? (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed rgba(16,185,129,0.2)', fontSize: 11.5, color: '#34d399' }}>
                  ✓ Vinculada a: <strong>{parsedData.matchedOrder.client}</strong> (OC: {parsedData.matchedOrder.oc || parsedData.matchedOrder.folio})
                </div>
              ) : parsedData.invoiceFolio ? (
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed rgba(239,68,68,0.2)', fontSize: 11.5, color: '#f87171' }}>
                  ⚠️ Factura #{parsedData.invoiceFolio} no encontrada en las órdenes activas.
                </div>
              ) : null}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                background: 'var(--paper-sunk)',
                border: '1px solid var(--border)',
                color: 'var(--ink-soft)',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={saving || !parsedData?.cr || !parsedData.matchedOrder}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                background: parsedData?.cr && parsedData.matchedOrder ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                fontSize: 12.5,
                fontWeight: 800,
                cursor: parsedData?.cr && parsedData.matchedOrder ? 'pointer' : 'not-allowed',
                boxShadow: parsedData?.cr && parsedData.matchedOrder ? '0 4px 12px rgba(5,150,105,0.35)' : 'none',
              }}
            >
              {saving ? 'Guardando...' : '✅ Aplicar a Sistema'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
