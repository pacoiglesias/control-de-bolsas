import React from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';

interface ThreeWayMatchingBadgeProps {
  order: PurchaseOrder;
  compact?: boolean;
}

export const ThreeWayMatchingBadge: React.FC<ThreeWayMatchingBadgeProps> = ({ order, compact = false }) => {
  if (!order) return null;

  const goalKg = Number(order.totalKilograms) || 0;
  const deliveredKg = (order.deliveries || []).reduce((acc, d) => acc + (Number(d.kilos) || 0), 0);
  const invoicedKg = (order.invoices || []).reduce((acc, i) => acc + (Number(i.kilos) || 0), 0);
  const paidKg = (order.invoices || []).reduce((acc, i) => {
    const isPaid = i.creditCycle?.status === 'paid' || (i.collection?.paidAmount && i.collection.paidAmount > 0);
    return isPaid ? acc + (Number(i.kilos) || 0) : acc;
  }, 0);

  const crNumbers = Array.from(
    new Set(
      [
        order.collection?.contrareciboNumber,
        ...(order.invoices || []).map((i) => i.collection?.contrareciboNumber),
      ].filter(Boolean)
    )
  ) as string[];

  const hasCr = crNumbers.length > 0;
  const hasInvoices = (order.invoices || []).length > 0;

  // Estados de salud
  const ocState = goalKg > 0 ? 'ok' : 'pending';
  const deliveryState = deliveredKg >= goalKg && goalKg > 0 ? 'ok' : deliveredKg > 0 ? 'partial' : 'pending';
  const invoiceState = invoicedKg >= deliveredKg && deliveredKg > 0 ? 'ok' : invoicedKg > 0 ? 'partial' : 'pending';
  const crState = hasCr ? 'ok' : hasInvoices ? 'warning' : 'pending';
  const paymentState = paidKg >= invoicedKg && invoicedKg > 0 ? 'ok' : paidKg > 0 ? 'partial' : 'pending';

  const getColor = (st: 'ok' | 'partial' | 'warning' | 'pending') => {
    switch (st) {
      case 'ok':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', border: 'rgba(16, 185, 129, 0.35)', icon: '✓' };
      case 'partial':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.35)', icon: '◐' };
      case 'warning':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)', icon: '!' };
      case 'pending':
      default:
        return { bg: 'rgba(255, 255, 255, 0.05)', text: 'rgba(255, 255, 255, 0.4)', border: 'rgba(255, 255, 255, 0.1)', icon: '○' };
    }
  };

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700 }}>
        <span
          title={`1. OC: ${order.folio || order.oc}`}
          style={{ padding: '2px 6px', borderRadius: 4, background: getColor(ocState).bg, color: getColor(ocState).text }}
        >
          OC {getColor(ocState).icon}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
        <span
          title={`2. Báscula: ${deliveredKg.toLocaleString()} / ${goalKg.toLocaleString()} kg`}
          style={{ padding: '2px 6px', borderRadius: 4, background: getColor(deliveryState).bg, color: getColor(deliveryState).text }}
        >
          Báscula {getColor(deliveryState).icon}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
        <span
          title={`3. Facturación: ${invoicedKg.toLocaleString()} kg facturados`}
          style={{ padding: '2px 6px', borderRadius: 4, background: getColor(invoiceState).bg, color: getColor(invoiceState).text }}
        >
          Factura {getColor(invoiceState).icon}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>→</span>
        <span
          title={hasCr ? `4. Contrarecibo: ${crNumbers.join(', ')}` : '4. Sin Contrarecibo'}
          style={{ padding: '2px 6px', borderRadius: 4, background: getColor(crState).bg, color: getColor(crState).text }}
        >
          CR {getColor(crState).icon}
        </span>
      </div>
    );
  }

  type StepState = 'warning' | 'ok' | 'pending' | 'partial';
  const steps: Array<{ label: string; sub: string; state: StepState }> = [
    { label: 'OC Providencia', sub: `${goalKg.toLocaleString()} kg`, state: ocState },
    { label: 'Báscula Patio', sub: `${deliveredKg.toLocaleString()} kg`, state: deliveryState },
    { label: 'Factura CFDI', sub: `${invoicedKg.toLocaleString()} kg`, state: invoiceState },
    { label: 'Contrarecibo', sub: hasCr ? crNumbers.join(', ') : 'Pendiente CR', state: crState },
    { label: 'Cobro / Banco', sub: paidKg > 0 ? `${money(paidKg * 43 * 1.16)}` : 'Por Liquidar', state: paymentState },
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: 'rgba(15, 23, 42, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        overflowX: 'auto',
      }}
    >
      {steps.map((st, idx) => {
        const c = getColor(st.state);
        return (
          <React.Fragment key={st.label}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: 8,
                background: c.bg,
                border: `1px solid ${c.border}`,
                minWidth: 90,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: c.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{c.icon}</span> {st.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {st.sub}
              </div>
            </div>
            {idx < steps.length - 1 && (
              <span style={{ color: 'rgba(255, 255, 255, 0.25)', fontSize: 12, fontWeight: 900 }}>→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
