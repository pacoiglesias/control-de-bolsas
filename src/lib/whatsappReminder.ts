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

export function generateAndresEmailDraft({
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
}): InstitutionalEmailDraft {
  const saldoSigno = saldoProveedor >= 0 ? `Saldo a favor de ${providerName} (Anticipos vigentes)` : `Saldo a favor de la Empresa (Deuda pendiente)`;
  const subject = `Estado de Cuenta Conciliado — ${providerName} — ${fmtDate(new Date())}`;
  const body = `Estimado ${providerName},

Adjuntamos el resumen oficial de tu Estado de Cuenta y Maquila al día de hoy ${fmtDate(new Date())}:

• Kilos Totales Entregados: ${totalReceivedKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (Costo: $${costPricePerKg.toFixed(2)}/kg)
• Valor Total de Entregas: ${money(totalPurchasesCost)}
• Anticipos / Pagos Realizados: ${money(totalPagado)}
--------------------------------------------------
• Saldo Conciliado: ${saldoProveedor < 0 ? '-' : '+'}${money(Math.abs(saldoProveedor))}
• Estatus de Saldo: ${saldoSigno}

Quedamos a tus órdenes para cualquier duda o conciliación.

Atentamente,
Administración — Control de Bolsas ERP`;

  return {
    to: '',
    subject,
    body,
  };
}

