import React from 'react';
import type { PurchaseOrder } from '../../lib/types';

interface OrderStepperProps {
  order: PurchaseOrder;
  compact?: boolean;
  style?: React.CSSProperties;
}

export const OrderStepper: React.FC<OrderStepperProps> = ({
  order,
  compact = false,
  style = {},
}) => {
  const totalKilos = order.totalKilograms || 0;
  const deliveredKilos = (order.deliveries || []).reduce((acc: number, d: any) => acc + (Number(d?.kilograms) || 0), 0);
  const deliveryPercent = totalKilos > 0 ? Math.min(100, Math.round((deliveredKilos / totalKilos) * 100)) : 0;

  const hasDeliveries = deliveredKilos > 0;
  const isFullyDelivered = deliveryPercent >= 99;

  const hasContrarecibo = (order.invoices || []).some(
    (inv: any) => !!inv.collection?.contrareciboNumber || inv.creditCycle?.status === 'in_review' || inv.creditCycle?.status === 'pending'
  );

  const isCollected = (order.invoices || []).length > 0 && (order.invoices || []).every(
    (inv: any) => inv.creditCycle?.status === 'paid'
  );

  // Steps definition
  const steps = [
    {
      id: 'created',
      label: '1. OC',
      sublabel: `Folio ${order.folio || 'S/F'}`,
      completed: true,
      active: !hasDeliveries,
      color: '#60a5fa',
    },
    {
      id: 'maquila',
      label: '2. Maquila',
      sublabel: `${deliveryPercent}% prod.`,
      completed: hasDeliveries,
      active: hasDeliveries && !isFullyDelivered,
      color: '#a78bfa',
    },
    {
      id: 'deliveries',
      label: '3. Entrega',
      sublabel: `${deliveredKilos.toLocaleString('es-MX')} / ${totalKilos.toLocaleString('es-MX')} kg`,
      completed: isFullyDelivered,
      active: isFullyDelivered && !hasContrarecibo,
      color: '#34d399',
    },
    {
      id: 'cr',
      label: '4. Contrarecibo',
      sublabel: hasContrarecibo ? 'Emitido' : 'Pendiente',
      completed: hasContrarecibo,
      active: hasContrarecibo && !isCollected,
      color: '#fbbf24',
    },
    {
      id: 'paid',
      label: '5. Cobro',
      sublabel: isCollected ? 'Cobrada' : 'En Crédito',
      completed: isCollected,
      active: isCollected,
      color: '#10b981',
    },
  ];

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: 'rgba(255, 255, 255, 0.04)',
          padding: '4px 8px',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          width: 'fit-content',
          ...style,
        }}
      >
        {steps.map((s, idx) => (
          <React.Fragment key={s.id}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: s.completed ? s.color : 'rgba(255, 255, 255, 0.2)',
                boxShadow: s.active ? `0 0 6px ${s.color}` : 'none',
              }}
              title={`${s.label}: ${s.sublabel}`}
            />
            {idx < steps.length - 1 && (
              <span
                style={{
                  width: 8,
                  height: 1.5,
                  background: s.completed ? s.color : 'rgba(255, 255, 255, 0.12)',
                }}
              />
            )}
          </React.Fragment>
        ))}
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginLeft: 4, fontWeight: 700 }}>
          {isCollected ? '✅ Cobrada' : hasContrarecibo ? '📄 Con CR' : `${deliveryPercent}% Entregado`}
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(15, 23, 42, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: '12px 16px',
        width: '100%',
        boxSizing: 'border-box',
        overflowX: 'auto',
        gap: 8,
        ...style,
      }}
    >
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              minWidth: 70,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: step.completed
                  ? step.color
                  : 'rgba(255, 255, 255, 0.08)',
                color: step.completed ? '#0f172a' : 'rgba(255,255,255,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 900,
                boxShadow: step.active ? `0 0 10px ${step.color}` : 'none',
                border: step.active ? `2px solid #fff` : 'none',
                transition: 'all 0.3s ease',
              }}
            >
              {step.completed ? '✓' : index + 1}
            </div>
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: step.completed ? '#fff' : 'rgba(255,255,255,0.4)',
                marginTop: 4,
              }}
            >
              {step.label}
            </span>
            <span
              style={{
                fontSize: 9,
                color: step.completed ? step.color : 'rgba(255,255,255,0.3)',
                fontWeight: 600,
              }}
            >
              {step.sublabel}
            </span>
          </div>

          {index < steps.length - 1 && (
            <div
              style={{
                flex: 1,
                height: 2,
                background: step.completed
                  ? `linear-gradient(90deg, ${step.color}, ${steps[index + 1].completed ? steps[index + 1].color : 'rgba(255,255,255,0.1)'})`
                  : 'rgba(255, 255, 255, 0.08)',
                minWidth: 16,
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
