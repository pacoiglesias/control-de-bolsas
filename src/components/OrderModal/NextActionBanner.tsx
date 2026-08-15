import { useMemo } from 'react';
import { getSuggestedNextAction } from '../../lib/finance';
import type { PurchaseOrder, FinancialConfig } from '../../lib/types';

interface NextActionBannerProps {
  order: PurchaseOrder;
  config: FinancialConfig;
  onNavigateTab: (tab: string) => void;
}

export function NextActionBanner({ order, config, onNavigateTab }: NextActionBannerProps) {
  const nextAction = useMemo(() => getSuggestedNextAction(order, config), [order, config]);

  if (nextAction.key === 'completada') return null;

  const bgTone = {
    info: 'rgba(59,130,246,0.08)',
    warn: 'rgba(245,158,11,0.1)',
    bad: 'rgba(239,68,68,0.1)',
    ok: 'rgba(16,185,129,0.1)',
  }[nextAction.badgeTone];

  const borderTone = {
    info: '#3b82f6',
    warn: '#f59e0b',
    bad: '#ef4444',
    ok: '#10b981',
  }[nextAction.badgeTone];

  const textTone = {
    info: '#1d4ed8',
    warn: '#b45309',
    bad: '#b91c1c',
    ok: '#047857',
  }[nextAction.badgeTone];

  const iconTone = {
    pedir_andres: '🏭',
    esperar_entrega: '⏳',
    facturar_entrega: '⚡',
    pedir_contrarecibo: '📝',
    avisar_contador: '⚠️',
    recibir_caja: '💵',
    completada: '✅',
  }[nextAction.key] || '👉';

  function handleSendWhatsApp() {
    if (!nextAction.whatsappText) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(nextAction.whatsappText)}`, '_blank');
  }

  return (
    <div
      style={{
        background: bgTone,
        border: `1px solid ${borderTone}`,
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
        <span style={{ fontSize: 24 }}>{iconTone}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: textTone }}>
            Siguiente Acción Sugerida: {nextAction.title}
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
            title="Enviar mensaje rápido por WhatsApp"
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
  );
}
