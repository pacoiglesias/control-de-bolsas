import { escapeHtml, toDate, fmtDate } from '../../lib/format';
import { round2, computeFinancials } from '../../lib/finance';

export function openPrintHtml(html: string) {
  // 1. Intentar abrir ventana de impresión directamente
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      return;
    } catch (e) {
      console.warn('Error escribiendo en ventana de impresión, usando iframe:', e);
    }
  }

  // 2. Fallback infalible para móviles o navegadores con bloqueador de popups: Iframe invisible
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.zIndex = '-9999';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        console.error('Error al imprimir desde iframe:', err);
      } finally {
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 120_000);
      }
    }, 300);
  }
}

export function printRemision({ folio, oc, client, department, items, deliveredByItem, kilosNum, config, provName }: any) {
  const rawItems = items && items.length > 0 ? items : [];
  const itemsRows = rawItems.length > 0 ? rawItems.map((it: any, idx: number) => {
    const entregado = deliveredByItem ? (deliveredByItem[it.id] ?? it.deliveredQuantity ?? it.quantity ?? 0) : it.quantity;
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: #1e3a8a;">${escapeHtml(it.code || `P-${idx + 1}`)}</td>
        <td style="font-weight: 600;">${escapeHtml(it.description || 'Bolsa de Polietileno')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 600;">${Number(it.quantity || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: #047857;">${Number(entregado || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td style="font-family: monospace;">24141500</td>
      <td>Bolsa de Polietileno Transparente en Rollo</td>
      <td style="text-align: right; font-family: monospace;">${kilosNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td style="text-align: right; font-family: monospace; font-weight: 700;">${kilosNum.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</td>
    </tr>
  `;

  const totalKilosEntregados = rawItems.length > 0
    ? rawItems.reduce((sum: number, it: any) => sum + Number(deliveredByItem?.[it.id] ?? it.quantity ?? 0), 0)
    : kilosNum;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Remisión de Entrega - ${escapeHtml(folio || oc || 'S/F')}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 28px 36px; color: #0f172a; font-size: 13px; line-height: 1.4; max-width: 900px; margin: 0 auto; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 12.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
          th { background: #1e293b; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .total-box { margin-left: auto; width: 280px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px; margin-bottom: 30px; text-align: right; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
          .signature-line { border-top: 1px solid #475569; padding-top: 8px; font-weight: 700; font-size: 12px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 20px; font-weight: 900; color: #1e3a8a;">BOLSAS ELEMENTAL / PROVIDENCIA</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">REMISIÓN DE CONTROL DE ENTREGA Y BÁSCULA</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 900; color: #2563eb;">REMISIÓN #${escapeHtml(folio || 'S/F')}</div>
            <div style="font-size: 11.5px; color: #475569; margin-top: 2px;"><strong>Fecha:</strong> ${fmtDate(new Date())}</div>
            ${oc ? `<div style="font-size: 11.5px; color: #475569;"><strong>Orden de Compra (OC):</strong> ${escapeHtml(oc)}</div>` : ''}
          </div>
        </div>
        
        <div class="grid">
          <div>
            <div style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">DATOS DEL CLIENTE / DESTINO:</div>
            <strong>Cliente:</strong> ${escapeHtml(client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV')}<br>
            <strong>Departamento:</strong> ${escapeHtml(department) || 'TH / GT'}<br>
            <strong>Lugar de Entrega:</strong> Almacén de Providencia (Santa Ana Chiautempan, Tlaxcala)
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">DATOS DE LOGÍSTICA:</div>
            <strong>Fabricante:</strong> ${escapeHtml(provName || 'Andrés')}<br>
            <strong>Estatus:</strong> Entrega Física en Báscula<br>
            <strong>Clave SAT:</strong> ${escapeHtml(config?.satClaveProdServ || '24141500')} (Bolsas Polietileno)
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 130px;">Código Art.</th>
              <th>Descripción de la Partida / Medidas</th>
              <th style="width: 120px; text-align: right;">Cant. OC (kg)</th>
              <th style="width: 130px; text-align: right;">Entregado (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          <div style="font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase;">Total Kilos Remisionados:</div>
          <div style="font-size: 19px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 2px;">
            ${totalKilosEntregados.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
          </div>
        </div>

        <div class="signatures">
          <div>
            <div style="height: 45px;"></div>
            <div class="signature-line">Entregó: Chofer / ${escapeHtml(provName || 'Andrés')}</div>
          </div>
          <div>
            <div style="height: 45px;"></div>
            <div class="signature-line">Recibió en Almacén Providencia (Sello / Báscula)</div>
          </div>
        </div>

        <script>
          window.onafterprint = () => window.close();
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `;
  openPrintHtml(html);
}

export function printSingleDeliveryRemision({
  folio,
  oc,
  client,
  department,
  delivery,
  items,
  provName,
}: {
  folio?: string;
  oc?: string;
  client?: string;
  department?: string;
  delivery: { date: any; kilos: number; driver?: string; docFolio?: string; docType?: string; notes?: string; items?: any[] };
  items?: any[];
  provName?: string;
}) {
  const deliveryKilos = Number(delivery.kilos) || 0;
  const rawItems = items && items.length > 0 ? items : [];
  
  const itemsRows = rawItems.length > 0 ? rawItems.map((it: any, idx: number) => {
    const totalOrderKg = rawItems.reduce((s, i) => s + (i.quantity || 0), 0) || 1;
    const deliveryItemQty = delivery.items?.find((x: any) => x.itemId === it.id)?.quantity ?? (deliveryKilos * ((it.quantity || 0) / totalOrderKg));
    return `
      <tr>
        <td style="font-family: monospace; font-weight: 700; color: #1e3a8a;">${escapeHtml(it.code || `P-${idx + 1}`)}</td>
        <td style="font-weight: 600;">${escapeHtml(it.description || 'Bolsa de Polietileno')}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 600;">${Number(it.quantity || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
        <td style="text-align: right; font-family: monospace; font-weight: 700; color: #047857;">${Number(deliveryItemQty || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td style="font-family: monospace;">24141500</td>
      <td>Bolsa de Polietileno Transparente en Rollo</td>
      <td style="text-align: right; font-family: monospace;">${deliveryKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td style="text-align: right; font-family: monospace; font-weight: 700;">${deliveryKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg</td>
    </tr>
  `;

  const dateFormatted = fmtDate(delivery.date) || fmtDate(new Date());
  const remisionNumber = delivery.docFolio || folio || oc || 'S/F';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Remisión de Entrega #${escapeHtml(remisionNumber)}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; padding: 28px 36px; color: #0f172a; font-size: 13px; line-height: 1.4; max-width: 900px; margin: 0 auto; }
          .header { border-bottom: 2px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 12.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
          th { background: #1e293b; color: #ffffff; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .total-box { margin-left: auto; width: 300px; background: #f0fdf4; border: 1.5px solid #16a34a; border-radius: 8px; padding: 12px 16px; margin-bottom: 30px; text-align: right; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; text-align: center; }
          .signature-line { border-top: 1px solid #475569; padding-top: 8px; font-weight: 700; font-size: 12px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div style="font-size: 20px; font-weight: 900; color: #1e3a8a;">BOLSAS ELEMENTAL / PROVIDENCIA</div>
            <div style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">COMPROBANTE DE ENTREGA Y RECEPCIÓN EN BÁSCULA</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 16px; font-weight: 900; color: #2563eb;">REMISIÓN #${escapeHtml(remisionNumber)}</div>
            <div style="font-size: 11.5px; color: #475569; margin-top: 2px;"><strong>Fecha Entrega:</strong> ${dateFormatted}</div>
            ${oc ? `<div style="font-size: 11.5px; color: #475569;"><strong>Orden de Compra:</strong> ${escapeHtml(oc)}</div>` : ''}
          </div>
        </div>
        
        <div class="grid">
          <div>
            <div style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">DATOS DEL CLIENTE / RECEPTOR:</div>
            <strong>Cliente:</strong> ${escapeHtml(client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV')}<br>
            <strong>Departamento:</strong> ${escapeHtml(department) || 'TH / GT'}<br>
            <strong>Destino:</strong> Almacén de Providencia
          </div>
          <div style="text-align: right;">
            <div style="font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">DATOS DE TRASLADO / TRANSPORTE:</div>
            <strong>Chofer / Entrega:</strong> ${escapeHtml(delivery.driver || provName || 'Andrés')}<br>
            <strong>Tipo:</strong> ${delivery.docType === 'factura' ? 'Factura Directa' : 'Remisión de Báscula'}<br>
            ${delivery.notes ? `<strong>Notas:</strong> ${escapeHtml(delivery.notes)}` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 130px;">Código Art.</th>
              <th>Descripción de la Partida / Medidas</th>
              <th style="width: 120px; text-align: right;">Cant. OC (kg)</th>
              <th style="width: 130px; text-align: right;">Entregado Esta Remisión (kg)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-box">
          <div style="font-size: 11px; color: #15803d; font-weight: 700; text-transform: uppercase;">Total Kilos en este Viaje:</div>
          <div style="font-size: 20px; font-weight: 900; color: #16a34a; font-family: monospace; margin-top: 2px;">
            ${deliveryKilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })} kg
          </div>
        </div>

        <div class="signatures">
          <div>
            <div style="height: 45px;"></div>
            <div class="signature-line">Entregó: ${escapeHtml(delivery.driver || provName || 'Andrés')}</div>
          </div>
          <div>
            <div style="height: 45px;"></div>
            <div class="signature-line">Recibió en Almacén Providencia (Sello / Firma)</div>
          </div>
        </div>

        <script>
          window.onafterprint = () => window.close();
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `;
  openPrintHtml(html);
}

export function printPreFactura({ folio, items, deliveredByItem, kilosNum, dynamicConfig, provName }: any) {
  const rawItems = items && items.length > 0 ? items : [];
  
  const itemsList = rawItems.length > 0 ? rawItems.map((it: any) => {
    const k = Number(deliveredByItem[it.id] ?? it.deliveredQuantity ?? it.quantity ?? 0);
    const price = Number(it.unitPrice || dynamicConfig.salePricePerKg || 43);
    const subtotal = round2(k * price);
    return {
      code: it.code || 'Bolsa',
      desc: it.description || 'Bolsa Polietileno',
      kilos: k,
      price,
      subtotal
    };
  }) : [{
    code: 'Bolsa',
    desc: 'Bolsa Polietileno',
    kilos: kilosNum,
    price: dynamicConfig.salePricePerKg || 43,
    subtotal: round2(kilosNum * (dynamicConfig.salePricePerKg || 43))
  }];

  const subtotalTotal = round2(itemsList.reduce((sum: number, item: any) => sum + item.subtotal, 0));
  const ivaTotal = round2(subtotalTotal * (dynamicConfig.ivaRate ?? 0.16));
  const grandTotal = round2(subtotalTotal + ivaTotal);

  const itemsRows = itemsList.map((it: any) => `
    <tr>
      <td style="text-align: right; font-weight: 600;">${it.kilos.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
      <td><strong>${escapeHtml(it.code)}</strong> - ${escapeHtml(it.desc)}</td>
      <td style="text-align: right;">$${it.price.toFixed(2)}</td>
      <td style="text-align: right; font-weight: 600;">$${it.subtotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Pre-Factura CFDI 4.0 - ${escapeHtml(folio)}</title>
        <style>
          .header-subtitle { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          .header-meta { text-align: right; color: #475569; }
          .header-meta strong { color: #0f172a; display: block; margin-bottom: 4px; font-size: 14px; }
          .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
          .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
          .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
          .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background-color: #fafaf9; }
          .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fef9c3; color: #854d0e; }
          .badge-bad { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Pre-Factura CFDI 4.0</h1>
            <div style="font-size: 13px; color: #64748b; margin-top: 4px;">Bolsas Elemental ERP · Documento Fiscal de Facturación</div>
          </div>
          <div class="badge">ORDEN / NOTA: ${escapeHtml(folio || 'S/N')}</div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">DATOS DEL RECEPTOR</div>
            <strong>GRUPO TEXTIL PROVIDENCIA SA DE CV</strong><br>
            <strong>RFC:</strong> GTP930115PU1<br>
            <strong>Domicilio Fiscal:</strong> HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO<br>
            <strong>Uso CFDI:</strong> G01 - Adquisición de mercancías
          </div>
          <div class="box">
            <div class="box-title">ESPECIFICACIONES CFDI 4.0 / METADATOS</div>
            <strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}<br>
            <strong>Método de Pago:</strong> PPD (Pago en parcialidades o diferido)<br>
            <strong>Forma de Pago:</strong> 99 Por definir<br>
            <strong>Clave Prod/Serv SAT:</strong> 24141500 (Bolsas de plástico)<br>
            <strong>Clave Unidad SAT:</strong> KGM (Kilogramos)<br>
            <strong>Nota en CFDI:</strong> OC ${escapeHtml(folio || 'S/N')}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 15%; text-align: right;">Kilos</th>
              <th style="width: 50%;">Descripción / Código Producto</th>
              <th style="width: 15%; text-align: right;">Precio ($/kg)</th>
              <th style="width: 20%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="totals-container">
          <div class="totals-box">
            <div class="totals-row">
              <span>SUBTOTAL:</span>
              <strong>$${subtotalTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div class="totals-row">
              <span>IVA (16%):</span>
              <strong>$${ivaTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div class="totals-row grand">
              <span>TOTAL:</span>
              <span>$${grandTotal.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        <div class="sat-info">
          <strong>📌 Instructivo para Facturación:</strong> Documento con el desglose exacto de entregas reales de ${provName} (${kilosNum.toLocaleString('es-MX')} kg). Utiliza estos valores para timbrar la factura CFDI 4.0 en el portal del SAT o en tu sistema de facturación.
        </div>

        <script>
          window.onafterprint = () => window.close();
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `;
  openPrintHtml(html);
}

export function printConsolidatedPackage({ folio, client, department, oc, totalKilograms, invoices, deliveries, config, provName }: any) {

  const totalKilos = Number(totalKilograms) || 0;
  const invList = invoices ?? [];
  const delList = deliveries ?? [];

  let totalVentaConIVA = 0;
  let totalCostoAndres = 0;
  let totalComision = 0;

  const invoicesHtml = invList.map((inv: any) => {
    const baseFin = computeFinancials(inv.kilos, config);
    const customComm = inv.financials?.commission;
    const invTotal = baseFin.invoiceTotal;
    const costAndres = baseFin.costTotal;
    const comm = customComm ?? baseFin.commission;
    const net = invTotal - comm - costAndres;

    totalVentaConIVA += invTotal;
    totalCostoAndres += costAndres;
    totalComision += comm;

    return `
      <tr>
        <td style="font-family:monospace;font-weight:600;">#${escapeHtml(inv.folio || '—')}</td>
        <td style="font-family:monospace;">${escapeHtml(inv.collection?.contrareciboNumber || '—')}</td>
        <td style="text-align:right;">${inv.kilos.toLocaleString('es-MX')} kg</td>
        <td style="text-align:right;">$${invTotal.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#8A5A1E;">-$${costAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;color:#B23A2E;">-$${comm.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
        <td style="text-align:right;font-weight:700;color:#2F7A52;">$${net.toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
      </tr>
    `;
  }).join('');

  const deliveriesHtml = delList.map((d: any) => `
    <tr>
      <td>${d.date ? toDate(d.date)?.toLocaleDateString('es-MX') || '—' : '—'}</td>
      <td style="text-align:right;">${d.kilos.toLocaleString('es-MX')} kg</td>
      <td>${escapeHtml(d.notes || '—')}</td>
    </tr>
  `).join('');

  const netUtilidad = totalVentaConIVA - totalCostoAndres - totalComision;
  const margenPct = totalVentaConIVA > 0 ? ((netUtilidad / totalVentaConIVA) * 100).toFixed(2) : '0.00';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Paquete Consolidado - ${escapeHtml(client)} (OC ${escapeHtml(oc || '—')})</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; color: #1e293b; font-size: 13px; line-height: 1.5; background: #fff; }
          .header { border-bottom: 4px solid #0f172a; padding-bottom: 24px; margin-bottom: 32px; display: flex; justify-content: space-between; align-items: flex-start; }
          .header-brand { display: flex; flex-direction: column; gap: 4px; }
          .header h1 { margin: 0; font-size: 26px; color: #0f172a; letter-spacing: -0.02em; font-weight: 800; }
          .header-subtitle { color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
          .header-meta { text-align: right; color: #475569; }
          .header-meta strong { color: #0f172a; display: block; margin-bottom: 4px; font-size: 14px; }
          .kpis { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
          .kpi { flex: 1; min-width: 150px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px 20px; border-radius: 8px; }
          .kpi-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin-bottom: 8px; }
          .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
          h2, h3 { font-size: 16px; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-top: 32px; margin-bottom: 16px; font-weight: 700; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; margin-bottom: 32px; font-size: 12px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
          th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
          th { background: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; }
          tr:last-child td { border-bottom: none; }
          tr:nth-child(even) { background-color: #fafaf9; }
          .num { text-align: right; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; }
          .badge { display: inline-block; padding: 4px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .badge-ok { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fef9c3; color: #854d0e; }
          .badge-bad { background: #fee2e2; color: #991b1b; }
          .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
          @media print { body { padding: 0; } .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>PAQUETE DE COBRO CONSOLIDADO</h1>
            <div class="sub">Bolsas Elemental ERP · Pre-Factura CFDI</div>
          </div>
          <div style="text-align:right;">
            <strong>Fecha:</strong> ${new Date().toLocaleDateString('es-MX')}<br>
            <strong>Folio Expediente:</strong> #${escapeHtml(folio || '—')}
          </div>
        </div>

        <div class="meta-grid">
          <div>
            <strong>Cliente:</strong> ${escapeHtml(client || '—')}<br>
            <strong>Departamento:</strong> ${escapeHtml(department || '—')}<br>
            <strong>Orden de Compra (OC):</strong> ${escapeHtml(oc || '—')}
          </div>
          <div style="text-align:right;">
            <strong>Proveedor Fabricante:</strong> ${provName} (Sin Mermas)<br>
            <strong>Kilos Totales:</strong> ${totalKilos.toLocaleString('es-MX')} kg<br>
            <strong>Facturas Asociadas:</strong> ${invList.length}
          </div>
        </div>

        ${delList.length > 0 ? `
          <div class="section-title">📦 1. REMISIONES Y ENTREGAS DE PLÁSTICO</div>
          <table>
            <thead>
              <tr>
                <th>Fecha Entrega</th>
                <th style="text-align:right;">Kilos Entregados</th>
                <th>Notas / Remisión</th>
              </tr>
            </thead>
            <tbody>${deliveriesHtml}</tbody>
          </table>
        ` : ''}

        <div class="section-title">📄 2. DETALLE DE FACTURAS (CFDI) Y CONTRARECIBOS (GT/TH)</div>
        <table>
          <thead>
            <tr>
              <th>Folio Factura</th>
              <th>Contrarecibo (CR)</th>
              <th style="text-align:right;">Kilos</th>
              <th style="text-align:right;">Facturado (con IVA)</th>
              <th style="text-align:right;">Costo ${provName}</th>
              <th style="text-align:right;">Comisión Contador</th>
              <th style="text-align:right;">Utilidad Líquida Real</th>
            </tr>
          </thead>
          <tbody>${invoicesHtml}</tbody>
        </table>

        <div class="summary-box">
          <div class="summary-line"><span>Ingreso Total Facturado (Venta + IVA):</span><strong>$${totalVentaConIVA.toLocaleString('es-MX', {minimumFractionDigits:2})}</strong></div>
          <div class="summary-line"><span>Costo Directo Proveedor ${provName}:</span><span style="color:#8A5A1E;">-$${totalCostoAndres.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
          <div class="summary-line"><span>Comisión Contabilidad / Contador:</span><span style="color:#B23A2E;">-$${totalComision.toLocaleString('es-MX', {minimumFractionDigits:2})}</span></div>
          <div class="summary-line total">
            <span>UTILIDAD LÍQUIDA REAL (MARGEN: ${margenPct}%):</span>
            <span>$${netUtilidad.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
          </div>
        </div>

        <div class="signatures">
          <div class="sig-box">Firma y Sello de Recepción Cliente</div>
          <div class="sig-box">Autorización de Cobro y CAJA</div>
        </div>

        <script>
          window.onafterprint = () => window.close();
          window.onload = () => { window.print(); }
        </script>
      </body>
    </html>
  `;

  openPrintHtml(html);
}
