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
  const { expenses } = useExpenses();
  const { isPrivate } = usePrivacy();
  const navigate = useNavigate();

  // Métricas en tiempo real de la operación
  const metrics = useMemo(() => {
    let activeOcsCount = 0;
    let totalKilosPedidos = 0;
    let totalKilosEntregados = 0;
    let carteraTotal = 0;
    let carteraVencida = 0;

    for (const o of orders) {
      const summary = getOrderSummary(o);
      const isCompleted = summary.status === 'completed' || summary.status === 'paid' || summary.status === 'collected';
      
      if (!isCompleted && !o.isClosedShort) {
        activeOcsCount++;
        const pedidos = Number(o.totalKilograms) || Number(summary.kilosDelivered) || 0;
        const entregados = Number(summary.kilosDelivered) || 0;
        totalKilosPedidos += pedidos;
        totalKilosEntregados += entregados;
      }

      // Sumar cartera de facturas pendientes de cobro
      for (const inv of summary.invoices || []) {
        const st = inv.creditCycle?.status;
        if (st === 'pending' || st === 'in_review' || st === 'overdue' || st === 'manual_review') {
          const amt = inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0;
          carteraTotal += amt;
          if (st === 'overdue') carteraVencida += amt;
        }
      }
    }

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
  }, [orders, expenses]);

  return (
    <div
      style={{
        margin: '0 4px 12px',
        padding: '12px 10px',
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 14,
        backdropFilter: 'blur(10px)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8' }}>
          Estado en Vivo
        </span>
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#34d399',
            padding: '2px 6px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 4px #10b981' }} />
          Online
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {/* Pod 1: OCs Activas & Kilos por Entregar */}
        <div
          onClick={() => {
            sound.playSwoosh();
            navigate('/oc');
          }}
          title="Ver Seguimiento por OC: Kilos entregados vs pendientes"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
            e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Por Entregar</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#60a5fa', marginTop: 2 }}>
            {isPrivate ? '•••• kg' : `${metrics.kilosFaltantes.toLocaleString('es-MX')} kg`}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
            {metrics.activeOcsCount} OCs activas
          </div>
        </div>

        {/* Pod 2: Saldo en Caja Chica */}
        <div
          onClick={() => {
            sound.playSwoosh();
            navigate('/caja-chica');
          }}
          title="Ver Efectivo en Caja Chica"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: 10,
            padding: '8px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.4)';
            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
          }}
        >
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Caja Chica</div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 900,
              color: metrics.saldoCaja >= 0 ? '#34d399' : '#f87171',
              marginTop: 2,
            }}
          >
            {isPrivate ? '••••••' : money(metrics.saldoCaja)}
          </div>
          <div style={{ fontSize: 9, color: '#64748b', marginTop: 2 }}>
            Disponible
          </div>
        </div>
      </div>

      {/* Pod 3: Cartera Total por Cobrar */}
      <div
        onClick={() => {
          sound.playSwoosh();
          navigate('/cobranza');
        }}
        title="Ver Cartera y Facturas Providencia en Cobranza"
        style={{
          marginTop: 6,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: 10,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
          e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }}
      >
        <div>
          <div style={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>Cartera x Cobrar</div>
          <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', marginTop: 1 }}>
            {isPrivate ? '••••••••' : money(metrics.carteraTotal)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {metrics.carteraVencida > 0 ? (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                padding: '2px 5px',
                borderRadius: 6,
              }}
            >
              ⚠️ {money(metrics.carteraVencida)} vda
            </span>
          ) : (
            <span style={{ fontSize: 9, color: '#10b981', fontWeight: 700 }}>
              ✓ Al corriente
            </span>
          )}
        </div>
      </div>
    </div>
  );
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