export function openEmailMessage(subject: string, body: string, to = ''): void {
  const url = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

/**
 * Genera el mensaje estructurado de WhatsApp para solicitar el timbrado fiscal de una prefactura al contador.
 */
export function generatePrefacturaContadorMessage({
  oc,
  client,
  kilos,
  subtotal,
  iva,
  total,
  itemsCount,
}: {
  oc: string;
  client: string;
  kilos: number;
  subtotal: number;
  iva: number;
  total: number;
  itemsCount: number;
}): string {
  return `📄 *SOLICITUD DE FACTURACIÓN (PREFACTURA)*

Estimado Contador, buen día.

Le comparto los datos para el timbrado del CFDI correspondiente a Providencia:

🏢 *Receptor:* GRUPO TEXTIL PROVIDENCIA SA DE CV
📑 *RFC:* GTP930115PU1
📍 *Uso CFDI:* G01 - Adquisición de mercancías
📦 *Orden de Compra:* OC ${oc} (${client})
⚖️ *Kilos de Báscula:* ${kilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${itemsCount} partida${itemsCount === 1 ? '' : 's'})

💵 *Subtotal:* $${subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
🏛️ *IVA (16%):* $${iva.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
🧾 *TOTAL FACTURA:* $${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}

📋 *Condiciones Fiscales:*
• Método de Pago: PPD
• Forma de Pago: 99 por definir
• Clave SAT: 24141500 | Unidad: KGM
• Nota en Factura: OC ${oc}

Le adjunto el archivo de Excel oficial (.xlsx). Quedo atento al envío del PDF y XML timbrados. ¡Muchas gracias!`;
}

/**
 * Genera el mensaje estructurado de WhatsApp para solicitar el Complemento de Pago (REP / CFDI de Pago) al contador.
 */
export function generateComplementoPagoContadorMessage({
  folioFactura,
  contrarecibo,
  cliente = 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
  montoPagado,
  fechaPago = new Date(),
  formaPago = '03 - Transferencia electrónica de fondos',
  oc,
}: {
  folioFactura: string;
  contrarecibo?: string;
  cliente?: string;
  montoPagado: number;
  fechaPago?: any;
  formaPago?: string;
  oc?: string;
}): string {
  const crText = contrarecibo ? `\n📑 *Contrarecibo Liquidado:* ${contrarecibo}` : '';
  const ocText = oc ? `\n📦 *Orden de Compra:* OC ${oc}` : '';
  return `📄 *SOLICITUD DE COMPLEMENTO DE PAGO (CFDI DE RECEPCIÓN DE PAGOS - REP)*

Estimado Contador, buen día.

Le informo que Providencia ya realizó el pago de la siguiente factura emitida:

🏢 *Cliente / Receptor:* ${cliente}
📑 *Factura Pagada:* Factura #${folioFactura}${crText}${ocText}
💵 *Monto Transferido / Liquidado:* $${montoPagado.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
📅 *Fecha de Pago / Abono:* ${fmtDate(fechaPago)}
💳 *Forma de Pago:* ${formaPago}

Favor de emitir el *Complemento de Pago (REP)* correspondiente y enviarnos el PDF y XML timbrados para hacer la entrega a Providencia.

¡Muchas gracias!`;
}

/**
 * Genera el mensaje estructurado de WhatsApp para exigir al proveedor (Andrés)
 * la entrega de los kilos faltantes de una Orden de Compra o coordinar el cierre.
 */
export function generateReclamarKilosAndresMessage({
  oc,
  client = 'Providencia',
  totalKg,
  entregadosKg,
  faltantesKg,
  providerName = 'Andrés',
  deliveriesCount = 0,
}: {
  oc: string;
  client?: string;
  totalKg: number;
  entregadosKg: number;
  faltantesKg: number;
  providerName?: string;
  deliveriesCount?: number;
}): string {
  const pct = totalKg > 0 ? ((entregadosKg / totalKg) * 100).toFixed(1) : '0';
  return `📦 *SEGUIMIENTO DE KILOS PENDIENTES — OC ${oc}*

Hola ${providerName}, buen día.

Te escribo para revisar el avance de entrega de la orden de compra *OC ${oc}* (${client}):

• *Meta Contratada:* ${totalKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
• *Kilos Entregados:* ${entregadosKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${deliveriesCount > 0 ? `${deliveriesCount} viajes recibidos · ` : ''}${pct}%)
• 🚨 *KILOS FALTANTES POR ENVIAR:* *${faltantesKg.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg*

Necesitamos coordinar cuándo sale el siguiente viaje para completar el pedido en planta de Providencia, o si ya no tienes material para cerrar la orden formalmente en sistema.

¿Para qué fecha programas la entrega del resto? Quedo al pendiente, gracias.`;
}

/**
 * Genera el estado de cuenta y reporte semanal consolidado de maquila para el proveedor (Andrés),
 * agrupando todas las OCs activas con kilos pedidos, entregados en báscula y faltantes.
 */
export function generateEstadoCuentaSemanalAndresMessage({
  providerName = 'Andrés',
  totalKilosPedidos,
  totalKilosEntregados,
  totalKilosFaltantes,
  totalViajes = 0,
  costoKg = 38,
  desgloseOcs = [],
}: {
  providerName?: string;
  totalKilosPedidos: number;
  totalKilosEntregados: number;
  totalKilosFaltantes: number;
  totalViajes?: number;
  costoKg?: number;
  desgloseOcs?: Array<{
    oc: string;
    cliente: string;
    pedidosKg: number;
    entregadosKg: number;
    faltantesKg: number;
    viajesCount?: number;
  }>;
}): string {
  const pctGlobal = totalKilosPedidos > 0 ? ((totalKilosEntregados / totalKilosPedidos) * 100).toFixed(1) : '0';
  const importeMaterialFaltante = totalKilosFaltantes * costoKg;

  let msg = `📋 *ESTADO DE CUENTA Y RESUMEN SEMANAL DE MAQUILA — BOLSAS ELEMENTAL / PROVIDENCIA*\n\n`;
  msg += `Hola ${providerName}, buen día.\n\n`;
  msg += `Te comparto el consolidado semanal de entregas en báscula y kilos pendientes en planta al día de hoy:\n\n`;
  msg += `• *Meta Total Contratada:* ${totalKilosPedidos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg\n`;
  msg += `• *Kilos Entregados en Planta:* ${totalKilosEntregados.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg (${totalViajes} viajes · ${pctGlobal}%)\n`;
  msg += `• 🚨 *TOTAL KILOS PENDIENTES DE ENVIAR:* *${totalKilosFaltantes.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg*\n`;
  msg += `• 💵 *Valor en Maquila ($${costoKg.toFixed(2)}/kg):* $${importeMaterialFaltante.toLocaleString('es-MX', { minimumFractionDigits: 2 })}\n\n`;

  if (desgloseOcs.length > 0) {
    msg += `📦 *DESGLOSE POR ORDEN DE COMPRA (OC):*\n`;
    desgloseOcs.forEach((item, idx) => {
      const pct = item.pedidosKg > 0 ? ((item.entregadosKg / item.pedidosKg) * 100).toFixed(0) : '0';
      msg += `\n${idx + 1}. *OC ${item.oc}* (${item.cliente})\n`;
      msg += `   - Entregado: ${item.entregadosKg.toLocaleString('es-MX')} / ${item.pedidosKg.toLocaleString('es-MX')} kg (${pct}%)\n`;
      if (item.faltantesKg > 0.01) {
        msg += `   - ⏳ *Faltan por surtir:* *${item.faltantesKg.toLocaleString('es-MX')} kg*\n`;
      } else {
        msg += `   - ✅ Surtido 100%\n`;
      }
    });
    msg += `\n`;
  }

  msg += `Necesitamos coordinar la programación de viajes de esta semana para no atrasar la entrega en las plantas de Providencia, o confirmar si alguna orden se cierra con lo entregado.\n\n`;
  msg += `¿Qué días de esta semana tienes salida de camión? Quedamos al pendiente, muchas gracias.`;

  return msg;
}

