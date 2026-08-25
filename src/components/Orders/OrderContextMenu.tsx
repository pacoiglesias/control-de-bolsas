import React, { useEffect, useRef } from 'react';
import type { PurchaseOrder } from '../../lib/types';
import { money } from '../../lib/format';
import { openWhatsAppMessage } from '../../lib/whatsappReminder';
import { useToast } from '../../context/ToastContext';
import { generatePrefacturaPdf } from '../../lib/prefacturaGenerator';
import { printRemision } from '../OrderModal/orderModalPrint';

interface OrderContextMenuProps {
  order: PurchaseOrder;
  x: number;
  y: number;
  onClose: () => void;
  onOpenOrder: (order: PurchaseOrder) => void;
  onQuickInvoice?: (order: PurchaseOrder) => void;
}

export const OrderContextMenu: React.FC<OrderContextMenuProps> = ({
  order,
  x,
  y,
  onClose,
  onOpenOrder,
  onQuickInvoice,
}) => {
  const toast = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleScroll = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates to not overflow screen
  const menuWidth = 230;
  const menuHeight = 220;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 10);

  const crs = (order.invoices || [])
    .map((inv: any) => inv.collection?.contrareciboNumber)
    .filter(Boolean)
    .join(', ');

  const totalAmount = (order.invoices || []).reduce(
    (acc: number, inv: any) => acc + (Number(inv.financials?.invoiceTotal) || Number(inv.financials?.subtotal) || 0),
    0
  );

  const handleCopyFolio = () => {
    navigator.clipboard.writeText(order.folio || order.oc || '');
    toast('Folio copiado al portapapeles', 'ok');
    onClose();
  };

  const handleCopyCr = () => {
    if (crs) {
      navigator.clipboard.writeText(crs);
      toast(`Contrarecibo ${crs} copiado`, 'ok');
    } else {
      toast('Esta orden no tiene contrarecibo aún', 'info');
    }
    onClose();
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Expediente OC ${order.folio || order.oc} - ${order.client || 'Cliente'}`);
    const body = encodeURIComponent(
      `Estimado(a),\n\nLe comparto el detalle de la Orden de Compra:\n• Folio: OC-${order.folio || order.oc}\n• Cliente: ${order.client || 'Providencia'}\n• Total Kilos: ${(order.totalKilograms || 0).toLocaleString('es-MX')} kg\n• Importe: ${money(totalAmount)}\n${crs ? `• Contrarecibo: ${crs}\n` : ''}\nQuedamos a sus órdenes.\nControl Bolsas ERP`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    onClose();
  };

  const handleSendWhatsApp = () => {
    const text = `Hola, te comparto el estado de la *OC ${order.folio || order.oc}* (${order.client}):\n• Total: *${money(totalAmount)}* (${(order.totalKilograms || 0).toLocaleString('es-MX')} kg)\n${crs ? `• Contrarecibo: *${crs}*\n` : ''}Saludos.`;
    openWhatsAppMessage(text);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        width: menuWidth,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 14,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
        padding: '6px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#93c5fd' }}>
          OC {order.folio || order.oc || 'S/F'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', truncate: 'ellipsis' } as any}>
          {order.client || 'Sin Cliente'}
        </div>
      </div>

      <button
        onClick={() => {
          onOpenOrder(order);
          onClose();
        }}
        style={menuItemStyle}
      >
        <span>👁️</span> <span>Abrir Expediente</span>
      </button>

      {onQuickInvoice && (
        <button
          onClick={() => {
            onQuickInvoice(order);
            onClose();
          }}
          style={{ ...menuItemStyle, color: '#fcd34d' }}
        >
          <span>⚡</span> <span>Facturar / Asignar CR</span>
        </button>
      )}

      <button
        onClick={async () => {
          toast('📄 Generando Pre-Factura en PDF...', 'info');
          try {
            await generatePrefacturaPdf(order, null);
            toast('✅ Pre-Factura descargada', 'ok');
          } catch (e) {
            console.error(e);
            toast('Error generando prefactura PDF', 'bad');
          }
          onClose();
        }}
        style={menuItemStyle}
      >
        <span>📋</span> <span>Descargar Pre-Factura PDF</span>
      </button>

      <button
        onClick={() => {
          toast('📄 Abriendo Remisión de Báscula...', 'ok');
          printRemision({
            folio: order.folio,
            oc: order.oc,
            client: order.client,
            department: order.department,
            items: order.items,
            kilosNum: Number(order.totalKilograms) || 0,
            provName: 'Andrés',
          });
          onClose();
        }}
        style={menuItemStyle}
      >
        <span>📄</span> <span>Imprimir Remisión Báscula</span>
      </button>

      <button onClick={handleCopyFolio} style={menuItemStyle}>
        <span>📋</span> <span>Copiar Folio</span>
      </button>

      {crs && (
        <button onClick={handleCopyCr} style={menuItemStyle}>
          <span>📄</span> <span>Copiar Contrarecibo</span>
        </button>
      )}

      <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '4px 0' }} />

      <button onClick={handleSendEmail} style={menuItemStyle}>
        <span>✉️</span> <span>Enviar por Correo</span>
      </button>

      <button onClick={handleSendWhatsApp} style={menuItemStyle}>
        <span>📲</span> <span>Enviar por WhatsApp</span>
      </button>
    </div>
  );
};

const menuItemStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  borderRadius: 8,
  padding: '8px 10px',
  color: '#fff',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textAlign: 'left',
  width: '100%',
  transition: 'background 0.15s ease',
};
