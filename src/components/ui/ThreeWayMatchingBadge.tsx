import React from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { money, toDate } from '../../lib/format';

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

  // ── Fechas Reales y Dinámicas por Hito ──────────────────────────────────────
  // 1. Fecha de OC / Apertura
  const rawOcDate = order.createdAt || (order as any).date || order.creditCycle?.issueDate;
  const ocDate = toDate(rawOcDate);
  const ocDateFmt = ocDate ? `${ocDate.getDate()}/${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][ocDate.getMonth()]}` : '';

  // 2. Báscula / Suministro (Última entrega física y próxima entrega programada)
  const deliveries = (order.deliveries || []).filter((d) => (Number(d.kilos) || 0) > 0);
  const latestDelivery = deliveries.length > 0
    ? deliveries.reduce((latest, d) => {
        const dDate = toDate(d.date);
        const lDate = toDate(latest.date);
        return dDate && (!lDate || dDate.getTime() > lDate.getTime()) ? d : latest;
      }, deliveries[0])
    : null;
  const latestDeliveryDate = toDate(latestDelivery?.date);
  const latestDeliveryFmt = latestDeliveryDate
    ? `${latestDeliveryDate.getDate()}/${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][latestDeliveryDate.getMonth()]}`
    : '';

  const nextEstimatedDate = toDate(order.estimatedDeliveryDate);
  const nextEstimatedFmt = nextEstimatedDate
    ? `${nextEstimatedDate.getDate()}/${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][nextEstimatedDate.getMonth()]}`
    : '';

  // 3. Facturación (Último CFDI timbrado)
  const validInvoices = (order.invoices || []).filter(
    (i) => (i as any).status !== 'cancelled' && (Number(i.kilos) || 0) > 0
  );
  const latestInvoice = validInvoices.length > 0
    ? validInvoices.reduce((latest, i) => {
        const iDate = toDate(i.creditCycle?.issueDate || (i as any).fecha || i.createdAt);
        const lDate = toDate(latest.creditCycle?.issueDate || (latest as any).fecha || latest.createdAt);
        return iDate && (!lDate || iDate.getTime() > lDate.getTime()) ? i : latest;
      }, validInvoices[0])
    : null;
  const latestInvoiceDate = toDate(latestInvoice?.creditCycle?.issueDate || (latestInvoice as any)?.fecha || latestInvoice?.createdAt);
  const latestInvoiceFmt = latestInvoiceDate
    ? `${latestInvoiceDate.getDate()}/${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][latestInvoiceDate.getMonth()]}`
    : '';

  // 4. Contrarecibo y Pago (Vencimiento oficial de pago)
  const crInvoices = validInvoices.filter((i) => !!i.collection?.contrareciboNumber);
  const latestCrInvoice = crInvoices.length > 0
    ? crInvoices.reduce((latest, i) => {
        const iDue = toDate(i.creditCycle?.dueDate || i.collection?.contrareciboDate);
        const lDue = toDate(latest.creditCycle?.dueDate || latest.collection?.contrareciboDate);
        return iDue && (!lDue || iDue.getTime() > lDue.getTime()) ? i : latest;
      }, crInvoices[0])
    : null;
  const crDueDate = toDate(latestCrInvoice?.creditCycle?.dueDate || latestCrInvoice?.collection?.contrareciboDate || order.collection?.contrareciboDate);
  const crDueDateFmt = crDueDate
    ? `${crDueDate.getDate()}/${['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'][crDueDate.getMonth()]}`
    : '';

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
    const basculaDateBadge = nextEstimatedFmt
      ? `Próx: ${nextEstimatedFmt}`
      : latestDeliveryFmt
      ? `Últ: ${latestDeliveryFmt}`
      : '';

    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 700,
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
          overflowX: 'auto',
          maxWidth: '100%',
          padding: '2px 0',
        }}
      >
        {/* 1. OC */}
        <span
          title={`1. OC: ${order.folio || order.oc}${ocDateFmt ? ` · Fecha: ${ocDateFmt}` : ''}`}
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: getColor(ocState).bg,
            color: getColor(ocState).text,
            border: `1px solid ${getColor(ocState).border}`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>OC {getColor(ocState).icon}</span>
          {ocDateFmt && (
            <span style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>({ocDateFmt})</span>
          )}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontSize: 10 }}>→</span>

        {/* 2. Báscula */}
        <span
          title={`2. Báscula: ${deliveredKg.toLocaleString()} / ${goalKg.toLocaleString()} kg${
            nextEstimatedFmt ? ` · Próxima entrega: ${nextEstimatedFmt}` : latestDeliveryFmt ? ` · Última entrega: ${latestDeliveryFmt}` : ''
          }`}
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: getColor(deliveryState).bg,
            color: getColor(deliveryState).text,
            border: `1px solid ${getColor(deliveryState).border}`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Báscula {getColor(deliveryState).icon}</span>
          {basculaDateBadge && (
            <span style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>({basculaDateBadge})</span>
          )}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontSize: 10 }}>→</span>

        {/* 3. Factura */}
        <span
          title={`3. Facturación: ${invoicedKg.toLocaleString()} kg facturados${latestInvoiceFmt ? ` · Último CFDI: ${latestInvoiceFmt}` : ''}`}
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: getColor(invoiceState).bg,
            color: getColor(invoiceState).text,
            border: `1px solid ${getColor(invoiceState).border}`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>Factura {getColor(invoiceState).icon}</span>
          {latestInvoiceFmt && (
            <span style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>({latestInvoiceFmt})</span>
          )}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, fontSize: 10 }}>→</span>

        {/* 4. Contrarecibo */}
        <span
          title={
            hasCr
              ? `4. Contrarecibo: ${crNumbers.join(', ')}${crDueDateFmt ? ` · Fecha Pago: ${crDueDateFmt}` : ''}`
              : '4. Sin Contrarecibo (En revisión)'
          }
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            background: getColor(crState).bg,
            color: getColor(crState).text,
            border: `1px solid ${getColor(crState).border}`,
            whiteSpace: 'nowrap',
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span>CR {getColor(crState).icon}</span>
          {crDueDateFmt ? (
            <span style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>({crDueDateFmt})</span>
          ) : hasCr && crNumbers.length > 0 ? (
            <span style={{ fontSize: 9.5, opacity: 0.85, fontWeight: 600 }}>({crNumbers[0]})</span>
          ) : null}
        </span>
      </div>
    );
  }

  type StepState = 'warning' | 'ok' | 'pending' | 'partial';
  const steps: Array<{ label: string; sub: string; dateSub?: string; state: StepState }> = [
    {
      label: 'OC Providencia',
      sub: `${goalKg.toLocaleString()} kg`,
      dateSub: ocDateFmt ? `Emisión: ${ocDateFmt}` : undefined,
      state: ocState,
    },
    {
      label: 'Báscula Patio',
      sub: `${deliveredKg.toLocaleString()} kg`,
      dateSub: nextEstimatedFmt ? `Próx: ${nextEstimatedFmt}` : latestDeliveryFmt ? `Últ: ${latestDeliveryFmt}` : undefined,
      state: deliveryState,
    },
    {
      label: 'Factura CFDI',
      sub: `${invoicedKg.toLocaleString()} kg`,
      dateSub: latestInvoiceFmt ? `Últ: ${latestInvoiceFmt}` : undefined,
      state: invoiceState,
    },
    {
      label: 'Contrarecibo',
      sub: hasCr ? crNumbers.join(', ') : 'Pendiente CR',
      dateSub: crDueDateFmt ? `Pago: ${crDueDateFmt}` : undefined,
      state: crState,
    },
    {
      label: 'Cobro / Banco',
      sub: paidKg > 0 ? `${money(paidKg * 43 * 1.16)}` : 'Por Liquidar',
      dateSub: crDueDateFmt ? `Vence: ${crDueDateFmt}` : undefined,
      state: paymentState,
    },
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
                minWidth: 96,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: c.text, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span>{c.icon}</span> {st.label}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                {st.sub}
              </div>
              {st.dateSub && (
                <div style={{ fontSize: 9.5, fontWeight: 600, color: 'rgba(255, 255, 255, 0.65)', marginTop: 1 }}>
                  {st.dateSub}
                </div>
              )}
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
