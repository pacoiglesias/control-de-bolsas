import { useMemo, useState } from 'react';
import { getOrderSummary } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';
import { useSystemSettings } from '../../hooks/useSystemSettings';
import { kilos } from '../../lib/format';
import { WhatsAppOrderModal } from './WhatsAppOrderModal';
import { OrderPriceModal } from './OrderPriceModal';

interface OrderStepperProps {
  order: PurchaseOrder;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onUpdatePrices?: (sellPrice: number, costPrice: number) => void;
}

export function OrderStepper({ order, activeTab, onSelectTab, onUpdatePrices }: OrderStepperProps) {
  const { settings } = useSystemSettings();
  const provName = settings?.providerName || 'Andrés';

  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);

  const summary = useMemo(() => getOrderSummary(order), [order]);

  const totalKilos = Number(order.totalKilograms) || 0;
  const kilosEntregados = summary.kilosDelivered;
  const kilosFacturados = summary.kilosInvoiced;
  const invoices = summary.invoices;

  // Precios actuales de la orden
  const sellPrice = Number(order.customSellPrice || (order.items && order.items[0]?.unitPrice) || 43);
  const costPrice = Number(order.customCostPrice || 38);
  const marginPerKg = Number((sellPrice - costPrice).toFixed(2));
  const marginPct = sellPrice > 0 ? ((marginPerKg / sellPrice) * 100).toFixed(1) : '0';

  const hasDeliveries = kilosEntregados > 0;
  const isDeliveryComplete = totalKilos > 0 && kilosEntregados >= (totalKilos * 0.98); // Con tolerancia del 2%
  const hasInvoices = invoices.length > 0 && kilosFacturados > 0;
  const isInvoicingComplete = totalKilos > 0 && kilosFacturados >= (totalKilos * 0.98);
  
  // Detección de revisión
  const hasInReview = invoices.some((i: any) => i.status === 'revision' || i.internalControl || i.tentativeCrDate);
  const hasContrarecibo = invoices.some((i) => !!i.collection?.contrareciboNumber?.trim());
  const allHaveContrarecibo = invoices.length > 0 && invoices.every((i) => !!i.collection?.contrareciboNumber?.trim());
  
  const hasPaid = invoices.some((i) => i.creditCycle.status === 'paid' || i.creditCycle.status === 'collected');
  const isCollected = summary.status === 'collected' || (invoices.length > 0 && invoices.every((i) => i.creditCycle.status === 'collected'));
  const isClosed = order.isClosedShort || (isDeliveryComplete && isCollected);

  const steps = [
    {
      id: 'resumen',
      num: '1',
      label: 'OC Recibida',
      detail: totalKilos > 0 ? `${kilos(totalKilos)}` : 'Registrada',
      completed: true,
      active: activeTab === 'resumen',
    },
    {
      id: 'andres',
      num: '2',
      label: `Pedido ${provName}`,
      detail: `$${costPrice.toFixed(2)}/kg`,
      completed: hasDeliveries || !!order.provider,
      active: activeTab === 'andres',
      actionBtn: '📲',
      onAction: (e: any) => { e.stopPropagation(); setShowWhatsAppModal(true); },
    },
    {
      id: 'entregas',
      num: '3',
      label: 'Báscula',
      detail: hasDeliveries ? `${kilos(kilosEntregados)}` : '0 kg',
      completed: isDeliveryComplete,
      active: activeTab === 'entregas',
    },
    {
      id: 'facturas',
      num: '4',
      label: 'Factura SAT',
      detail: hasInvoices ? `${kilos(kilosFacturados)}` : 'Sin facturar',
      completed: isInvoicingComplete,
      active: activeTab === 'facturas',
    },
    {
      id: 'facturas',
      num: '5',
      label: 'En Revisión',
      detail: allHaveContrarecibo ? 'Aprobada' : hasInReview ? 'Ingresada' : 'Por meter',
      completed: allHaveContrarecibo || hasContrarecibo,
      active: activeTab === 'facturas',
    },
    {
      id: 'facturas',
      num: '6',
      label: 'Contrarecibo',
      detail: allHaveContrarecibo ? 'Asignado' : (hasContrarecibo ? 'Parcial' : 'Pendiente'),
      completed: allHaveContrarecibo,
      active: activeTab === 'facturas',
    },
    {
      id: 'facturas',
      num: '7',
      label: 'Cobranza',
      detail: isCollected ? 'Cobrado' : (hasPaid ? 'En Banco' : 'Por Cobrar'),
      completed: isCollected,
      active: activeTab === 'facturas',
    },
    {
      id: 'resumen',
      num: '8',
      label: 'Cierre',
      detail: isClosed ? 'Finiquitada' : 'En proceso',
      completed: isClosed,
      active: isClosed,
    },
  ];

  return (
    <>
      <div
        style={{
          background: 'var(--paper-sunk)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* BARRA SUPERIOR: CALIBRACIÓN RÁPIDA DE PRECIOS FLUCTUANTES ($37/$38/$43) Y MARGEN */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>
              Ciclo de Vida de la OC
            </span>

            {/* Píldora de Precios */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '3px 8px',
                borderRadius: 16,
                background: marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${marginPerKg >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: 11.5,
                fontWeight: 800,
                color: marginPerKg >= 0 ? '#065f46' : '#991b1b',
              }}
            >
              <span>Venta: <strong>${sellPrice.toFixed(2)}</strong></span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Costo {provName}: <strong>${costPrice.toFixed(2)}</strong></span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>Margen: <strong>{marginPerKg >= 0 ? `+$${marginPerKg.toFixed(2)}` : `-$${Math.abs(marginPerKg).toFixed(2)}`}/kg</strong> ({marginPct}%)</span>

              {onUpdatePrices && (
                <button
                  type="button"
                  onClick={() => setShowPriceModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 800,
                    textDecoration: 'underline',
                    color: 'inherit',
                    padding: 0,
                    marginLeft: 2,
                  }}
                  title="Ajustar precio de compra o venta para esta orden"
                >
                  ✏️ Ajustar
                </button>
              )}
            </div>
          </div>

          {/* Botón WhatsApp a Andrés */}
          <button
            type="button"
            onClick={() => setShowWhatsAppModal(true)}
            style={{
              padding: '3px 8px',
              borderRadius: 6,
              background: '#25D366',
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: 11,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
            title={`Enviar orden de maquila a ${provName} por WhatsApp`}
          >
            <span>📲 Pedir a {provName}</span>
          </button>
        </div>

        {/* STEPPER HORIZONTAL INTERACTIVO */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
          {steps.map((s, idx) => {
            const isCurrent = s.active;
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 95 }}>
                <div
                  onClick={() => onSelectTab(s.id)}
                  className="clickable"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 8px',
                    borderRadius: 8,
                    background: isCurrent ? 'var(--paper)' : 'transparent',
                    border: isCurrent ? '1px solid var(--accent)' : '1px solid transparent',
                    boxShadow: isCurrent ? 'var(--shadow-soft)' : 'none',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: s.completed ? 'var(--ok)' : (isCurrent ? 'var(--accent)' : 'var(--line)'),
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {s.completed ? '✓' : s.num}
                  </div>
                  <div style={{ lineHeight: 1.2 }}>
                    <div style={{ fontSize: 10.5, fontWeight: isCurrent ? 800 : 700, color: isCurrent ? 'var(--accent-deep)' : 'var(--ink)' }}>
                      {s.label}
                    </div>
                    <div style={{ fontSize: 9.5, color: s.completed ? 'var(--ok)' : 'var(--ink-soft)' }}>
                      {s.detail}
                    </div>
                  </div>
                </div>

                {idx < steps.length - 1 && (
                  <div
                    style={{
                      height: 2,
                      flex: '0 0 8px',
                      background: s.completed ? 'var(--ok)' : 'var(--line)',
                      margin: '0 1px',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Pedido por WhatsApp */}
      {showWhatsAppModal && (
        <WhatsAppOrderModal
          order={order}
          kilosPedidos={totalKilos}
          costPrice={costPrice}
          provName={provName}
          onClose={() => setShowWhatsAppModal(false)}
        />
      )}

      {/* Modal de Calibración Rápida de Precios */}
      {showPriceModal && (
        <OrderPriceModal
          currentSellPrice={sellPrice}
          currentCostPrice={costPrice}
          totalKilos={totalKilos}
          provName={provName}
          onSave={(newSell, newCost) => {
            if (onUpdatePrices) {
              onUpdatePrices(newSell, newCost);
            }
          }}
          onClose={() => setShowPriceModal(false)}
        />
      )}
    </>
  );
}
