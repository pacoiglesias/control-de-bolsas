import { useState } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface OrderRowActionsProps {
  order: PurchaseOrder;
  kilosPendientesDeFacturar: number;
  hasSinCr: boolean;
  onOpenModal: () => void;
  /** Llamado directo al QuickCrModal — ya no necesita pasar por custom event */
  onFastCr?: () => void;
}

export function OrderRowActions({
  order,
  kilosPendientesDeFacturar,
  hasSinCr,
  onOpenModal,
  onFastCr,
}: OrderRowActionsProps) {
  const [crPulse, setCrPulse] = useState(false);

  const handleFastInvoice = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    window.dispatchEvent(new CustomEvent('open-fast-invoice', { detail: { orderId: order.id } }));
  };

  const handleFastDelivery = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    window.dispatchEvent(new CustomEvent('open-fast-delivery', { detail: { orderId: order.id } }));
  };

  const handleFastCr = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('heavy');
    if (onFastCr) {
      onFastCr();
    } else {
      // Fallback legacy: custom event
      window.dispatchEvent(new CustomEvent('open-fast-quick-cr', { detail: { order } }));
    }
    setCrPulse(true);
    setTimeout(() => setCrPulse(false), 600);
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'var(--paper-sunk)',
        padding: '2px 4px',
        borderRadius: 8,
        border: '1px solid var(--line-soft)',
      }}
    >
      {/* 1. Contrarecibo — ACCIÓN PRIORITARIA cuando falta CR */}
      {hasSinCr && (
        <button
          type="button"
          onClick={handleFastCr}
          style={{
            background: crPulse
              ? 'rgba(124, 58, 237, 0.3)'
              : 'rgba(124, 58, 237, 0.15)',
            color: '#6d28d9',
            border: '1.5px solid rgba(124, 58, 237, 0.5)',
            borderRadius: 6,
            padding: '3px 9px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            // Glow proactivo para indicar acción pendiente urgente
            boxShadow: '0 0 0 2px rgba(124,58,237,0.15)',
            transition: 'all 0.15s ease',
            animation: 'crPulseAnim 2s ease-in-out infinite',
          }}
          title="⚡ Acción requerida: Capturar número de Contrarecibo (CR)"
        >
          <span>📑</span> + Asignar CR
        </button>
      )}

      {/* 2. Facturar */}
      <button
        type="button"
        onClick={handleFastInvoice}
        style={{
          background: kilosPendientesDeFacturar > 0.01 ? 'rgba(217, 119, 6, 0.12)' : 'transparent',
          color: kilosPendientesDeFacturar > 0.01 ? '#b45309' : 'var(--ink-soft)',
          border: kilosPendientesDeFacturar > 0.01 ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid transparent',
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 10.5,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
        title={`Emitir Factura CFDI (${kilosPendientesDeFacturar.toLocaleString('es-MX')} kg listos)`}
      >
        <span>🧾</span> Facturar
      </button>

      {/* 3. Entrega de Báscula */}
      <button
        type="button"
        onClick={handleFastDelivery}
        style={{
          background: 'transparent',
          color: 'var(--ink-soft)',
          border: '1px solid transparent',
          borderRadius: 6,
          padding: '2px 6px',
          fontSize: 10.5,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
        title="Registrar ticket de entrega de báscula"
      >
        <span>🚚</span> Entrega
      </button>

      {/* 4. Ver Ficha */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenModal();
        }}
        style={{
          background: 'transparent',
          color: 'var(--brand)',
          border: 'none',
          borderRadius: 6,
          padding: '2px 5px',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
        }}
        title="Abrir expediente completo"
      >
        👁️
      </button>
    </div>
  );
}
