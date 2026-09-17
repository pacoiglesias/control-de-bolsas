import { motion } from 'framer-motion';
import { Modal } from '../ui';
import type { OperationDecision, SuggestedAction } from '../../lib/autoDocumentProcessor';
import { kilos } from '../../lib/format';

interface OperationDoubtModalProps {
  decision: OperationDecision & { type: 'doubt' };
  onResolve: (action: SuggestedAction) => void;
  onClose: () => void;
}

export function OperationDoubtModal({ decision, onResolve, onClose }: OperationDoubtModalProps) {
  return (
    <Modal title={decision.title} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 540 }}>
        {/* Cabecera con Icono y Pregunta */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(234, 179, 8, 0.15)',
              color: '#eab308',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
              border: '1px solid rgba(234, 179, 8, 0.3)',
            }}
          >
            ❓
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, lineHeight: 1.4 }}>
              {decision.question}
            </div>
            {decision.details && (
              <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                {decision.details}
              </div>
            )}
          </div>
        </div>

        {/* Resumen del Expediente Target si existe */}
        {decision.targetOrder && (
          <div
            style={{
              background: 'var(--paper-sunk)',
              padding: '12px 16px',
              borderRadius: 10,
              border: '1px solid var(--line-soft)',
              fontSize: 13,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                OC {decision.targetOrder.folio || decision.targetOrder.oc}
              </span>
              <span style={{ color: 'var(--ink-soft)', marginLeft: 8 }}>
                {decision.targetOrder.client || 'Cliente'}
              </span>
            </div>
            <div style={{ fontWeight: 800 }}>
              {kilos(decision.targetOrder.totalKilograms || 0)}
            </div>
          </div>
        )}

        {/* Opciones de Resolución (Botones Proactivos de 1 Clic) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-muted)' }}>
            Selecciona cómo deseas resolver esta operación:
          </div>

          {decision.suggestedActions.map((action) => {
            const isPrimary = action.variant === 'primary';
            const isDanger = action.variant === 'danger';

            return (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="button"
                onClick={() => onResolve(action)}
                style={{
                  textAlign: 'left',
                  padding: '12px 16px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: isPrimary
                    ? 'var(--accent)'
                    : isDanger
                    ? 'rgba(239, 68, 68, 0.12)'
                    : 'var(--paper-sunk)',
                  color: isPrimary
                    ? '#fff'
                    : isDanger
                    ? 'var(--bad)'
                    : 'var(--ink)',
                  border: isPrimary
                    ? 'none'
                    : isDanger
                    ? '1px solid var(--bad)'
                    : '1px solid var(--line)',
                  boxShadow: isPrimary ? '0 4px 12px rgba(99, 102, 241, 0.25)' : 'none',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>
                    {action.label}
                  </div>
                  {action.description && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: isPrimary ? 0.9 : 0.75,
                        marginTop: 2,
                      }}
                    >
                      {action.description}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 16, opacity: 0.8, marginLeft: 12 }}>
                  →
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
