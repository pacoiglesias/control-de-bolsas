import React from 'react';
import { extractCr } from '../../lib/finance';
import { kilos, money } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';

interface OrderLifecycleSemaphoreProps {
  order: PurchaseOrder;
  summary?: any;
  compact?: boolean;
  style?: React.CSSProperties;
}

export interface LifecycleStepInfo {
  id: 'oc' | 'bascula' | 'factura' | 'cr' | 'cobro';
  number: number;
  label: string;
  shortLabel: string;
  icon: string;
  status: 'done' | 'active' | 'warn' | 'pending';
  detail: string;
  badgeText?: string;
}

export function computeOrderLifecycle(order: PurchaseOrder, _summaryProp?: any): LifecycleStepInfo[] {
  const itemsSum = (order.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 0), 0);
  const totalKg = itemsSum > 0 ? itemsSum : (Number(order.totalKilograms) || 0);

  const deliveries = order.deliveries || [];
  const deliveredKg = deliveries.reduce((acc: number, d: any) => acc + (Number(d?.kilograms) || 0), 0);

  const invoices = order.invoices || [];
  const invoicedKg = invoices.reduce((acc: number, i: any) => acc + (Number(i?.kilos) || 0), 0);
  const totalInvoicedMoney = invoices.reduce((acc: number, i: any) => acc + (Number(i?.financials?.invoiceTotal || i?.financials?.saleTotal || 0)), 0);
  const paidMoney = invoices.reduce((acc: number, i: any) => acc + (Number(i?.collection?.paidAmount || 0)), 0);

  const hasDeliveries = deliveredKg > 0;
  const isSurtidoFull = totalKg > 0 && deliveredKg >= totalKg;

  const hasInvoices = invoices.length > 0 || invoicedKg > 0;
  const isInvoiceFull = hasInvoices && (totalKg > 0 ? invoicedKg >= totalKg : invoicedKg >= deliveredKg && deliveredKg > 0);

  const crInvoices = invoices.filter(inv => !!extractCr(inv, order));
  const hasCr = crInvoices.length > 0;
  const hasSinCr = hasInvoices && invoices.some(inv => {
    const cr = extractCr(inv, order);
    const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
    return !cr && !isPaid;
  });
  const isCrFull = hasInvoices && !hasSinCr;

  const isCollectedFull = (hasInvoices && totalInvoicedMoney > 0 && paidMoney >= totalInvoicedMoney) ||
    order.creditCycle?.status === 'collected' ||
    (invoices.length > 0 && invoices.every(i => i.creditCycle?.status === 'paid' || i.creditCycle?.status === 'collected'));
  const isCollectedPartial = paidMoney > 0 && paidMoney < totalInvoicedMoney;

  // 1. OC
  const ocStep: LifecycleStepInfo = {
    id: 'oc',
    number: 1,
    label: 'Orden de Compra',
    shortLabel: 'OC',
    icon: '📦',
    status: 'done',
    detail: `OC: ${order.oc || order.folio || 'S/N'} (${totalKg.toLocaleString('es-MX')} kg)`,
    badgeText: order.oc ? `OC #${order.oc}` : 'Creada',
  };

  // 2. Báscula / Producción
  const basculaStep: LifecycleStepInfo = {
    id: 'bascula',
    number: 2,
    label: 'Báscula & Entregas',
    shortLabel: 'Báscula',
    icon: '⚖️',
    status: isSurtidoFull ? 'done' : hasDeliveries ? 'active' : 'pending',
    detail: hasDeliveries
      ? `Entregado: ${deliveredKg.toLocaleString('es-MX')} de ${totalKg.toLocaleString('es-MX')} kg (${Math.round((deliveredKg / (totalKg || 1)) * 100)}%)`
      : `Pendiente: ${totalKg.toLocaleString('es-MX')} kg por entregar`,
    badgeText: isSurtidoFull ? '100% Surtido' : hasDeliveries ? `${kilos(deliveredKg)}` : '0 kg',
  };

  // 3. Facturación CFDI
  const facturaStep: LifecycleStepInfo = {
    id: 'factura',
    number: 3,
    label: 'Facturación CFDI',
    shortLabel: 'Factura',
    icon: '🧾',
    status: isInvoiceFull ? 'done' : hasInvoices ? 'active' : hasDeliveries ? 'active' : 'pending',
    detail: hasInvoices
      ? `Facturado: ${invoicedKg.toLocaleString('es-MX')} kg (${invoices.length} factura(s) por ${money(totalInvoicedMoney)})`
      : hasDeliveries
      ? `Listo en báscula para facturar: ${deliveredKg.toLocaleString('es-MX')} kg`
      : 'Sin facturar',
    badgeText: isInvoiceFull ? 'Facturado 100%' : hasInvoices ? `${invoices.length} fac` : 'Pendiente',
  };

  // 4. Contrarecibo
  const crStep: LifecycleStepInfo = {
    id: 'cr',
    number: 4,
    label: 'Contrarecibo Providencia',
    shortLabel: 'CR',
    icon: '📋',
    status: isCrFull && hasInvoices ? 'done' : hasSinCr ? 'warn' : hasInvoices ? 'active' : 'pending',
    detail: isCrFull && hasCr
      ? `Contrarecibo: ${crInvoices.map(i => extractCr(i, order)).join(', ')}`
      : hasSinCr
      ? 'Facturas en revisión en Providencia (Pendiente de sello)'
      : 'En espera de facturación',
    badgeText: isCrFull && hasCr ? crInvoices[0] ? extractCr(crInvoices[0], order) : 'Con CR' : hasSinCr ? 'En revisión' : 'Sin CR',
  };

  // 5. Cobro Bancario
  const cobroStep: LifecycleStepInfo = {
    id: 'cobro',
    number: 5,
    label: 'Cobro Bancario',
    shortLabel: 'Cobro',
    icon: '💰',
    status: isCollectedFull ? 'done' : isCollectedPartial ? 'active' : 'pending',
    detail: isCollectedFull
      ? `Cobrado al 100%: ${money(paidMoney)}`
      : isCollectedPartial
      ? `Abonado: ${money(paidMoney)} de ${money(totalInvoicedMoney)}`
      : hasInvoices
      ? `Por cobrar: ${money(totalInvoicedMoney - paidMoney)}`
      : 'Pendiente',
    badgeText: isCollectedFull ? 'Cobrado' : isCollectedPartial ? 'Abonado' : 'Por cobrar',
  };

  return [ocStep, basculaStep, facturaStep, crStep, cobroStep];
}

