import React from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { getOrderSummary } from '../../lib/finance';
import { money, kilos as fmtKilos } from '../../lib/format';

interface OrderLifecycleStepperProps {
  order: PurchaseOrder;
  onStepClick?: (stepIndex: number) => void;
}

export function OrderLifecycleStepper({ order, onStepClick }: OrderLifecycleStepperProps) {
  const summary = getOrderSummary(order);
  const totalKilos = Number(order.totalKilograms) || (order.items || []).reduce((a, b) => a + (Number(b.quantity) || 0), 0);
  
  const hasDeliveries = summary.kilosDelivered > 0;
  const isDeliveriesComplete = summary.kilosDelivered >= totalKilos - 0.01;
  
  const hasInvoices = summary.kilosInvoiced > 0;
  const isInvoicesComplete = summary.kilosInvoiced >= summary.kilosDelivered - 0.01 && hasDeliveries;
  
  const hasContrarecibo = (order.invoices || []).some(i => (i.collection?.contrareciboNumber || '').trim().length > 0) || !!order.collection?.contrareciboNumber;
  const isPaid = order.creditCycle?.status === 'paid' || order.creditCycle?.status === 'collected';

  const steps = [
    {
      label: 'Orden Emitida',
      detail: `${fmtKilos(totalKilos)}`,
      status: 'completed',
      icon: '📋',
    },
    {
      label: 'Báscula (Patio)',
      detail: `${fmtKilos(summary.kilosDelivered)}`,
      status: isDeliveriesComplete ? 'completed' : hasDeliveries ? 'current' : 'pending',
      icon: '⚖️',
    },
    {
      label: 'Factura SAT',
      detail: `${fmtKilos(summary.kilosInvoiced)}`,
      status: isInvoicesComplete ? 'completed' : hasInvoices ? 'current' : 'pending',
      icon: '🧾',
    },
    {
      label: 'Contrarecibo',
      detail: hasContrarecibo ? (order.collection?.contrareciboNumber || 'Con CR') : 'Sin CR',
      status: hasContrarecibo ? 'completed' : isInvoicesComplete ? 'current' : 'pending',
      icon: '📑',
    },
    {
      label: 'Cobro Liquidado',
      detail: isPaid ? money(summary.paidAmount || summary.invoiceTotal) : money(Math.max(0, summary.invoiceTotal - summary.paidAmount)),
      status: isPaid ? 'completed' : 'pending',
      icon: '💰',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '12px 16px',
        background: 'var(--paper)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line-soft)',
        overflowX: 'auto',
        gap: 8,
      }}
    >
      {steps.map((step, idx) => {
        const isCompleted = step.status === 'completed';
        const isCurrent = step.status === 'current';

        const stepColor = isCompleted
          ? 'var(--ok)'
          : isCurrent
          ? 'var(--accent)'
          : 'var(--ink-faint)';

        const stepBg = isCompleted
          ? 'var(--ok-bg)'
          : isCurrent
          ? 'var(--accent-tint)'
          : 'var(--paper-sunk)';

        return (
          <React.Fragment key={step.label}>
            <div
              onClick={() => onStepClick && onStepClick(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: onStepClick ? 'pointer' : 'default',
                minWidth: 130,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: stepBg,
                  border: `2px solid ${stepColor}`,
                  color: stepColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  fontWeight: 800,
                  flexShrink: 0,
                  boxShadow: isCurrent ? '0 0 10px rgba(217, 119, 6, 0.4)' : 'none',
                }}
              >
                {isCompleted ? '✓' : step.icon}
              </div>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>
                  {step.label}
                </div>
                <div style={{ fontSize: 10.5, color: stepColor, fontWeight: 700 }}>
                  {step.detail}
                </div>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background: isCompleted ? 'var(--ok)' : 'var(--line-soft)',
                  minWidth: 16,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
