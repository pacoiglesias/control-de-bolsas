import React, { useState } from 'react';
import { Modal } from '../ui';
import { money, kilos } from '../../lib/format';
import type { PurchaseOrder } from '../../lib/types';
import { useToast } from '../../context/ToastContext';
import { triggerHaptic } from '../../lib/hapticEngine';

interface WhatsAppOrderModalProps {
  order: PurchaseOrder;
  kilosPedidos: number;
  costPrice: number;
  provName?: string;
  onClose: () => void;
}

export const WhatsAppOrderModal: React.FC<WhatsAppOrderModalProps> = ({
  order,
  kilosPedidos,
  costPrice,
  provName = 'Andrés',
  onClose,
}) => {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  // Teléfono de Andrés (o configurable)
  const [phoneNumber, setPhoneNumber] = useState('');

  const folioText = order.folio || order.oc || 'S/N';
  const ocText = order.oc ? ` (OC: ${order.oc})` : '';
  const totalAmount = kilosPedidos * costPrice;

  const itemsList = (order.items && order.items.length > 0)
    ? order.items.map((it, idx) => `  ${idx + 1}. ${it.description || 'Bolsa de polietileno'} - *${kilos(it.quantity)}*`).join('\n')
    : `  • Bolsa de polietileno: *${kilos(kilosPedidos)}*`;

  const deliveryDateStr = order.estimatedDeliveryDate
    ? new Date(
        typeof (order.estimatedDeliveryDate as any).toDate === 'function'
          ? (order.estimatedDeliveryDate as any).toDate()
          : order.estimatedDeliveryDate
      ).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Por definir';

  // Redactar mensaje profesional y claro
  const message = `*PEDIDO DE FABRICACIÓN - ${provName.toUpperCase()}* 🏭
Hola ${provName}, te comparto el pedido para la orden *#${folioText}*${ocText}:

📦 *Material solicitado:*
${itemsList}

⚖️ *Total Kilos:* *${kilos(kilosPedidos)}*
💵 *Precio pactado:* *$${costPrice.toFixed(2)} MXN / kg*
💰 *Importe estimado:* *${money(totalAmount)}*
📅 *Fecha límite de entrega:* *${deliveryDateStr}*

Favor de confirmar recepción y fecha de entrega en báscula. ¡Gracias!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      triggerHaptic('success');
      toast('📋 Mensaje copiado al portapapeles. Listo para pegar en WhatsApp.', 'ok');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast('Error al copiar mensaje.', 'bad');
    }
  };

  const handleOpenWhatsApp = () => {
    triggerHaptic('light');
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <Modal title={`📲 Pedido a ${provName} por WhatsApp`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Envía el pedido de fabricación estructurado directamente a <strong>{provName}</strong> con los kilos, especificaciones y precio por kilo acordado.
        </div>

        {/* Input opcional de teléfono */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 4, display: 'block' }}>
            Número de WhatsApp (Opcional si usas WhatsApp Web/App):
          </label>
          <input
            type="tel"
            placeholder="Ej. 521234567890 (con lada)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: '1px solid var(--line)',
              background: 'var(--paper-sunk)',
              color: 'var(--ink)',
              fontSize: 13,
            }}
          />
        </div>

        {/* Caja de previsualización del mensaje */}
        <div
          style={{
            background: 'var(--paper-sunk)',
            border: '1px solid var(--line)',
            borderRadius: 10,
            padding: 14,
            fontSize: 12.5,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            color: 'var(--ink)',
            maxHeight: 240,
            overflowY: 'auto',
            lineHeight: 1.4,
          }}
        >
          {message}
        </div>

        {/* Resumen financiero pactado */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#065f46' }}>
            Kilos: <strong>{kilos(kilosPedidos)}</strong> a <strong>${costPrice.toFixed(2)}/kg</strong>
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, fontFamily: 'monospace', color: '#047857' }}>
            {money(totalAmount)}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button className="btn" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="btn"
            onClick={handleCopy}
            style={{ fontWeight: 800 }}
          >
            {copied ? '✅ ¡Copiado!' : '📋 Copiar Mensaje'}
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenWhatsApp}
            style={{
              background: '#25D366',
              borderColor: '#25D366',
              color: '#ffffff',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>📲 Abrir en WhatsApp</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