const STATUS_COLORS: Record<'done' | 'active' | 'warn' | 'pending', { bg: string; border: string; text: string; dot: string }> = {
  done: {
    bg: 'rgba(16, 185, 129, 0.12)',
    border: '#10b981',
    text: '#059669',
    dot: '#10b981',
  },
  active: {
    bg: 'rgba(37, 99, 235, 0.12)',
    border: '#3b82f6',
    text: '#2563eb',
    dot: '#3b82f6',
  },
  warn: {
    bg: 'rgba(245, 158, 11, 0.14)',
    border: '#f59e0b',
    text: '#d97706',
    dot: '#f59e0b',
  },
  pending: {
    bg: 'var(--paper-sunk)',
    border: 'var(--line)',
    text: 'var(--ink-soft)',
    dot: 'var(--line-soft)',
  },
};

export const OrderLifecycleSemaphore: React.FC<OrderLifecycleSemaphoreProps> = ({
  order,
  summary,
  compact = true,
  style = {},
}) => {
  const steps = React.useMemo(() => computeOrderLifecycle(order, summary), [order, summary]);

  // Paso actual (el primer paso que no esté completado o el último si todos están done)
  const currentStep = steps.find(s => s.status === 'active' || s.status === 'warn') || (steps.every(s => s.status === 'done') ? steps[4] : steps[1]);

  if (compact) {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 2,
          background: 'var(--paper)',
          padding: '2px 5px',
          borderRadius: 6,
          border: '1px solid var(--line-soft)',
          ...style,
        }}
        title={`Etapa actual: ${currentStep.label} (${currentStep.detail})`}
      >
        {steps.map((s, idx) => {
          const c = STATUS_COLORS[s.status];
          const isDone = s.status === 'done';
          const isActive = s.status === 'active' || s.status === 'warn';

          return (
            <React.Fragment key={s.id}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2.5,
                  padding: '1px 3.5px',
                  borderRadius: 4,
                  background: isDone ? 'rgba(16, 185, 129, 0.08)' : isActive ? c.bg : 'transparent',
                  border: isActive ? `1px solid ${c.border}` : '1px solid transparent',
                  cursor: 'default',
                }}
                title={`${s.number}. ${s.label}: ${s.detail}`}
              >
                <span
                  style={{
                    width: 5.5,
                    height: 5.5,
                    borderRadius: '50%',
                    background: c.dot,
                    boxShadow: isActive ? `0 0 4px ${c.dot}` : 'none',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: isDone || isActive ? 800 : 600,
                    color: isDone ? '#059669' : isActive ? c.text : 'var(--ink-soft)',
                    letterSpacing: '0.01em',
                  }}
                >
                  {s.shortLabel}
                </span>
              </div>

              {idx < steps.length - 1 && (
                <span
                  style={{
                    width: 4,
                    height: 1,
                    background: isDone ? '#10b981' : 'var(--line-soft)',
                    opacity: 0.6,
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  // Modo expandido (para cards de Kanban, modales o dashboards)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--paper-sunk)',
        padding: '10px 14px',
        borderRadius: 12,
        border: '1px solid var(--line)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>
          🚥 Ciclo de Vida del Expediente
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[currentStep.status].text }}>
          Etapa {currentStep.number}/5: {currentStep.label}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
        {steps.map((s) => {
          const c = STATUS_COLORS[s.status];
          return (
            <div
              key={s.id}
              style={{
                background: s.status === 'done' ? '#ecfdf5' : c.bg,
                border: `1px solid ${c.border}`,
                borderRadius: 8,
                padding: '6px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 800, color: c.text }}>
                <span>{s.icon}</span>
                <span>{s.shortLabel}</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--ink-soft)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.detail}>
                {s.badgeText || s.detail}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
