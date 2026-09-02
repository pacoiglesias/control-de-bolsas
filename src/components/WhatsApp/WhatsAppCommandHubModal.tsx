import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { money, fmtDate } from '../../lib/format';
import { extractCr } from '../../lib/finance';
import { triggerHaptic } from '../../lib/hapticEngine';
import type { PurchaseOrder } from '../../lib/types';

interface WhatsAppCommandHubModalProps {
  order?: PurchaseOrder | null;
  onClose: () => void;
  toast: (msg: string, tone?: 'info' | 'ok' | 'bad') => void;
}

type ChannelType = 'contadores_prefactura' | 'andres_pesaje' | 'providencia_cr' | 'contadores_rep';

export const WhatsAppCommandHubModal: React.FC<WhatsAppCommandHubModalProps> = ({
  order,
  onClose,
  toast,
}) => {
  const [channel, setChannel] = useState<ChannelType>('contadores_prefactura');
  const [phone, setPhone] = useState('');

  const ocFolio = order?.oc || order?.folio || '120267114114';
  const cliente = order?.client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
  const totalKilos = order?.totalKilograms || order?.deliveries?.reduce((s, d) => s + (d.kilos || 0), 0) || 1000;
  const kilosEntregados = order?.deliveries?.reduce((s, d) => s + (d.kilos || 0), 0) || totalKilos;
  const subtotal = totalKilos * 43.0;
  const iva = subtotal * 0.16;
  const total = subtotal + iva;

  const firstInvoice = order?.invoices?.[0];
  const folioFactura = firstInvoice?.folio || '6198';
  const contrarecibo = firstInvoice ? extractCr(firstInvoice, order) : 'TH-1024';

  const getMessageText = (): string => {
    switch (channel) {
      case 'contadores_prefactura':
        return `*SOLICITUD DE FACTURACIÓN (PREFACTURA OFICIAL)*
Estimado Contador, buen día.

Favor de timbrar la siguiente factura para Providencia:

🏢 *Receptor:* GRUPO TEXTIL PROVIDENCIA SA DE CV
📋 *RFC:* GTP930115PU1
📍 *C.P.:* 90800
📦 *Partida:* Bulto Polietileno (${totalKilos.toLocaleString('es-MX')} kg)
💰 *Precio Unitario:* $43.00 / kg + 16% IVA
💵 *Subtotal:* ${money(subtotal)} | *Total con IVA:* ${money(total)}
🔑 *Clave SAT:* 24141500 | *Unidad:* KGM
💳 *Método de Pago:* PPD (Pago en parcialidades o diferido)
💳 *Forma de Pago:* 99 (Por definir)
📝 *Nota en CFDI:* OC ${ocFolio}

Adjunto el formato en Excel correspondiente. ¡Gracias!`;

      case 'andres_pesaje':
        return `*REPORTE OFICIAL DE PESAJE EN BÁSCULA*
Hola Andrés, te compartimos el pesaje recibido en patio:

📦 *Orden de Compra:* ${ocFolio}
⚖️ *Kilos Recibidos:* ${kilosEntregados.toLocaleString('es-MX')} kg
💲 *Costo Pactado:* $38.00 / kg (Cero mermas)
💰 *Monto a Liquidar:* ${money(kilosEntregados * 38.0)}
📅 *Fecha de Recepción:* ${fmtDate(new Date())}
🚛 *Estatus:* Mercancía descargada y validada en almacén Providencia.

Queda registrado en tu estado de cuenta. Saludos.`;

      case 'providencia_cr':
        return `*SEGUIMIENTO DE CONTRARECIBO Y PROGRAMACIÓN DE PAGO*
Estimado Depto. de Cuentas por Pagar (${cliente}):

Esperando se encuentren muy bien, solicitamos atentamente su apoyo para confirmar el estatus de pago:

📋 *Factura:* #${folioFactura}
📑 *Contrarecibo Oficial:* #${contrarecibo || 'En Trámite'}
📦 *OC:* ${ocFolio}
💰 *Monto Total:* ${money(total)}

🏦 *Datos Bancarios para Transferencia:*
• *Banco:* BBVA / Banco Azteca
• *CLABE:* 127680013898246811
• *Beneficiario:* Bolsas Elemental / Providencia

Agradecemos de antemano su amable confirmación de la fecha de depósito.`;

      case 'contadores_rep':
        return `*SOLICITUD DE COMPLEMENTO DE PAGO (REP)*
Estimado Contador:

Le informamos que Providencia ha liquidado el siguiente comprobante:

📋 *Factura Liquidada:* #${folioFactura}
📑 *Contrarecibo:* #${contrarecibo || 'Liquidado'}
💰 *Monto Depositado:* ${money(total)}
📅 *Fecha de Abono:* ${fmtDate(new Date())}
💳 *Forma de Pago:* 03 - Transferencia electrónica

Favor de emitir el CFDI de Recepción de Pagos (REP) timbrado y enviarnos el XML y PDF para nuestro expediente. ¡Muchas gracias!`;
    }
  };

  const message = getMessageText();

  const handleCopy = () => {
    triggerHaptic('success');
    navigator.clipboard.writeText(message);
    toast('📋 Mensaje copiado al portapapeles listo para pegar', 'ok');
  };

  const handleOpenWhatsApp = () => {
    triggerHaptic('success');
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        style={{
          background: 'var(--paper-raised, #1e293b)',
          border: '1px solid var(--line, rgba(255,255,255,0.1))',
          borderRadius: 20,
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Modal */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--line, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'linear-gradient(135deg, rgba(37, 211, 102, 0.12) 0%, rgba(18, 140, 126, 0.08) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: '#25D366',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.35)',
              }}
            >
              💬
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: 'var(--ink, #fff)' }}>
                WhatsApp Command Hub
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: 'var(--ink-soft, #94a3b8)' }}>
                Generador de mensajes institucionales con formato oficial en 1 clic.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 20,
              color: 'var(--ink-soft)',
              cursor: 'pointer',
              padding: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Canales / Pestañas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 6,
            padding: '12px 18px',
            background: 'var(--paper-sunk, rgba(0,0,0,0.2))',
            borderBottom: '1px solid var(--line, rgba(255,255,255,0.06))',
          }}
        >
          {[
            { id: 'contadores_prefactura', label: '👨‍💼 Contadores', sub: 'Prefactura $43' },
            { id: 'andres_pesaje', label: '🚚 Andrés', sub: 'Pesaje $38' },
            { id: 'providencia_cr', label: '🏢 Providencia', sub: 'Contrarecibos' },
            { id: 'contadores_rep', label: '🧾 Recibo REP', sub: 'Liquidado' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                triggerHaptic('light');
                setChannel(t.id as ChannelType);
              }}
              style={{
                borderRadius: 12,
                padding: '8px 10px',
                border: channel === t.id ? '1px solid #25D366' : '1px solid transparent',
                background: channel === t.id ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
                color: channel === t.id ? '#25D366' : 'var(--ink-soft)',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800 }}>{t.label}</div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{t.sub}</div>
            </button>
          ))}
        </div>

        {/* Contenido del Mensaje */}
        <div style={{ padding: '18px 24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
              📱 Teléfono (Opcional):
            </label>
            <input
              type="text"
              placeholder="ej. 5212461234567 (o dejar en blanco para elegir contacto)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--line, rgba(255,255,255,0.15))',
                background: 'var(--paper, rgba(255,255,255,0.05))',
                color: 'var(--ink, #fff)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              readOnly
              value={message}
              rows={11}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '14px 16px',
                borderRadius: 14,
                border: '1px solid var(--line, rgba(255,255,255,0.12))',
                background: 'var(--paper-sunk, rgba(0,0,0,0.3))',
                color: 'var(--ink, #fff)',
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'monospace',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Barra de Acciones */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--line, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            background: 'var(--paper-raised, #1e293b)',
          }}
        >
          <button
            onClick={handleCopy}
            className="btn"
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'var(--paper-sunk)',
              border: '1px solid var(--line)',
            }}
          >
            <span>📋</span>
            <span>Copiar Texto</span>
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onClose}
              className="btn"
              style={{ padding: '10px 18px', borderRadius: 12, fontWeight: 600, fontSize: 13 }}
            >
              Cerrar
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenWhatsApp}
              style={{
                padding: '10px 22px',
                borderRadius: 12,
                fontWeight: 800,
                fontSize: 13.5,
                color: '#fff',
                background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
              }}
            >
              <span>💬</span>
              <span>Abrir en WhatsApp</span>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
