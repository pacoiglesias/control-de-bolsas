import { money, fmtDate } from './format';

export interface CollectionNoticeParams {
  folioFactura: string;
  contrarecibo?: string;
  cliente?: string;
  responsable?: string;
  monto: number;
  fechaVencimiento?: any;
  clabe?: string;
  banco?: string;
}

export function generateCollectionNotice({
  folioFactura,
  contrarecibo,
  cliente = 'Providencia',
  responsable,
  monto,
  fechaVencimiento,
  clabe = '127680013898246811',
  banco = 'Banco Azteca / BBVA',
}: CollectionNoticeParams): string {
  const crText = contrarecibo && contrarecibo.trim() !== '' ? ` con Contrarecibo *#${contrarecibo}*` : '';
  const dateText = fechaVencimiento ? fmtDate(fechaVencimiento) : 'Vigente';
  
  // Responsables oficiales: Textil Hogar TH -> Nava, Grupo Textil GT -> Evelia
  const manager = responsable || (
    cliente.toUpperCase().includes('TH') || (contrarecibo || '').toUpperCase().startsWith('TH')
      ? 'Lic. Nava (Textil Hogar)'
      : cliente.toUpperCase().includes('GT') || (contrarecibo || '').toUpperCase().startsWith('GT')
        ? 'Lic. Evelia (Grupo Textil)'
        : ''
  );
  const atnText = manager ? `\n👤 *Atención:* ${manager}` : '';

  return `Estimado Depto. de Cuentas por Pagar (${cliente}):${atnText}

Le enviamos un cordial saludo. Nos permitimos dar seguimiento al pago de la siguiente factura:

📋 *Factura:* #${folioFactura}${crText}
💰 *Importe:* ${money(monto)}
📅 *Fecha de Programación:* ${dateText}

🏦 *Datos de Transferencia:*
• *Banco:* ${banco}
• *CLABE:* ${clabe}
• *Beneficiario:* Bolsas Elemental / Providencia

Agradecemos de antemano confirmar la programación de la transferencia. Quedamos atentos para cualquier aclaración.`;
}

export function openWhatsAppMessage(text: string, phone = ''): void {
  const cleanPhone = phone.replace(/\D/g, '');
  const encoded = encodeURIComponent(text);
  const url = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  return new Promise((resolve, reject) => {
    try {
      document.execCommand('copy');
      textArea.remove();
      resolve();
    } catch (err) {
      textArea.remove();
      reject(err);
    }
  });
}
