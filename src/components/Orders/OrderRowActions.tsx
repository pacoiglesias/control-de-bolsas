import { useState } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { triggerHaptic } from '../../lib/hapticEngine';

interface OrderRowActionsProps {
  order: PurchaseOrder;
  kilosPendientesDeFacturar: number;
  hasSinCr: boolean;
  onOpenModal: (tab?: 'resumen' | 'productos' | 'andres' | 'entregas' | 'facturas') => void;
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
      window.dispatchEvent(new CustomEvent('open-fast-quick-cr', { detail: { order } }));
    }
    setCrPulse(true);
    setTimeout(() => setCrPulse(false), 600);
  };

  const invoiceCount = (order.invoices || []).length;
  const hasPendingKilos = kilosPendientesDeFacturar > 0.01;

  return (
    <div className="ora-toolbar">
      {/* 1. Asignar CR — Acción prioritaria cuando falta contrarecibo */}
      {hasSinCr && (
        <button
          type="button"
          className={`ora-btn ora-btn--cr ${crPulse ? 'ora-btn--cr-pulse' : ''}`}
          onClick={handleFastCr}
          title="⚡ Acción requerida: Capturar número de Contrarecibo (CR)"
        >
          <span aria-hidden="true">📑</span>
          <span>+ CR</span>
        </button>
      )}

      {/* 2. Ver Facturas emitidas */}
      {invoiceCount > 0 && (
        <button
          type="button"
          className="ora-btn ora-btn--invoices"
          onClick={(e) => { e.stopPropagation(); onOpenModal('facturas'); }}
          title={`Ver, editar, corregir o borrar facturas (${invoiceCount} emitidas)`}
        >
          <span aria-hidden="true">🧾</span>
          <span>{invoiceCount}</span>
        </button>
      )}

      {/* 3. Facturar */}
      <button
        type="button"
        className={`ora-btn ${hasPendingKilos ? 'ora-btn--invoice-pending' : 'ora-btn--ghost'}`}
        onClick={handleFastInvoice}
        title={`Emitir Factura CFDI (${kilosPendientesDeFacturar.toLocaleString('es-MX')} kg listos)`}
      >
        <span aria-hidden="true">⚡</span>
        <span>Facturar</span>
      </button>

      {/* 4. Entrega de Báscula */}
      <button
        type="button"
        className="ora-btn ora-btn--ghost"
        onClick={handleFastDelivery}
        title="Registrar ticket de entrega de báscula"
      >
        <span aria-hidden="true">🚚</span>
        <span>Entrega</span>
      </button>

      {/* 5. Conceptos / Partidas */}
      <button
        type="button"
        className="ora-btn ora-btn--ghost"
        onClick={(e) => { e.stopPropagation(); onOpenModal('productos'); }}
        title="Ver y editar partidas / artículos con guardado automático en Firebase"
      >
        <span aria-hidden="true">📦</span>
        <span>Conceptos</span>
      </button>

      {/* 6. Ver Expediente completo */}
      <button
        type="button"
        className="ora-btn ora-btn--view"
        onClick={(e) => { e.stopPropagation(); onOpenModal('resumen'); }}
        title="Abrir expediente completo"
        aria-label="Ver expediente"
      >
        <span aria-hidden="true">👁️</span>
      </button>
    </div>
  );
}
