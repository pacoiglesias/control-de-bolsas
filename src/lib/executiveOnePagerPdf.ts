import { jsPDF } from 'jspdf';
import { fmtDateFull, money } from './format';
import { extractCr, getOrderSummary, inferDepartment } from './finance';
import type { PurchaseOrder, Expense, FinancialConfig } from './types';

export interface ExecutiveOnePagerData {
  orders: PurchaseOrder[];
  expenses: Expense[];
  config?: FinancialConfig;
  settings?: any;
  saldoCaja: number;
  saldoAndres?: number;
}

export function generateExecutiveOnePagerPdf({
  orders,
  expenses: _expenses,
  config,
  settings,
  saldoCaja,
  saldoAndres = 0,
}: ExecutiveOnePagerData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const provName = settings?.providerName || 'Andrés';
  const saleKg = config?.salePricePerKg || 43;

  // 1. Cabecera Ejecutiva (Navy Obsidian)
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('CONTROL DE BOLSAS ERP — REPORTE EJECUTIVO DIRECTIVO', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`Corte Operativo y Financiero · Emitido el: ${fmtDateFull(new Date())}`, margin + 6, y + 15);
  doc.text(`Cliente Principal: Grupo Textil Providencia SA de CV · Proveedor: ${provName}`, margin + 6, y + 20);

  // Badge en esquina derecha
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - margin - 38, y + 4, 32, 16, 2, 2, 'F');
  doc.setTextColor(56, 189, 248);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('ONE-PAGER', pageWidth - margin - 22, y + 10, { align: 'center' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.text('OFICIAL', pageWidth - margin - 22, y + 16, { align: 'center' });

  y += 28;

  // Cálculos consolidados
  let totalPorCobrar = 0;
  let totalKilosPedidos = 0;
  let totalKilosEntregados = 0;
  let totalKilosFacturados = 0;
  let thPedidos = 0;
  let thEntregados = 0;
  let thFacturado = 0;
  let gtPedidos = 0;
  let gtEntregados = 0;
  let gtFacturado = 0;

  const facturasSinCr: { folio: string; oc: string; total: number; dias: number; dept: string }[] = [];
  const hoy = Date.now();

  (orders || []).forEach((o) => {
    if (!o || (o as any).isDeleted) return;
    const s = getOrderSummary(o);
    const dept = inferDepartment(o) || (o.department?.toUpperCase().includes('TH') ? 'TH' : 'GT');
    const ped = Number(o.totalKilograms) || s.kilosDelivered || 0;

    totalKilosPedidos += ped;
    totalKilosEntregados += s.kilosDelivered;
    totalKilosFacturados += s.kilosInvoiced;
    totalPorCobrar += Math.max(0, s.invoiceTotal - s.paidAmount);

    if (dept === 'TH') {
      thPedidos += ped;
      thEntregados += s.kilosDelivered;
      thFacturado += s.invoiceTotal;
    } else {
      gtPedidos += ped;
      gtEntregados += s.kilosDelivered;
      gtFacturado += s.invoiceTotal;
    }

    (o.invoices || []).forEach((inv) => {
      const cr = extractCr(inv, o);
      const isPaid = inv.creditCycle?.status === 'paid' || inv.creditCycle?.status === 'collected';
      const totalInv = inv.financials?.invoiceTotal ?? ((inv.kilos || 0) * saleKg * 1.16);
      if (!cr && !isPaid && totalInv > 0) {
        let dias = 0;
        const issueD = inv.creditCycle?.issueDate ? new Date((inv.creditCycle.issueDate as any).toDate?.() || inv.creditCycle.issueDate) : null;
        if (issueD) dias = Math.max(0, Math.round((hoy - issueD.getTime()) / 86400000));
        facturasSinCr.push({
          folio: inv.folio || 'S/F',
          oc: o.folio || o.oc || 'S/OC',
          total: totalInv,
          dias,
          dept,
        });
      }
    });
  });

  // 2. Cuadrícula de 4 KPIs Maestros
  const kpiWidth = (pageWidth - margin * 2 - 9) / 4;
  const kpiHeight = 18;

  const kpis = [
    { title: 'EFECTIVO EN CAJA', val: money(saldoCaja), color: saldoCaja >= 0 ? [5, 150, 105] : [220, 38, 38] },
    { title: 'CARTERA POR COBRAR', val: money(totalPorCobrar), color: [217, 119, 6] },
    { title: `SALDO CON ${provName.toUpperCase()}`, val: money(saldoAndres), color: saldoAndres >= 0 ? [37, 99, 235] : [217, 119, 6] },
    { title: 'KILOS EN PLANTA', val: `${totalKilosEntregados.toLocaleString('es-MX')} kg`, color: [124, 58, 237] },
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiWidth + 3);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(kpiX, y, kpiWidth, kpiHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(kpi.title, kpiX + kpiWidth / 2, y + 5.5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, kpiX + kpiWidth / 2, y + 13, { align: 'center' });
  });

  y += kpiHeight + 6;

  // 3. Tabla Desglose por Planta (Textil Hogar vs Grupo Textil)
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('1. DESGLOSE OPERATIVO Y FINANCIERO POR PLANTA (PROVIDENCIA)', margin + 4, y + 4.2);

  y += 6;

  const thPct = thPedidos > 0 ? Math.round((thEntregados / thPedidos) * 100) : 0;
  const gtPct = gtPedidos > 0 ? Math.round((gtEntregados / gtPedidos) * 100) : 0;
  const thFlujo = thEntregados * 8.44;
  const gtFlujo = gtEntregados * 8.44;

  const plantHeaders = ['Planta / Responsable', 'Prefijo CR', 'Kilos Pedidos', 'Kilos Entregados', 'Avance %', 'Facturado c/IVA', 'Flujo Neto ($8.44/kg)'];
  const plantRows = [
    ['Textil Hogar (TH · Nava / Lamuño)', 'TH-', `${thPedidos.toLocaleString('es-MX')} kg`, `${thEntregados.toLocaleString('es-MX')} kg`, `${thPct}%`, money(thFacturado), money(thFlujo)],
    ['Grupo Textil (GT · Evelia / P4)', 'GT-', `${gtPedidos.toLocaleString('es-MX')} kg`, `${gtEntregados.toLocaleString('es-MX')} kg`, `${gtPct}%`, money(gtFacturado), money(gtFlujo)],
    ['TOTAL CONSOLIDADO', '—', `${totalKilosPedidos.toLocaleString('es-MX')} kg`, `${totalKilosEntregados.toLocaleString('es-MX')} kg`, `${totalKilosPedidos > 0 ? Math.round((totalKilosEntregados / totalKilosPedidos) * 100) : 0}%`, money(thFacturado + gtFacturado), money(thFlujo + gtFlujo)],
  ];

  const colWidths = [52, 20, 24, 24, 18, 26, 24];

  // Header tabla plantas
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);

  let curX = margin;
  plantHeaders.forEach((h, i) => {
    doc.text(h, curX + 2, y + 3.8);
    curX += colWidths[i];
  });

  y += 5.5;

  plantRows.forEach((row, rIdx) => {
    const isTotal = rIdx === plantRows.length - 1;
    doc.setFillColor(isTotal ? 248 : rIdx % 2 === 0 ? 255 : 250, isTotal ? 250 : rIdx % 2 === 0 ? 255 : 250, isTotal ? 252 : rIdx % 2 === 0 ? 255 : 250);
    doc.rect(margin, y, pageWidth - margin * 2, 5.5, 'F');
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(isTotal ? 15 : 51, isTotal ? 23 : 65, isTotal ? 42 : 85);

    let cellX = margin;
    row.forEach((cell, cIdx) => {
      doc.text(String(cell), cellX + 2, y + 3.8);
      cellX += colWidths[cIdx];
    });
    y += 5.5;
  });

  y += 4;

  // 4. Sección Facturas en Espera de Contrarecibo
  doc.setFillColor(217, 119, 6);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(`2. FACTURAS EMITIDAS EN ESPERA DE CONTRARECIBO (${facturasSinCr.length} PENDIENTES — ${money(facturasSinCr.reduce((s, x) => s + x.total, 0))})`, margin + 4, y + 4.2);

  y += 6;

  if (facturasSinCr.length === 0) {
    doc.setFillColor(240, 253, 244);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(22, 101, 52);
    doc.text('✓ Todas las facturas emitidas cuentan con número de Contrarecibo oficial de Providencia.', margin + 4, y + 5.2);
    y += 10;
  } else {
    const crColWidths = [28, 38, 24, 38, 32, 28];
    const crHeaders = ['Factura', 'Orden de Compra', 'Planta', 'Importe c/IVA', 'Días sin CR', 'Acción'];

    doc.setFillColor(254, 243, 199);
    doc.rect(margin, y, pageWidth - margin * 2, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);

    let hX = margin;
    crHeaders.forEach((h, i) => {
      doc.text(h, hX + 2, y + 3.5);
      hX += crColWidths[i];
    });

    y += 5;

    facturasSinCr.slice(0, 6).forEach((f, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 255 : 254, idx % 2 === 0 ? 255 : 252, idx % 2 === 0 ? 255 : 243);
      doc.rect(margin, y, pageWidth - margin * 2, 4.8, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);

      const isUrgente = f.dias >= 5;
      const rowVals = [
        `Fac. #${f.folio}`,
        f.oc,
        f.dept,
        money(f.total),
        isUrgente ? `🚨 ${f.dias} días (Urgente)` : `${f.dias} días`,
        f.dept === 'TH' ? 'Seguimiento Nava' : 'Seguimiento Evelia',
      ];

      let rX = margin;
      rowVals.forEach((val, cIdx) => {
        if (cIdx === 4 && isUrgente) {
          doc.setTextColor(185, 28, 28);
          doc.setFont('helvetica', 'bold');
        } else {
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'normal');
        }
        doc.text(val, rX + 2, y + 3.4);
        rX += crColWidths[cIdx];
      });

      y += 4.8;
    });

    if (facturasSinCr.length > 6) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(`... y ${facturasSinCr.length - 6} factura(s) adicionales en seguimiento.`, margin + 4, y + 4);
      y += 6;
    } else {
      y += 2;
    }
  }

  y += 2;

  // 5. Parámetros de Liquidación y Política Operativa
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, pageWidth - margin * 2, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('3. POLÍTICA DE LIQUIDACIÓN, COMPLEMENTOS REP Y MÁRGENES OFICIALES', margin + 4, y + 4.2);

  y += 6;

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, pageWidth - margin * 2, 14, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('• Venta Providencia: $43.00/kg (+16% IVA = $49.88) | Costo Compra Andrés: $38.00/kg neto (Cero mermas) | Margen Bruto: $5.00/kg.', margin + 4, y + 4.2);
  doc.text('• Liquidación Efectivo: Providencia transfiere a despacho contable; se descuenta 8% de comisión ($3.44/kg) y entregan $8.44/kg en efectivo.', margin + 4, y + 8.2);
  doc.text('• Complementos REP: Al cobrar cada contrarecibo, el sistema solicita automáticamente el timbrado del CFDI de Pagos (REP).', margin + 4, y + 12.2);

  y += 18;

  // 6. Líneas de Firmas y Validación
  const sigBoxWidth = (pageWidth - margin * 2 - 12) / 3;
  const sigY = pageHeight - margin - 22;

  const signatures = [
    { title: 'Dirección General & Tesorería', note: 'Elemental Denim SA de CV' },
    { title: `Control de Proveedor (${provName})`, note: 'Entrega en Báscula & Costos' },
    { title: 'Cuentas por Cobrar & Contabilidad', note: 'Comprobación Fiscal & REP' },
  ];

  signatures.forEach((sig, idx) => {
    const sigX = margin + idx * (sigBoxWidth + 6);
    doc.setDrawColor(100, 116, 139);
    doc.setLineWidth(0.5);
    doc.line(sigX + 4, sigY, sigX + sigBoxWidth - 4, sigY);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(sig.title, sigX + sigBoxWidth / 2, sigY + 4.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(sig.note, sigX + sigBoxWidth / 2, sigY + 8.5, { align: 'center' });
  });

  return doc;
}

export function downloadExecutiveOnePagerPdf(data: ExecutiveOnePagerData, customFileName?: string) {
  const doc = generateExecutiveOnePagerPdf(data);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = customFileName || `Resumen_Ejecutivo_ERP_Providencia_${dateStr}.pdf`;
  doc.save(fileName);
}
