import { useMemo } from 'react';
import { getSuggestedNextAction } from '../../lib/finance';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';

interface NextActionBannerProps {
  order: PurchaseOrder;
  config: FinancialConfig;
  onNavigateTab: (tab: string) => void;
}

type StepKey = 'pedir_andres' | 'esperar_entrega' | 'facturar_entrega' | 'pedir_contrarecibo' | 'avisar_contador' | 'recibir_caja' | 'completada';

interface FlowStep {
  key: StepKey;
  label: string;
  icon: string;
  tab: string;
}

const FLOW_STEPS: FlowStep[] = [
  { key: 'pedir_andres',      label: 'Pedir a Andrés',   icon: '🏭', tab: 'andres'    },
  { key: 'esperar_entrega',   label: 'Producción',        icon: '⚙️', tab: 'entregas'  },
  { key: 'facturar_entrega',  label: 'Facturar',          icon: '🧾', tab: 'facturas'  },
  { key: 'pedir_contrarecibo',label: 'Contrarecibo',      icon: '📝', tab: 'facturas'  },
  { key: 'avisar_contador',   label: 'Cobrar',            icon: '💵', tab: 'facturas'  },
  { key: 'completada',        label: 'Completado',        icon: '✅', tab: 'resumen'   },
];

// Maps each nextAction key to which step index is "active"
const STEP_INDEX: Record<StepKey, number> = {
  pedir_andres:       0,
  esperar_entrega:    1,
  facturar_entrega:   2,
  pedir_contrarecibo: 3,
  avisar_contador:    4,
  recibir_caja:       4,
  completada:         5,
};

const TONE_COLORS = {
  info: { bg: 'rgba(59,130,246,0.1)',   border: '#3b82f6', text: '#1d4ed8' },
  warn: { bg: 'rgba(245,158,11,0.1)',   border: '#f59e0b', text: '#b45309' },
  bad:  { bg: 'rgba(239,68,68,0.1)',    border: '#ef4444', text: '#b91c1c' },
  ok:   { bg: 'rgba(16,185,129,0.1)',   border: '#10b981', text: '#047857' },
};

export function NextActionBanner({ order, config, onNavigateTab }: NextActionBannerProps) {
  const nextAction = useMemo(() => getSuggestedNextAction(order, config), [order, config]);

  const activeIdx = STEP_INDEX[nextAction.key] ?? 0;
  const tone = TONE_COLORS[nextAction.badgeTone] ?? TONE_COLORS.info;

  function handleSendWhatsApp() {
    if (!nextAction.whatsappText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(nextAction.whatsappText)}`, '_blank');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Pipeline visual de 6 pasos ── */}
      <div style={{
        background: 'var(--paper-sunk)',
        border: '1px solid var(--line)',
        borderRadius: 14,
        padding: '12px 16px',
        overflowX: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          minWidth: 420,
        }}>
          {FLOW_STEPS.map((step, idx) => {
            const isDone   = idx < activeIdx;
            const isActive = idx === activeIdx;
            const isFuture = idx > activeIdx;

            const stepColor = isDone ? '#10b981' : isActive ? '#2563eb' : 'var(--ink-faint)';
            const stepBg    = isDone
              ? 'rgba(16,185,129,0.12)'
              : isActive
              ? 'rgba(37,99,235,0.12)'
              : 'var(--paper)';
            const stepBorder = isDone
              ? '#10b981'
              : isActive
              ? '#2563eb'
              : 'var(--line)';

            return (
              <div key={step.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                {/* Step node */}
                <div
                  onClick={() => !isFuture && onNavigateTab(step.tab)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    cursor: isFuture ? 'default' : 'pointer',
                    flex: 1,
                    minWidth: 0,
                    padding: '6px 4px',
                    borderRadius: 10,
                    background: isActive ? stepBg : 'transparent',
                    border: isActive ? `1px solid ${stepBorder}` : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                  title={isFuture ? step.label : `Ir a ${step.label}`}
                >
                  {/* Círculo con ícono */}
                  <div style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: stepBg,
                    border: `2px solid ${stepBorder}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: isDone ? 900 : 700,
                    color: stepColor,
                    flexShrink: 0,
                    transition: 'all 0.2s',
                  }}>
                    {isDone ? '✓' : step.icon}
                  </div>
                  {/* Label */}
                  <div style={{
                    fontSize: 10,
                    fontWeight: isActive ? 800 : isDone ? 700 : 500,
                    color: isActive ? '#1d4ed8' : isDone ? '#047857' : 'var(--ink-soft)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                    maxWidth: 64,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {step.label}
                  </div>
                </div>

                {/* Conector entre pasos (no mostrar después del último) */}
                {idx < FLOW_STEPS.length - 1 && (
                  <div style={{
                    height: 2,
                    width: 18,
                    flexShrink: 0,
                    background: idx < activeIdx ? '#10b981' : 'var(--line)',
                    borderRadius: 1,
                    transition: 'background 0.3s',
                  }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Banner de siguiente acción (solo si no está completada) ── */}
      {nextAction.key !== 'completada' && (
        <div style={{
          background: tone.bg,
          border: `1px solid ${tone.border}`,
          borderRadius: 10,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: 20 }}>
              {FLOW_STEPS[activeIdx]?.icon ?? '👉'}
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: tone.text }}>
                Siguiente: {nextAction.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 2 }}>
                {nextAction.description}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {nextAction.whatsappText && (
              <button
                type="button"
                className="btn"
                style={{
                  fontSize: 11,
                  padding: '5px 10px',
                  borderColor: '#25D366',
                  color: '#128C7E',
                  background: 'rgba(37,211,102,0.1)',
                }}
                onClick={handleSendWhatsApp}
              >
                💬 WhatsApp
              </button>
            )}
            {nextAction.actionLabel && nextAction.targetTab && (
              <button
                type="button"
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '5px 12px' }}
                onClick={() => onNavigateTab(nextAction.targetTab!)}
              >
                {nextAction.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Completada */}
      {nextAction.key === 'completada' && (
        <div style={{
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid #10b981',
          borderRadius: 10,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          fontWeight: 700,
          color: '#047857',
        }}>
          ✅ Esta orden fue entregada, facturada y cobrada al 100%.
        </div>
      )}
    </div>
  );
}
