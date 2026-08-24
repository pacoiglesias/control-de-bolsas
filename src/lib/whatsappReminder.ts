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
  managerTH?: string;
  managerGT?: string;
  deptNameTH?: string;
  deptNameGT?: string;
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
  managerTH = 'Lic. Nava',
  managerGT = 'Lic. Evelia',
  deptNameTH = 'Textil Hogar',
  deptNameGT = 'Grupo Textil',
}: CollectionNoticeParams): string {
  const crText = contrarecibo && contrarecibo.trim() !== '' ? ` con Contrarecibo *#${contrarecibo}*` : '';
  const dateText = fechaVencimiento ? fmtDate(fechaVencimiento) : 'Vigente';
  
  // Responsables oficiales configurables: TH (Nava), GT (Evelia)
  const isTH = cliente.toUpperCase().includes('TH') || (contrarecibo || '').toUpperCase().startsWith('TH');
  const isGT = cliente.toUpperCase().includes('GT') || (contrarecibo || '').toUpperCase().startsWith('GT');
  const manager = responsable || (
    isTH
      ? `${managerTH} (${deptNameTH})`
      : isGT
        ? `${managerGT} (${deptNameGT})`
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

export interface InstitutionalEmailDraft {
  to: string;
  subject: string;
  body: string;
}

export function generateInstitutionalEmailDraft({
  folioFactura,
  contrarecibo,
  cliente = 'Providencia',
  responsable,
  monto,
  fechaVencimiento,
  clabe = '127680013898246811',
  banco = 'Banco Azteca / BBVA',
  managerTH = 'Lic. Nava',
  managerGT = 'Lic. Evelia',
  deptNameTH = 'Textil Hogar',
  deptNameGT = 'Grupo Textil',
}: CollectionNoticeParams): InstitutionalEmailDraft {
  const crText = contrarecibo && contrarecibo.trim() !== '' ? ` / CR #${contrarecibo}` : '';
  const dateText = fechaVencimiento ? fmtDate(fechaVencimiento) : 'Vigente';
  
  // Responsables oficiales configurables
  const isTH = cliente.toUpperCase().includes('TH') || (contrarecibo || '').toUpperCase().startsWith('TH');
  const isGT = cliente.toUpperCase().includes('GT') || (contrarecibo || '').toUpperCase().startsWith('GT');
  const manager = responsable || (
    isTH
      ? `${managerTH} (${deptNameTH})`
      : isGT
        ? `${managerGT} (${deptNameGT})`
        : ''
  );
  const atnText = manager ? `\nAtención: ${manager}` : '';

  const subject = `Seguimiento de Pago — Factura #${folioFactura}${crText} — Bolsas Elemental`;
  const body = `Estimado Depto. de Cuentas por Pagar (${cliente}):${atnText}

Por medio del presente correo, nos permitimos dar formal seguimiento al pago de la siguiente factura programada:

• Factura: #${folioFactura}${contrarecibo ? ` (Contrarecibo: #${contrarecibo})` : ''}
• Importe Total: ${money(monto)}
• Fecha Programada: ${dateText}

Datos Bancarios para Transferencia:
• Banco: ${banco}
• CLABE Interbancaria: ${clabe}
• Beneficiario: Bolsas Elemental / Providencia

Agradecemos de antemano confirmar la programación de la transferencia. Quedamos atentos para cualquier aclaración.

Atentamente,
Administración & Cobranza
Bolsas y Empaques Elemental`;

  return {
    to: 'cuentasporpagar@providencia.com.mx',
    subject,
    body,
  };
}

export function openInstitutionalEmail(draft: InstitutionalEmailDraft): void {
  const url = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
  window.location.href = url;
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

export function generateAndresWhatsAppSummary({
  providerName = 'Andrés',
  totalPagado,
  totalPurchasesCost,
  totalReceivedKilos,
  saldoProveedor,
  costPricePerKg = 38,
}: {
  providerName?: string;
  totalPagado: number;
  totalPurchasesCost: number;
  totalReceivedKilos: number;
  saldoProveedor: number;
  costPricePerKg?: number;
}): string {
  const saldoSigno = saldoProveedor >= 0 ? `Saldo a favor de ${providerName} (Anticipos vigentes)` : `Saldo a favor de la Empresa (Deuda pendiente)`;
  return `📊 *Estado de Cuenta — ${providerName}*
📅 *Fecha:* ${fmtDate(new Date())}

📦 *Kilos Entregados:* ${totalReceivedKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (a $${costPricePerKg.toFixed(2)}/kg)
💵 *Valor Total Entregas:* ${money(totalPurchasesCost)}
💳 *Total Anticipos / Pagos Realizados:* ${money(totalPagado)}

⚖️ *Saldo Conciliado:* ${saldoProveedor < 0 ? '-' : '+'}${money(Math.abs(saldoProveedor))}
📌 *Estatus:* ${saldoSigno}

_Control de Bolsas ERP — Estado de Cuenta Oficial._`;
}

