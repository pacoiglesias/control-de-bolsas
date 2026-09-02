import { jsPDF } from 'jspdf';
import { fmtDateFull, fmtDateTimeFull } from './format';

export interface DeliveryRemissionData {
  folioRemision: string;
  oc: string;
  client: string;
  department?: string;
  date: Date | string | number | null;
  providerName?: string;
  driverName?: string;
  truckPlates?: string;
  totalBags?: number;
  totalKilograms: number;
  notes?: string;
  items?: {
    code?: string;
    description: string;
    quantity: number;
    unit?: string;
    bags?: number;
  }[];
}

export function generateDeliveryRemissionPdf(data: DeliveryRemissionData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // 1. Cabecera Corporativa Membretada
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(margin, y, pageWidth - margin * 2, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('CONTROL DE BOLSAS ERP — VALE DE BÁSCULA & REMISIÓN', margin + 8, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text('COMPROBANTE OFICIAL DE PESAJE Y ENTREGA DE MERCANCÍA', margin + 8, y + 18);
  doc.text(`Fecha y Hora de Emisión: ${fmtDateTimeFull(new Date())}`, margin + 8, y + 23);

  // Folio en badge superior derecho
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(pageWidth - margin - 45, y + 5, 38, 18, 2, 2, 'F');
  doc.setTextColor(56, 189, 248); // Sky 400
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('REMISIÓN FOLIO', pageWidth - margin - 26, y + 11, { align: 'center' });
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text(data.folioRemision || 'S/N', pageWidth - margin - 26, y + 18, { align: 'center' });

  y += 35;

  // 2. Información del Cliente y Orden de Compra
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 32, 2, 2, 'FD');

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DESTINATARIO / PLANTA:', margin + 6, y + 7);
  doc.text('ORDEN DE COMPRA (OC):', margin + 105, y + 7);

  doc.setTextColor(15, 23, 42);
  doc.setFontSize(10.5);
  doc.text(data.client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV', margin + 6, y + 14);
  doc.text(`OC ${data.oc || 'S/N'}`, margin + 105, y + 14);

  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('DEPARTAMENTO / ÁREA:', margin + 6, y + 22);
  doc.text('FECHA DE ENTREGA:', margin + 105, y + 22);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(data.department || 'ALMACÉN GENERAL', margin + 6, y + 28);
  doc.text(fmtDateFull(data.date), margin + 105, y + 28);

  y += 38;

  // 3. Datos de Logística y Transporte
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 22, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('PROVEEDOR / MAQUILADOR:', margin + 6, y + 6);
  doc.text('OPERADOR / CHOFER:', margin + 65, y + 6);
  doc.text('PLACAS / UNIDAD:', margin + 125, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(data.providerName || 'Andrés', margin + 6, y + 14);
  doc.text(data.driverName || 'Conductor Asignado', margin + 65, y + 14);
  doc.text(data.truckPlates || 'Placas en Tránsito', margin + 125, y + 14);

  y += 28;

  // 4. Tabla de Partidas y Desglose de Pesaje
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CÓDIGO', margin + 4, y + 5.5);
  doc.text('DESCRIPCIÓN DE MERCANCÍA', margin + 35, y + 5.5);
  doc.text('BULTOS', margin + 120, y + 5.5, { align: 'right' });
  doc.text('KILOS NETOS', pageWidth - margin - 6, y + 5.5, { align: 'right' });

  y += 8;

  const items = data.items && data.items.length > 0 ? data.items : [
    {
      code: 'BOL-ESP',
      description: `Bolsa de Plástico para Empaque (Amparo OC ${data.oc || 'S/N'})`,
      bags: data.totalBags || 0,
      quantity: data.totalKilograms || 0,
    }
  ];

  let totalBultos = 0;
  let totalKilos = 0;

  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, y, pageWidth - margin * 2, 8, 'F');

    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + 8, pageWidth - margin, y + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);

    doc.text(item.code || 'BOL-01', margin + 4, y + 5.5);
    doc.text(item.description.substring(0, 48), margin + 35, y + 5.5);
    doc.text(item.bags ? `${item.bags} bultos` : '—', margin + 120, y + 5.5, { align: 'right' });
    doc.text(`${(item.quantity || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg`, pageWidth - margin - 6, y + 5.5, { align: 'right' });

    totalBultos += item.bags || 0;
    totalKilos += item.quantity || 0;
    y += 8;
  });

  // Totales
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, pageWidth - margin * 2, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL DE MERCANCÍA ENTREGADA EN BÁSCULA:', margin + 4, y + 6.5);
  if (totalBultos > 0) {
    doc.text(`${totalBultos} bultos`, margin + 120, y + 6.5, { align: 'right' });
  }
  doc.setTextColor(2, 132, 199); // Sky 600
  doc.text(`${(data.totalKilograms || totalKilos).toLocaleString('es-MX', { minimumFractionDigits: 2 })} KG`, pageWidth - margin - 6, y + 6.5, { align: 'right' });

  y += 18;

  // 5. Notas de Báscula
  if (data.notes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('OBSERVACIONES DE RECEPCIÓN / CALIDAD:', margin, y);
    y += 4;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(data.notes, margin, y);
    y += 12;
  }

  // 6. Firmas de Entrega y Recepción
  y = Math.max(y, 195);

  const colWidth = (pageWidth - margin * 2 - 20) / 2;

  // Firma Entregó (Chofer / Proveedor)
  doc.setDrawColor(148, 163, 184);
  doc.line(margin, y + 25, margin + colWidth, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('ENTREGÓ / CHOFER / MAQUILADOR', margin + colWidth / 2, y + 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(data.driverName || data.providerName || 'Andrés', margin + colWidth / 2, y + 35, { align: 'center' });

  // Firma Recibió (Almacén Providencia)
  doc.line(margin + colWidth + 20, y + 25, pageWidth - margin, y + 25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('RECIBIÓ / ALMACÉN & BÁSCULA', margin + colWidth + 20 + colWidth / 2, y + 30, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Nombre, Firma y Sello de Almacén', margin + colWidth + 20 + colWidth / 2, y + 35, { align: 'center' });

  // Pie de página oficial
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    'Este comprobante ampara la entrega física de material en báscula y forma parte de la conciliación de la Orden de Compra.',
    pageWidth / 2,
    265,
    { align: 'center' }
  );

  return doc;
}
