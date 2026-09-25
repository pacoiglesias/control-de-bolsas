import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, serverTimestamp, Timestamp, deleteField } from 'firebase/firestore';
import { db, PATHS } from '../../lib/firebase';
import type { PurchaseOrder, OcClosureAudit } from '../../lib/types';
import { kilos, money } from '../../lib/format';
import { triggerHaptic } from '../../lib/hapticEngine';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

interface OcClosureModalProps {
  order: PurchaseOrder | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const CLOSURE_REASONS = [
  { id: 'cumplimiento_completo', label: '✅ Entrega 100% Completa (Sin faltantes)', status: 'completo' as const },
  { id: 'merma_tolerable', label: '🟢 Merma / Tolerancia de Báscula (< 2% de variación normal)', status: 'merma_tolerable' as const },
  { id: 'finiquito_proveedor', label: '⚠️ Maquilador (Andrés) ya no enviará material (Finiquito acordado)', status: 'con_faltante' as const },
  { id: 'cancelacion_cliente', label: '🛑 Providencia recortó pedido / Cancelación parcial de OC', status: 'con_faltante' as const },
  { id: 'otro', label: '📝 Otro motivo de cierre administrativo', status: 'con_faltante' as const },
];

export const OcClosureModal: React.FC<OcClosureModalProps> = ({ order, onClose, onSuccess }) => {
  const { user } = useAuth();
  const toast = useToast();

  if (!order) return null;

  // Cálculos de conciliación
  const itemsSum = (order.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);
  const contractedKg = itemsSum > 0 ? itemsSum : (Number(order.totalKilograms) || 0);

  const deliveredKg = (order.deliveries || []).reduce((acc, d) => acc + (Number(d.kilos) || 0), 0);
  const invoicedKg = (order.invoices || []).reduce((acc, i) => acc + (Number(i.kilos) || 0), 0);

  const diffKg = contractedKg - deliveredKg;
  const shortfallKg = diffKg > 0.01 ? Number(diffKg.toFixed(2)) : 0;
  const surplusKg = diffKg < -0.01 ? Number(Math.abs(diffKg).toFixed(2)) : 0;

  const fulfillmentRate = contractedKg > 0 ? Number(((deliveredKg / contractedKg) * 100).toFixed(2)) : 100;

  const costPrice = order.customCostPrice || 38.00;
  const salePrice = order.customSellPrice || 43.00;

  const shortfallCostValue = Number((shortfallKg * costPrice).toFixed(2));
  const shortfallSaleValue = Number((shortfallKg * salePrice).toFixed(2));

  // Sugerir estatus y motivo por defecto
  const defaultReasonId = shortfallKg <= 0.05
    ? 'cumplimiento_completo'
    : (shortfallKg / (contractedKg || 1)) <= 0.02
    ? 'merma_tolerable'
    : 'finiquito_proveedor';

  const [selectedReasonId, setSelectedReasonId] = useState<string>(
    order.closureAudit?.closureReason || defaultReasonId
  );
  const [notes, setNotes] = useState<string>(order.closureAudit?.closureNotes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedReasonObj = CLOSURE_REASONS.find(r => r.id === selectedReasonId) || CLOSURE_REASONS[2];

  const handleSaveClosure = async (reopen = false) => {
    setIsSubmitting(true);
    triggerHaptic(reopen ? 'warning' : 'success');

    try {
      const orderRef = doc(db, PATHS.orders, order.id);

      if (reopen) {
        await updateDoc(orderRef, {
          isClosedShort: false,
          closureAudit: deleteField(),
          updatedAt: serverTimestamp(),
        });
        toast(`🔓 OC ${order.folio || order.oc} reabierta exitosamente.`, 'ok');
      } else {
        const closureData: OcClosureAudit = {
          closedAt: Timestamp.now(),
          closedBy: user?.email || user?.displayName || 'Administrador',
          contractedKg: contractedKg || 0,
          deliveredKg: deliveredKg || 0,
          invoicedKg: invoicedKg || 0,
          shortfallKg: shortfallKg || 0,
          surplusKg: surplusKg || 0,
          fulfillmentRate: fulfillmentRate || 0,
          shortfallCostValue: shortfallCostValue || 0,
          shortfallSaleValue: shortfallSaleValue || 0,
          closureStatus: surplusKg > 0 ? 'con_excedente' : selectedReasonObj.status,
          closureReason: selectedReasonObj.label || 'Finiquito de orden',
          closureNotes: notes.trim() || '',
        };

        await updateDoc(orderRef, {
          isClosedShort: true,
          closureAudit: closureData,
          updatedAt: serverTimestamp(),
        });

        toast(`🏁 OC ${order.folio || order.oc} concluida y auditada con éxito.`, 'ok');
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast(`Error al guardar cierre de OC: ${err.message}`, 'bad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAlreadyClosed = order.isClosedShort;

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '16px',
        }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          style={{
            background: 'linear-gradient(180deg, #18181b 0%, #09090b 100%)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '680px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.1)',
            color: '#f4f4f5',
            overflow: 'hidden',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '1.2rem' }}>🏁</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#fafafa' }}>
                  {isAlreadyClosed ? 'Certificado de Cierre de OC' : 'Auditoría y Cierre Definitivo de OC'}
                </h3>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#a1a1aa' }}>
                OC: <strong style={{ color: '#38bdf8' }}>{order.folio || order.oc}</strong> · {order.client || 'Cliente General'} {order.department ? `(${order.department})` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
            {/* Tarjetas de Conciliación de Kilos */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#a1a1aa', fontWeight: 700, textTransform: 'uppercase' }}>
                  📋 Contratado
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#f4f4f5', marginTop: 4 }}>
                  {kilos(contractedKg)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#71717a' }}>Orden de Compra</div>
              </div>

              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 700, textTransform: 'uppercase' }}>
                  🚚 Entregado
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                  {kilos(deliveredKg)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6ee7b7' }}>Recepción Báscula</div>
              </div>

              <div
                style={{
                  background: 'rgba(99, 102, 241, 0.06)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  🧾 Facturado
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#6366f1', marginTop: 4 }}>
                  {kilos(invoicedKg)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#a5b4fc' }}>CFDI Emitidos</div>
              </div>

              <div
                style={{
                  background: shortfallKg > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(56, 189, 248, 0.08)',
                  border: `1px solid ${shortfallKg > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'}`,
                  borderRadius: '10px',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: shortfallKg > 0 ? '#f87171' : '#38bdf8', fontWeight: 700, textTransform: 'uppercase' }}>
                  {shortfallKg > 0 ? '⏳ Faltante' : surplusKg > 0 ? '📦 Excedente' : '⚖️ Saldo'}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: shortfallKg > 0 ? '#ef4444' : '#38bdf8', marginTop: 4 }}>
                  {shortfallKg > 0 ? kilos(shortfallKg) : surplusKg > 0 ? `+${kilos(surplusKg)}` : '0 kg'}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#a1a1aa' }}>
                  {fulfillmentRate}% cumplido
                </div>
              </div>
            </div>

            {/* Banner de Diagnóstico del Balance */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                background: shortfallKg === 0
                  ? 'rgba(16, 185, 129, 0.1)'
                  : shortfallKg <= (contractedKg * 0.02)
                  ? 'rgba(59, 130, 246, 0.1)'
                  : 'rgba(245, 158, 11, 0.12)',
                border: `1px solid ${
                  shortfallKg === 0
                    ? 'rgba(16, 185, 129, 0.3)'
                    : shortfallKg <= (contractedKg * 0.02)
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(245, 158, 11, 0.35)'
                }`,
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>
                {shortfallKg === 0 ? '🎯' : shortfallKg <= (contractedKg * 0.02) ? '🟢' : '⚠️'}
              </span>
              <div style={{ fontSize: '0.85rem', lineHeight: 1.45 }}>
                <strong style={{ color: '#fafafa', display: 'block', marginBottom: 2 }}>
                  {shortfallKg === 0
                    ? 'Entrega 100% Completa'
                    : shortfallKg <= (contractedKg * 0.02)
                    ? `Tolerancia Normal de Báscula (${shortfallKg.toLocaleString('es-MX')} kg faltantes · ${(100 - fulfillmentRate).toFixed(2)}% de merma)`
                    : `Faltante de ${shortfallKg.toLocaleString('es-MX')} kg no entregados`}
                </strong>
                <span style={{ color: '#d4d4d8' }}>
                  {shortfallKg > 0 ? (
                    <>
                      Equivale a <strong>{money(shortfallCostValue)} MXN</strong> de maquila con Andrés ($38.00/kg) y{' '}
                      <strong>{money(shortfallSaleValue)} MXN</strong> de venta con Providencia ($43.00/kg).
                    </>
                  ) : (
                    'Todos los kilos solicitados en la orden fueron entregados y recibidos en planta.'
                  )}
                </span>
              </div>
            </div>

            {/* Motivo de Cierre */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#e4e4e7', marginBottom: 8 }}>
                Motivo / Justificación del Cierre:
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CLOSURE_REASONS.map((r) => {
                  const isChecked = selectedReasonId === r.id;
                  return (
                    <label
                      key={r.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: isChecked ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                        border: `1px solid ${isChecked ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        color: isChecked ? '#38bdf8' : '#d4d4d8',
                        fontWeight: isChecked ? 700 : 500,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <input
                        type="radio"
                        name="closure_reason"
                        value={r.id}
                        checked={isChecked}
                        onChange={() => setSelectedReasonId(r.id)}
                        style={{ accentColor: '#38bdf8' }}
                      />
                      <span>{r.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Notas Adicionales */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#e4e4e7', marginBottom: 6 }}>
                Notas de Finiquito / Observaciones (Opcional):
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Ej. Se acuerda con el comprador Lic. Nava finiquito de orden con 4 facturas. Andrés no suministrará más bobinas."
                style={{
                  width: '100%',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  color: '#f4f4f5',
                  padding: '10px 12px',
                  fontSize: '0.85rem',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Metadatos si ya estaba cerrada */}
            {order.closureAudit && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.78rem',
                  color: '#a1a1aa',
                  marginBottom: '16px',
                }}
              >
                Cerrada previamente por: <strong>{order.closureAudit.closedBy || 'Usuario'}</strong>
                {order.closureAudit.closedAt && (
                  <> el {order.closureAudit.closedAt.toDate ? order.closureAudit.closedAt.toDate().toLocaleDateString('es-MX') : 'recientemente'}</>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)',
              gap: 12,
            }}
          >
            {isAlreadyClosed ? (
              <button
                type="button"
                onClick={() => handleSaveClosure(true)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  minHeight: '44px',
                }}
              >
                🔓 Reabrir OC (Anular Cierre)
              </button>
            ) : (
              <div />
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  background: 'transparent',
                  color: '#d4d4d8',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  minHeight: '44px',
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => handleSaveClosure(false)}
                disabled={isSubmitting}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(5, 150, 105, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  minHeight: '44px',
                }}
              >
                <span>🏁</span>
                <span>{isSubmitting ? 'Guardando...' : 'Sellar y Concluir OC'}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
