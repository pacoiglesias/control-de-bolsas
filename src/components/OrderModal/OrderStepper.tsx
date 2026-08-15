import { useMemo } from 'react';
import { getOrderSummary } from '../../lib/finance';
import type { PurchaseOrder } from '../../lib/types';

interface OrderStepperProps {
  order: PurchaseOrder;
  activeTab: string;
  onSelectTab: (tab: string) => void;
}

export function OrderStepper({ order, activeTab, onSelectTab }: OrderStepperProps) {
  const summary = useMemo(() => getOrderSummary(order), [order]);

  const totalKilos = Number(order.totalKilograms) || 0;
  const kilosEntregados = summary.kilosDelivered;
  const kilosFacturados = summary.kilosInvoiced;
  const invoices = summary.invoices;

  const hasDeliveries = kilosEntregados > 0;
  const isDeliveryComplete = totalKilos > 0 && kilosEntregados >= totalKilos - 0.01;
  const hasInvoices = invoices.length > 0 && kilosFacturados > 0;
  const isInvoicingComplete = totalKilos > 0 && kilosFacturados >= totalKilos - 0.01;
  
  const hasContrarecibo = invoices.some((i) => !!i.collection?.contrareciboNumber?.trim());
  const allHaveContrarecibo = invoices.length > 0 && invoices.every((i) => !!i.collection?.contrareciboNumber?.trim());
  
  const hasPaid = invoices.some((i) => i.creditCycle.status === 'paid' || i.creditCycle.status === 'collected');
  const isCollected = summary.status === 'collected' || (invoices.length > 0 && invoices.every((i) => i.creditCycle.status === 'collected'));

  const steps = [
    {
      id: 'resumen',
      num: '1',
      label: 'OC Recibida',
      detail: totalKilos > 0 ? `${totalKilos.toLocaleString('es-MX')} kg` : 'Registrada',
      completed: true,
      active: activeTab === 'resumen',
    },
    {
      id: 'andres',
      num: '2',
      label: 'Pedido a Andrés',
      detail: hasDeliveries ? 'Entregando' : 'Por pedir',
      completed: hasDeliveries || (order.provider && order.provider !== ''),
      active: activeTab === 'andres',
    },
    {
      id: 'entregas',
      num: '3',
      label: 'Entrega Directa',
      detail: hasDeliveries ? `${kilosEntregados.toLocaleString('es-MX')} kg` : '0 kg',
      completed: isDeliveryComplete,
      active: activeTab === 'entregas',
    },
    {
      id: 'facturas',
      num: '4',
      label: 'Factura SAT',
      detail: hasInvoices ? `${kilosFacturados.toLocaleString('es-MX')} kg` : 'Sin facturar',
      completed: isInvoicingComplete,
      active: activeTab === 'facturas',
    },
    {
      id: 'facturas',
      num: '5',
      label: 'Contrarecibo',
      detail: allHaveContrarecibo ? 'Asignado' : (hasContrarecibo ? 'Parcial' : 'Pendiente'),
      completed: allHaveContrarecibo,
      active: activeTab === 'facturas',
    },
    {
      id: 'resumen',
      num: '6',
      label: 'Cobrado en Caja',
      detail: isCollected ? 'En Caja' : (hasPaid ? 'Con Contador' : 'Por Cobrar'),
      completed: isCollected,
      active: isCollected,
    },
  ];

  return (
    <div
      style={{
        background: 'var(--paper-sunk)',
        border: '1px solid var(--line)',
        borderRadius: 12,
        padding: '12px 16px',
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
        {steps.map((s, idx) => {
          const isCurrent = s.active;
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 105 }}>
              <div
                onClick={() => onSelectTab(s.id)}
                className="clickable"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
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
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: s.completed ? 'var(--ok)' : (isCurrent ? 'var(--accent)' : 'var(--line)'),
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {s.completed ? '✓' : s.num}
                </div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--accent-deep)' : 'var(--ink)' }}>
                    {s.label}
                  </div>
                  <div style={{ fontSize: 10, color: s.completed ? 'var(--ok)' : 'var(--ink-soft)' }}>
                    {s.detail}
                  </div>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: '0 0 10px',
                    background: s.completed ? 'var(--ok)' : 'var(--line)',
                    margin: '0 2px',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
