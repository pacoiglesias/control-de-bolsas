import type { PurchaseOrder } from './types';
import type { ClientReportMetrics } from './clientReportTypes';
import { fmtDate, fmtDateFull, money } from './format';

export interface WhatsAppReportParams {
  order: PurchaseOrder;
  metrics: ClientReportMetrics;
  companyName?: string;
}

export function buildClientReportWhatsappMsg({ order, metrics: m, companyName }: WhatsAppReportParams): string {
  const client = order.client || 'Estimado cliente';
  const folio = order.folio || order.oc || 'S/F';
  const empresa = companyName || 'Elemental Denim Bolsas';
  const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
  const nextDateStr = m.nextDate ? fmtDateFull(m.nextDate) : 'Por confirmar';

  const deliveryLines = m.deliveries
    .map((d, i) => {
      const fecha = d.date ? fmtDate(d.date) : '—';
      const docRef = d.docFolio ? ` (Rem. ${d.docFolio})` : '';
      const factStatus = d.invoiced ? '✅ Facturado' : '⏳ Pdte. factura';
      return `  ${i + 1}. ${fecha}${docRef}: *${Number(d.kilos).toLocaleString('es-MX')} kg* — ${factStatus}`;
    })
    .join('\n');

  const itemLines = m.items
    .map((it) => {
      const pedido = Number(it.quantity);
      const entregado = Number(it.deliveredQuantity || 0);
      const falta = Math.max(0, pedido - entregado);
      return `  • ${it.description}: ${entregado.toLocaleString('es-MX')} / ${pedido.toLocaleString('es-MX')} kg${falta > 0 ? ` (faltan ${falta.toLocaleString('es-MX')} kg)` : ' ✅'}`;
    })
    .join('\n');

  return [
    `📦 *REPORTE DE AVANCE — OC ${folio}*`,
    `_${empresa} · ${today}_`,
    ``,
    `Estimado(a) ${client},`,
    `Le compartimos el estado actualizado de su Orden de Compra:`,
    ``,
    `*📊 RESUMEN GENERAL*`,
    `• OC Oficial: ${folio}`,
    `• Total Pedido: *${m.totalKg.toLocaleString('es-MX')} kg*`,
    `• Entregado a la fecha: *${m.deliveredKg.toLocaleString('es-MX')} kg* (${m.fulfillPct}%)`,
    `• Pendiente de Entrega: *${m.remainingKg.toLocaleString('es-MX')} kg*`,
    `• Próxima Entrega Programada: 📅 *${nextDateStr}*`,
    ``,
    m.deliveries.length > 0 ? `*🚚 HISTORIAL DE ENTREGAS*\n${deliveryLines}` : '',
    ``,
    m.items.length > 0 ? `*📋 DETALLE POR PARTIDA*\n${itemLines}` : '',
    ``,
    `*💰 RESUMEN FINANCIERO*`,
    `• Material Entregado: ${money(m.deliveredAmountIva)} (c/IVA)`,
    `• Material Pendiente: ${money(m.pendingAmount)} (c/IVA)`,
    ``,
    `Estamos a sus órdenes para cualquier aclaración.`,
    `_${empresa}_`,
  ]
    .filter((l) => l !== '')
    .join('\n');
}
