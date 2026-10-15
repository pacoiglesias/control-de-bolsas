import { buildReceivables } from '../../lib/receivables';
import { useConfig } from '../../hooks/useConfig';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrders } from '../../hooks/useOrders';
import { useExpenses } from '../../hooks/useExpenses';
import { usePrivacy } from '../../context/PrivacyContext';
import { money } from '../../lib/format';
import { getOrderSummary, round2 } from '../../lib/finance';
import { sound } from '../../lib/sounds';
import { triggerHaptic } from '../../lib/hapticEngine';

export function SidebarLiveStatus() {
  const { orders } = useOrders();
  const { config } = useConfig();
  const { expenses } = useExpenses();
  const { isPrivate } = usePrivacy();
  const navigate = useNavigate();

  // Métricas en tiempo real de la operación
  const metrics = useMemo(() => {
    let activeOcsCount = 0;
    let totalKilosPedidos = 0;
    let totalKilosEntregados = 0;



    for (const o of orders) {
      if (o.isDeleted) continue;
      const summary = getOrderSummary(o);
      const isCompleted = summary.status === 'completed' || summary.status === 'paid' || summary.status === 'collected';
      
      if (!isCompleted && !o.isClosedShort) {
        activeOcsCount++;
        const pedidos = Number(o.totalKilograms) || Number(summary.kilosDelivered) || 0;
        const entregados = Number(summary.kilosDelivered) || 0;
        totalKilosPedidos += pedidos;
        totalKilosEntregados += entregados;
      }

    }
    const receivables = buildReceivables(orders, config);
    const carteraTotal = receivables.total;
    const carteraVencida = receivables.overdue;

    const saldoCaja = round2(
      (expenses || []).reduce((acc, e) => {
        return acc + (e.type === 'ingreso' ? Number(e.amount) || 0 : -(Number(e.amount) || 0));
      }, 0)
    );

    const kilosFaltantes = Math.max(0, totalKilosPedidos - totalKilosEntregados);
    const avanceEntregaPct = totalKilosPedidos > 0 
      ? Math.min(100, Math.round((totalKilosEntregados / totalKilosPedidos) * 100))
      : 100;

    return {
      activeOcsCount,
      totalKilosPedidos,
      totalKilosEntregados,
      kilosFaltantes,
      avanceEntregaPct,
      carteraTotal: round2(carteraTotal),
      carteraVencida: round2(carteraVencida),
      saldoCaja,
    };
  }, [orders, expenses, config]);

  return <div className="sidebar-balance">
    <span>FACTURADO POR COBRAR</span>
    <button type="button" onClick={() => navigate('/cobranza')}>{isPrivate ? '••••••' : money(metrics.carteraTotal)} <span aria-hidden="true">↗</span></button>
    <small>{metrics.activeOcsCount} órdenes activas · {metrics.kilosFaltantes.toLocaleString('es-MX')} kg por entregar</small>
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

