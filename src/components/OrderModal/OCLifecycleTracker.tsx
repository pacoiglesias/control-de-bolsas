import React, { useState } from 'react';
import { kilos } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { WhatsAppOrderModal } from './WhatsAppOrderModal';

interface OCLifecycleTrackerProps {
  order: PurchaseOrder;
  kilosPedidos: number;
  kilosEntregados: number;
  kilosFaltantes: number;
  sellPrice: number;
  costPrice: number;
  onSetTab: (tab: 'resumen' | 'productos' | 'andres' | 'entregas' | 'facturas') => void;
  onOpenPriceModal?: () => void;
  provName?: string;
}

export const OCLifecycleTracker: React.FC<OCLifecycleTrackerProps> = ({
  order,
  kilosPedidos,
  kilosEntregados,
  kilosFaltantes,
  sellPrice,
  costPrice,
  onSetTab,
  onOpenPriceModal,
  provName = 'Andrés',
}) => {
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  const marginPerKg = Number((sellPrice - costPrice).toFixed(2));
  const marginPct = sellPrice > 0 ? ((marginPerKg / sellPrice) * 100).toFixed(1) : '0';

  // 1. Estado de Entregas
  const deliveryPct = kilosPedidos > 0 ? Math.min(100, Math.round((kilosEntregados / kilosPedidos) * 100)) : 0;
  const isDeliveredComplete = kilosPedidos > 0 && kilosEntregados >= kilosPedidos * 0.98;
  const hasDeliveries = kilosEntregados > 0;

  // 2. Estado de Facturación
  const invoices = order.invoices || [];
  const invoicedKg = invoices.reduce((sum, inv) => sum + (Number(inv.kilos) || 0), 0);
  const hasInvoices = invoices.length > 0;
  const allDeliveriesInvoiced = hasDeliveries && invoicedKg >= kilosEntregados - 0.01;

  // 3. Estado de Revisión y Contrarecibos
  const hasInReview = invoices.some((inv) => (inv as any).status === 'revision' || (inv as any).internalControl || (inv as any).tentativeCrDate);
  const crNumbers = invoices.map((inv) => inv.collection?.contrareciboNumber).filter(Boolean);
  const hasCr = crNumbers.length > 0;

  // 4. Estado de Cobranza
  const allPaid = hasCr && invoices.every((inv) => !inv.collection?.contrareciboNumber || inv.collection?.paidAt);
  const somePaid = invoices.some((inv) => inv.collection?.paidAt);

  // 5. Cierre
  const isClosed = order.isClosedShort || (isDeliveredComplete && allPaid);

  const steps = [
    {
      num: 1,
      title: 'OC Recibida',
      subtitle: `$${sellPrice.toFixed(2)}/kg`,
      status: 'done' as const,
      onClick: () => onSetTab('productos'),
      badge: `${kilos(kilosPedidos)}`,
    },
    {
      num: 2,
      title: `Pedido ${provName}`,
      subtitle: `$${costPrice.toFixed(2)}/kg`,
      status: 'done' as const,
      onClick: () => setShowWhatsAppModal(true),
      badge: '📲 WhatsApp',
      actionIcon: '⚡',
    },
    {
      num: 3,
      title: 'Báscula',
      subtitle: `${deliveryPct}% (${kilos(kilosEntregados)})`,
      status: isDeliveredComplete ? ('done' as const) : hasDeliveries ? ('in_progress' as const) : ('pending' as const),
      onClick: () => onSetTab('entregas'),
      badge: kilosFaltantes > 0 ? `-${kilos(kilosFaltantes)}` : '100%',
    },
    {
      num: 4,
      title: 'Facturación',
      subtitle: hasInvoices ? `${invoices.length} Factura(s)` : 'Pendiente',
      status: allDeliveriesInvoiced ? ('done' as const) : hasInvoices ? ('in_progress' as const) : ('pending' as const),
      onClick: () => onSetTab('facturas'),
      badge: hasInvoices ? kilos(invoicedKg) : 'Sin facturar',
    },
    {
      num: 5,
      title: 'Revisión',
      subtitle: hasInReview || hasCr ? 'Ingresada' : 'Por meter',
      status: hasCr ? ('done' as const) : hasInReview ? ('in_progress' as const) : ('pending' as const),
      onClick: () => onSetTab('facturas'),
      badge: hasCr ? 'Sellada' : hasInReview ? 'En trámite' : 'Pendiente',
    },
    {
      num: 6,
      title: 'Contrarecibo',
      subtitle: hasCr ? crNumbers.join(', ') : 'En espera',
      status: hasCr ? ('done' as const) : ('pending' as const),
      onClick: () => onSetTab('facturas'),
      badge: hasCr ? `${crNumbers.length} CR(s)` : 'Sin CR',
    },
    {
      num: 7,
      title: 'Cobranza',
      subtitle: allPaid ? 'Cobrado 100%' : somePaid ? 'Cobro Parcial' : 'Por cobrar',
      status: allPaid ? ('done' as const) : somePaid ? ('in_progress' as const) : ('pending' as const),
      onClick: () => onSetTab('facturas'),
      badge: allPaid ? 'SPEI OK' : 'Banco',
    },
    {
      num: 8,
      title: 'Cierre',
      subtitle: isClosed ? 'Finiquitada' : 'Activa',
      status: isClosed ? ('done' as const) : ('pending' as const),
      onClick: () => onSetTab('resumen'),
      badge: isClosed ? '🏁 Fin' : 'En proceso',
    },
  ];

  return (
    <>
      <div
        style={{
          background: 'var(--paper-sunk)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* BARRA SUPERIOR: PÍLDORA DE PRECIOS FLUCTUANTES Y MARGEN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>
              Ciclo de Vida de la OC
            </span>

            {/* Píldora de Precios Fluctuantes */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 20,
                background: marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: 12,
                fontWeight: 800,
                color: marginPerKg >= 0 ? '#065f46' : '#991b1b',
              }}
            >
              <span>Venta: <strong>${sellPrice.toFixed(2)}</strong></span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Costo {provName}: <strong>${costPrice.toFixed(2)}</strong></span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Margen: <strong>{marginPerKg >= 0 ? `+$${marginPerKg.toFixed(2)}` : `-$${Math.abs(marginPerKg).toFixed(2)}`}/kg</strong> ({marginPct}%)</span>

              {onOpenPriceModal && (
                <button
                  type="button"
                  onClick={onOpenPriceModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    textDecoration: 'underline',
                    color: 'inherit',
                    padding: 0,
                    marginLeft: 4,
                  }}
                  title="Cambiar precio de venta o costo para esta orden"
                >
                  ✏️ Ajustar
                </button>
              )}
            </div>
          </div>

          {/* Botón Rápido WhatsApp a Andrés */}
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: '#25D366',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: 11.5,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 6px rgba(37, 211, 102, 0.25)',
            }}
          >
            <span>📲 Pedir a {provName} por WhatsApp</span>
          </button>
        </div>

        {/* STEPPER VISUAL HORIZONTAL */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))',
            gap: 6,
          }}
        >
          {steps.map((st) => {
            const isDone = st.status === 'done';
            const inProg = st.status === 'in_progress';

            const bg = isDone
              ? 'rgba(16, 185, 129, 0.14)'
              : inProg
              ? 'rgba(245, 158, 11, 0.14)'
              : 'var(--paper)';

            const borderColor = isDone
              ? '#10b981'
              : inProg
              ? '#f59e0b'
              : 'var(--line)';

            const textColor = isDone
              ? '#065f46'
              : inProg
              ? '#92400e'
              : 'var(--ink-soft)';

            return (
              <div
                key={st.num}
                onClick={st.onClick}
                style={{
                  background: bg,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 10,
                  padding: '8px 6px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  position: 'relative',
                }}
                title={`Paso ${st.num}: ${st.title} - Clic para ver`}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 2 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: isDone ? '#10b981' : inProg ? '#f59e0b' : 'var(--line)',
                      color: isDone || inProg ? '#ffffff' : 'var(--ink-soft)',
                      fontSize: 10,
                      fontWeight: 900,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isDone ? '✓' : st.num}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: textColor, whiteSpace: 'nowrap' }}>
                    {st.title}
                  </span>
                </div>

                <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {st.subtitle}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 9.5,
                    fontWeight: 800,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: 'rgba(0,0,0,0.04)',
                    color: textColor,
                    display: 'inline-block',
                  }}
                >
                  {st.badge}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL DE PEDIDO POR WHATSAPP A ANDRÉS */}
      {showWhatsAppModal && (
        <WhatsAppOrderModal
          order={order}
          kilosPedidos={kilosPedidos}
          costPrice={costPrice}
          provName={provName}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}
    </>
  );
};
