import * as XLSX from 'xlsx';
import type { PurchaseOrder } from './types';
import type { ClientReportMetrics } from './clientReportTypes';
import { fmtDate } from './format';

export interface ExcelReportParams {
  order: PurchaseOrder;
  metrics: ClientReportMetrics;
  companyName?: string;
}

export function exportClientReportToExcel({ order, metrics: m, companyName }: ExcelReportParams): void {
  const folio = order.folio || order.oc || 'S/F';
  const client = order.client || 'Cliente';
  const empresa = companyName || 'Elemental Denim Bolsas';
  const today = new Date().toLocaleDateString('es-MX', { dateStyle: 'long' });
  const nextDateStr = m.nextDate ? fmtDate(m.nextDate) : 'Por confirmar';

  const wb = XLSX.utils.book_new();

  // ─── HOJA 1: RESUMEN ──────────────────────────────────────────────────────
  const resumenData: (string | number)[][] = [
    [`REPORTE DE AVANCE — OC ${folio}`],
    [`${empresa} · Generado: ${today}`],
    [''],
    ['INFORMACIÓN DE LA ORDEN'],
    ['OC Oficial', folio],
    ['Cliente', client],
    ['Empresa Proveedora', empresa],
    ['Fecha del Reporte', today],
    [''],
    ['MÉTRICAS DE CUMPLIMIENTO'],
    ['Concepto', 'Kilos', 'Monto (con IVA)'],
    ['Total Pedido en OC', m.totalKg, m.totalKg * m.salePrice * 1.16],
    ['Entregado a la Fecha', m.deliveredKg, m.deliveredAmountIva],
    ['Pendiente de Entrega', m.remainingKg, m.pendingAmount],
    ['Kilos Facturados', m.invoicedKg, m.invoicedKg * m.salePrice * 1.16],
    ['Kilos Pendientes de Facturar', m.pendingInvoiceKg, m.pendingInvoiceKg * m.salePrice * 1.16],
    [''],
    ['Porcentaje de Cumplimiento', `${m.fulfillPct}%`],
    ['Precio por Kilogramo (sin IVA)', m.salePrice],
    ['Próxima Entrega Programada', nextDateStr],
    ['Kilos Comprometidos Próxima Entrega', m.remainingKg],
  ];

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  wsResumen['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 22 }];

  if (wsResumen['A1']) wsResumen['A1'].s = { font: { bold: true, sz: 14 } };
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // ─── HOJA 2: HISTORIAL DE ENTREGAS ────────────────────────────────────────
  const entregasHeaders = ['#', 'Fecha', 'Remisión / Folio', 'Kilos Entregados', 'Estatus Factura', 'Factura ID', 'Notas / Observaciones'];
  const entregasRows = m.deliveries.map((d, i) => [
    i + 1,
    d.date ? fmtDate(d.date) : '—',
    d.docFolio ? `Rem. ${d.docFolio}` : (d.docType || '—'),
    Number(d.kilos) || 0,
    d.invoiced ? 'FACTURADO' : 'PENDIENTE DE FACTURAR',
    d.invoiceId || '—',
    d.notes || '',
  ]);

  const totalEntregado = m.deliveries.reduce((s, d) => s + (Number(d.kilos) || 0), 0);
  entregasRows.push(['', '', 'TOTAL ENTREGADO:', totalEntregado, '', '', '']);

  const wsEntregas = XLSX.utils.aoa_to_sheet([entregasHeaders, ...entregasRows]);
  wsEntregas['!cols'] = [
    { wch: 5 }, { wch: 14 }, { wch: 20 }, { wch: 18 },
    { wch: 24 }, { wch: 18 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsEntregas, 'Historial de Entregas');

  // ─── HOJA 3: DETALLE POR PARTIDA ──────────────────────────────────────────
  const partidasHeaders = [
    'Código', 'Descripción del Producto',
    'Kilos Pedidos (OC)', 'Kilos Entregados', 'Kilos Faltantes',
    '% Avance', 'Valor Pendiente (c/IVA)', 'Estatus',
  ];
  const partidasRows = m.items.map((it) => {
    const pedido = Number(it.quantity) || 0;
    const entregado = Number(it.deliveredQuantity || 0);
    const falta = Math.max(0, pedido - entregado);
    const avance = pedido > 0 ? Math.round((entregado / pedido) * 1000) / 10 : 0;
    const valorPendiente = falta * m.salePrice * 1.16;
    const estatus = falta <= 0 ? 'COMPLETO ✓' : falta < pedido * 0.1 ? 'CASI COMPLETO' : 'PENDIENTE';
    return [
      it.code || '—',
      it.description,
      pedido,
      entregado,
      falta,
      `${avance}%`,
      valorPendiente,
      estatus,
    ];
  });

  const totalPedido = m.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
  const totalEntregadoP = m.items.reduce((s, it) => s + (Number(it.deliveredQuantity || 0)), 0);
  const totalFaltaP = Math.max(0, totalPedido - totalEntregadoP);
  partidasRows.push([
    '', 'TOTALES',
    totalPedido, totalEntregadoP, totalFaltaP,
    `${totalPedido > 0 ? Math.round((totalEntregadoP / totalPedido) * 1000) / 10 : 0}%`,
    totalFaltaP * m.salePrice * 1.16,
    '',
  ]);

  const wsPartidas = XLSX.utils.aoa_to_sheet([partidasHeaders, ...partidasRows]);
  wsPartidas['!cols'] = [
    { wch: 18 }, { wch: 45 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 12 }, { wch: 22 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsPartidas, 'Detalle por Partida');

  // ─── Descargar ────────────────────────────────────────────────────────────
  const fileName = `Reporte_OC_${folio.replace(/\//g, '-')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
