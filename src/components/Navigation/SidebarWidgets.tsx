import { buildReceivables } from '../../lib/receivables';
import { useConfig } from '../../hooks/useConfig';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { usePrivacy } from '../../context/PrivacyContext';
import { money } from '../../lib/format';
import { round2 } from '../../lib/finance';
import { summarizeProduction } from '../../lib/productionTracking';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';

export function SidebarLiveStatus() {
  const { orders } = useOrders();
  const { config } = useConfig();
  const { isPrivate } = usePrivacy();
  const navigate = useNavigate();

  // Métricas en tiempo real de la operación
  const metrics = useMemo(() => {
    const production = summarizeProduction(orders);
    const receivables = buildReceivables(orders, config);
    const carteraTotal = receivables.total;
    const carteraVencida = receivables.overdue;

    return {
      activeOcsCount: production.count,
      kilosFaltantes: production.remaining,
      carteraTotal: round2(carteraTotal),
      carteraVencida: round2(carteraVencida),
    };
  }, [orders, config]);

  return <div className="sidebar-balance">
    <span>FACTURADO POR COBRAR</span>
    <button type="button" onClick={() => navigate('/cobranza')}>{isPrivate ? '••••••' : money(metrics.carteraTotal)} <span aria-hidden="true">↗</span></button>
    <small>{metrics.activeOcsCount} órdenes de producción · {metrics.kilosFaltantes.toLocaleString('es-MX')} kg por entregar o comprobar</small>
  </div>;
}

export function SidebarFastActions() {
  const handleAction = (eventName: string, detail?: any) => {
    triggerHaptic('medium');
    sound.playPop();
    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  const quickActions = [
    { id: 'deliv', label: 'Báscula', icon: '⚖️', color: '#3b82f6', event: 'open-fast-delivery', title: 'Captura rápida de entrega / báscula' },
    { id: 'inv', label: 'Factura', icon: '🧾', color: '#10b981', event: 'open-fast-invoice', title: 'Captura rápida de factura CFDI' },
    { id: 'up', label: 'Subir', icon: '⚡', color: '#8b5cf6', event: 'open-fast-upload', title: 'Auto-captura inteligente PDF/XML' },
    { id: 'calc', label: 'Kilos', icon: '🧮', color: '#f59e0b', event: 'open-kilo-calculator', title: 'Calculadora de kilos y comisiones' },
  ];

  return (
    <div style={{ margin: '4px 4px 10px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
        {quickActions.map((act) => (
          <button
            key={act.id}
            type="button"
            onClick={() => handleAction(act.event)}
            title={act.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '6px 2px',
              borderRadius: 8,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              color: '#cbd5e1',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = act.color;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            <span style={{ fontSize: 13 }}>{act.icon}</span>
            <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '-0.2px' }}>{act.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

