import { money, fmtDate } from './format';
import type { PurchaseOrder, Invoice } from './types';

// Convertir número a letra en pesos mexicanos
function numeroALetras(monto: number): string {
  const enteros = Math.floor(monto);
  const centavos = Math.round((monto - enteros) * 100);
  const centavosTxt = centavos.toString().padStart(2, '0');
  return `${enteros.toLocaleString('es-MX')} PESOS ${centavosTxt}/100 M.N.`;
}

export async function generatePrefacturaPdf(order: PurchaseOrder, invoice?: Invoice | null) {
  // Cargar dinámicamente html2pdf.js
  const html2pdf = (await import('html2pdf.js')).default;

  const ocFolio = order.oc || order.folio || 'S/N';
  const invFolio = invoice?.folio || `PRE-${order.folio || 'OC'}`;
  const fechaEmision = invoice?.creditCycle?.issueDate ? fmtDate(invoice.creditCycle.issueDate) : fmtDate(new Date());

  // Kilos e importes según items de la factura o de la orden
  let items: any[] = [];
  if (invoice?.items && invoice.items.length > 0) {
    items = invoice.items;
  } else if (order.items && order.items.length > 0) {
    if (invoice && invoice.kilos > 0 && Math.abs(invoice.kilos - (order.totalKilograms || 0)) > 0.01 && order.items.length === 1) {
      const it = order.items[0];
      const p = it.unitPrice ?? order.customSellPrice ?? 0;
      items = [{
        ...it,
        quantity: invoice.kilos,
        unitPrice: p,
        amount: invoice.kilos * p,
      }];
    } else {
      items = order.items;
    }
  } else {
    const fallbackKilos = invoice?.kilos || order.totalKilograms || 0;
    const p = order.customSellPrice ?? 0;
    items = [
      {
        id: '1',
        code: '24141500',
        description: 'BOLSA POLIETILENO TRANSPARENTE EN ROLLO / BULTOS',
        quantity: fallbackKilos,
        unit: 'Kilos',
        unitPrice: p,
        amount: fallbackKilos * p,
      }
    ];
  }

  const totalKilos = items.reduce((sum, it) => sum + Number(it.quantity || 0), 0) || invoice?.kilos || order.totalKilograms || 0;
  const subtotal = invoice?.financials?.saleTotal ?? items.reduce((sum, it) => sum + Number(it.amount ?? ((it.quantity || 0) * (it.unitPrice ?? order.customSellPrice ?? 0))), 0);
  const total = invoice?.financials?.invoiceTotal ?? (subtotal * 1.16);
  const iva = total - subtotal;
  const unitPrice = totalKilos > 0 ? subtotal / totalKilos : (order.customSellPrice ?? 0);

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; padding: 24px 32px; color: #1e293b; background: #fff; max-width: 800px; margin: 0 auto; font-size: 12px; line-height: 1.4;">
      
      <!-- ENCABEZADO FISCAL (EMISOR) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <div style="font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.5px;">ELEMENTAL DENIM</div>
          <div style="font-size: 12px; font-weight: 800; color: #2563eb; margin-top: 2px;">RFC: EDE1902136T2</div>
          <div style="font-size: 11px; color: #334155; margin-top: 4px;">
            <strong>Régimen Fiscal:</strong> 601 - General de Ley Personas Morales<br/>
            <strong>Domicilio Fiscal:</strong> Calzada Zavaleta 1108/1701, Santa Cruz Buenavista, CP 72150, Puebla, México<br/>
            <strong>Tel:</strong> 2223712758
          </div>
        </div>

        <div style="text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 16px; min-width: 220px;">
          <div style="font-size: 11px; font-weight: 800; color: #2563eb; text-transform: uppercase;">PREFACTURA / CFDI 4.0</div>
          <div style="font-size: 18px; font-weight: 900; color: #0f172a; margin-top: 2px;">FOLIO: ${invFolio}</div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;"><strong>Fecha:</strong> ${fechaEmision}</div>
          <div style="font-size: 11px; color: #475569;"><strong>Condiciones:</strong> OC ${ocFolio}</div>
        </div>
      </div>

      <!-- DATOS DEL CLIENTE (RECEPTOR) -->
      <div style="background: #f1f5f9; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; border-left: 4px solid #2563eb;">
        <div style="font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 6px;">DATOS DEL CLIENTE (RECEPTOR):</div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">${order.client || 'GRUPO TEXTIL PROVIDENCIA SA DE CV'}</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px;">HIDALGO NORTE 7, CP 90800, TLAXCALA, SANTA ANA CHIAUTEMPAN, MEXICO</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 11px; color: #334155;">
          <div><strong>RFC:</strong> GTP930115PU1</div>
          <div><strong>Uso de CFDI:</strong> G01 - Adquisición de mercancías</div>
          <div><strong>Método de Pago:</strong> PPD - Pago en parcialidades o diferido</div>
          <div><strong>Forma de Pago:</strong> 99 - Por definir</div>
        </div>
      </div>

      <!-- TABLA DE CONCEPTOS -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px;">
        <thead>
          <tr style="background: #1e293b; color: #fff; text-transform: uppercase; font-size: 10px;">
            <th style="padding: 8px 10px; text-align: left; border-radius: 4px 0 0 0;">Clave SAT</th>
            <th style="padding: 8px 10px; text-align: left;">Cant. (Kg)</th>
            <th style="padding: 8px 10px; text-align: left;">Unidad</th>
            <th style="padding: 8px 10px; text-align: left;">Descripción / Código</th>
            <th style="padding: 8px 10px; text-align: right;">P. Unitario</th>
            <th style="padding: 8px 10px; text-align: right; border-radius: 0 4px 0 0;">Importe</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((it, idx) => {
            const satCode = it.satCode || it.codeSat || '24141500';
            const code = it.code || 'S/C';
            const desc = it.description || 'Bolsa de Polietileno';
            return `
            <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
              <td style="padding: 8px 10px; color: #64748b; font-family: monospace;">${satCode}</td>
              <td style="padding: 8px 10px; font-weight: 700; color: #0f172a; font-family: monospace;">${(it.quantity || totalKilos).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              <td style="padding: 8px 10px; color: #475569;">KGM</td>
              <td style="padding: 8px 10px; font-weight: 600; color: #1e293b;">
                <strong>${code}</strong> ${desc.startsWith(code) ? desc.slice(code.length).trim() : desc}
              </td>
              <td style="padding: 8px 10px; text-align: right; font-family: monospace;">$${(it.unitPrice || unitPrice).toFixed(2)}</td>
              <td style="padding: 8px 10px; text-align: right; font-weight: 800; font-family: monospace; color: #047857;">$${(it.amount || subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- TOTALES & CANTIDAD EN LETRA -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 20px;">
        <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px;">
          <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">IMPORTE TOTAL CON LETRA:</div>
          <div style="font-size: 11px; font-weight: 800; color: #0f172a; margin-top: 4px;">${numeroALetras(total)}</div>
          <div style="font-size: 10px; color: #64748b; margin-top: 8px;">
            * Documento con desglose fiscal exacto para emisión en el portal del SAT.
          </div>
        </div>

        <div style="min-width: 240px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 16px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px;">
            <span style="color: #475569;">SUBTOTAL:</span>
            <span style="font-family: monospace; font-weight: 700;">${money(subtotal)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
            <span style="color: #475569;">I.V.A. (16%):</span>
            <span style="font-family: monospace; font-weight: 700; color: #2563eb;">+${money(iva)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 900; color: #0f172a;">
            <span>TOTAL:</span>
            <span style="color: #047857;">${money(total)}</span>
          </div>
        </div>
      </div>

      <!-- VALIDACIÓN FISCAL -->
      <div style="margin-top: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 44px; height: 44px; background: #1e3a8a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 20px;">
            📄
          </div>
          <div>
            <div style="font-weight: 800; font-size: 11px; color: #0f172a;">DESGLOSE FISCAL CFDI 4.0 (EMISIÓN SAT)</div>
            <div style="font-size: 10px; color: #64748b; margin-top: 1px;">
              Clave SAT: 24141500 · Unidad: KGM · Objeto Impuesto: 02 · RFC: GTP930115PU1
            </div>
          </div>
        </div>
        <div style="text-align: right; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
          CONTROL: ${invFolio}-${ocFolio}
        </div>
      </div>

    </div>
  `;

  const opt: any = {
    margin: [10, 10, 10, 10],
    filename: `Prefactura_${invFolio}_OC_${ocFolio}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(html).save();
}

// ─────────────────────────────────────────────────────────────────────────────
// PREFACTURA CANÓNICA — REMISIÓN 114400 (OC 71/14400 · TH · Nava)
// 6,805.76 kg @ $44.00/kg · Firmada Ahmed Flores Grande · 27/Oct/2026
// Pendiente de timbrar: $299,453.44 subtotal / $347,365.99 con IVA
// ─────────────────────────────────────────────────────────────────────────────

/** Partidas EXACTAS de la Remisión 114400 tal como aparecen en el documento físico */
const REMISION_114400_ITEMS = [
  { code: 'egbo000107-sc', description: 'BOLSA DE POLIETILENO COLOR NATURAL 48+17+17x140 CM CAL 250', qty: 978.96  },
  { code: 'enbo000167-bl', description: 'BOLSA DE POLIETILENO COLOR NATURAL 55 CM X 126 CM',           qty: 1000.00 },
  { code: 'egbo000103-sc', description: 'BOLSA DE POLIETILENO COLOR NATURAL 80+20x20x160 CM C/250',    qty:  987.28 },
  { code: 'EGBO000101-SC', description: 'BOLSA DE POLIETILENO COLOR NATURAL 60+20x120 CM C/250',       qty:  500.00 },
  { code: 'enbo000084-sc', description: 'BOLSA DE POLIETILENO COLOR NATURAL 55 CM x 55 CM',            qty: 1000.00 },
  { code: 'enbo000006-sc', description: 'BOLSA DE POLIETILENO 77 CM X 55 CM (55x77) Sin Color',        qty:  839.52 },
  { code: 'ENBO000007-SC', description: 'BOLSA DE POLIETILENO 50 CM x 55 CM (50x55) Sin Color',        qty: 1500.00 },
] as const;

const PRICE_PER_KG = 44.00;
const IVA = 0.16;

export async function generatePrefacturaRemision114400(): Promise<void> {
  const html2pdf = (await import('html2pdf.js')).default;

  const folio     = 'PRE-REM-114400';
  const fecha     = '27 de Octubre de 2026';
  const oc        = '120267114400';
  const folioOc   = '71/14400';
  const remision  = '114400';
  const signer    = 'Ahmed Flores Grande';

  const totalKg  = REMISION_114400_ITEMS.reduce((s, it) => s + it.qty, 0); // 6,805.76
  const subtotal = parseFloat((totalKg * PRICE_PER_KG).toFixed(2));        // 299,453.44
  const ivaAmt   = parseFloat((subtotal * IVA).toFixed(2));                // 47,912.55
  const total    = parseFloat((subtotal + ivaAmt).toFixed(2));             // 347,365.99

  const rowsHtml = REMISION_114400_ITEMS.map((it, idx) => {
    const importe = parseFloat((it.qty * PRICE_PER_KG).toFixed(2));
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
      <tr style="border-bottom:1px solid #e2e8f0; background:${bg};">
        <td style="padding:7px 10px; font-size:10px; color:#64748b; font-family:monospace;">24141500</td>
        <td style="padding:7px 10px; font-size:11px; font-weight:700; font-family:monospace; color:#0f172a;">${it.qty.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
        <td style="padding:7px 10px; font-size:10px; color:#475569;">KGM</td>
        <td style="padding:7px 10px; font-size:11px; font-weight:600; color:#1e293b;">
          <span style="font-family:monospace; color:#2563eb; font-size:10px; font-weight:800;">${it.code.toUpperCase()}</span><br/>
          ${it.description}
        </td>
        <td style="padding:7px 10px; text-align:right; font-family:monospace; font-size:11px;">$${PRICE_PER_KG.toFixed(2)}</td>
        <td style="padding:7px 10px; text-align:right; font-weight:800; font-family:monospace; font-size:11px; color:#047857;">$${importe.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
      </tr>`;
  }).join('');

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif; padding:24px 32px; color:#1e293b; background:#fff; max-width:820px; margin:0 auto; font-size:12px; line-height:1.4;">

      <!-- CABECERA URGENTE -->
      <div style="background:linear-gradient(135deg,#dc2626 0%,#b91c1c 100%); color:#fff; border-radius:10px; padding:10px 18px; margin-bottom:18px; display:flex; align-items:center; gap:12px;">
        <span style="font-size:22px;">⚡</span>
        <div>
          <div style="font-size:13px; font-weight:900; letter-spacing:0.3px;">REMISIÓN 114400 — PENDIENTE DE TIMBRAR</div>
          <div style="font-size:11px; opacity:0.88;">Firmada por ${signer} · ${fecha} · ${totalKg.toLocaleString('es-MX',{minimumFractionDigits:2})} kg listos para CFDI 4.0</div>
        </div>
        <div style="margin-left:auto; text-align:right;">
          <div style="font-size:18px; font-weight:900;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</div>
          <div style="font-size:10px; opacity:0.8;">TOTAL CON IVA</div>
        </div>
      </div>

      <!-- ENCABEZADO EMISOR / FOLIO -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2563eb; padding-bottom:14px; margin-bottom:18px;">
        <div>
          <div style="font-size:20px; font-weight:900; color:#0f172a; letter-spacing:-0.5px;">ELEMENTAL DENIM</div>
          <div style="font-size:12px; font-weight:800; color:#2563eb; margin-top:2px;">RFC: EDE1902136T2</div>
          <div style="font-size:10.5px; color:#334155; margin-top:4px; line-height:1.6;">
            <strong>Régimen:</strong> 601 - General de Ley Personas Morales<br/>
            <strong>Domicilio:</strong> Calzada Zavaleta 1108/1701, Santa Cruz Buenavista, CP 72150, Puebla, México<br/>
            <strong>Tel:</strong> 2223712758
          </div>
        </div>
        <div style="text-align:right; background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px 16px; min-width:230px;">
          <div style="font-size:10px; font-weight:800; color:#2563eb; text-transform:uppercase;">PREFACTURA / CFDI 4.0</div>
          <div style="font-size:16px; font-weight:900; color:#0f172a; margin-top:2px;">FOLIO: ${folio}</div>
          <div style="font-size:10px; color:#475569; margin-top:4px;"><strong>Fecha doc.:</strong> ${fecha}</div>
          <div style="font-size:10px; color:#475569;"><strong>OC Providencia:</strong> ${oc} (${folioOc})</div>
          <div style="font-size:10px; color:#dc2626; font-weight:800; margin-top:4px;">📋 Remisión física: ${remision}</div>
        </div>
      </div>

      <!-- RECEPTOR -->
      <div style="background:#f1f5f9; border-radius:8px; padding:12px 16px; margin-bottom:18px; border-left:4px solid #2563eb;">
        <div style="font-size:10px; font-weight:800; color:#475569; text-transform:uppercase; margin-bottom:6px;">RECEPTOR (CLIENTE):</div>
        <div style="font-size:13px; font-weight:800; color:#0f172a;">GRUPO TEXTIL PROVIDENCIA SA DE CV</div>
        <div style="font-size:10.5px; color:#475569; margin-top:2px;">HIDALGO NORTE 7, CP 90800, STA ANA CHIAUTEMPAN, TLAXCALA, MÉXICO</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; font-size:10.5px; color:#334155;">
          <div><strong>RFC:</strong> GTP930115PU1</div>
          <div><strong>Uso CFDI:</strong> G01 - Adquisición de mercancías</div>
          <div><strong>Método Pago:</strong> PPD - Diferido</div>
          <div><strong>Forma Pago:</strong> 99 - Por definir</div>
          <div><strong>Almacén destino:</strong> Almacén 1 (TH · Nava)</div>
          <div><strong>Contacto:</strong> Lic. José Nava Flores</div>
        </div>
      </div>

      <!-- TABLA DE CONCEPTOS -->
      <table style="width:100%; border-collapse:collapse; margin-bottom:18px;">
        <thead>
          <tr style="background:#1e293b; color:#fff; text-transform:uppercase; font-size:9.5px; letter-spacing:0.4px;">
            <th style="padding:8px 10px; text-align:left; border-radius:4px 0 0 0;">Clave SAT</th>
            <th style="padding:8px 10px; text-align:right;">Cant. (Kg)</th>
            <th style="padding:8px 10px; text-align:left;">Unidad</th>
            <th style="padding:8px 10px; text-align:left;">Código / Descripción del Producto</th>
            <th style="padding:8px 10px; text-align:right;">P. Unit.</th>
            <th style="padding:8px 10px; text-align:right; border-radius:0 4px 0 0;">Importe</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr style="background:#f1f5f9; font-weight:800; font-size:12px;">
            <td colspan="2" style="padding:10px 10px; color:#2563eb; font-weight:900;">
              TOTAL: ${totalKg.toLocaleString('es-MX',{minimumFractionDigits:2})} kg en 7 partidas
            </td>
            <td colspan="2" style="padding:10px 10px; color:#475569; font-size:11px;">
              Remisión: <strong>${remision}</strong> · OC: <strong>${folioOc}</strong> · Firmada: <strong>${signer}</strong>
            </td>
            <td style="padding:10px 10px; text-align:right; color:#475569;">Subtotal:</td>
            <td style="padding:10px 10px; text-align:right; font-family:monospace; color:#047857;">$${subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})}</td>
          </tr>
        </tfoot>
      </table>

      <!-- TOTALES -->
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; gap:20px;">
        <div style="flex:1; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:12px 14px;">
          <div style="font-size:10px; font-weight:800; color:#64748b; text-transform:uppercase;">IMPORTE TOTAL CON LETRA:</div>
          <div style="font-size:11px; font-weight:800; color:#0f172a; margin-top:4px;">${numeroALetras(total)}</div>
          <div style="font-size:10px; color:#64748b; margin-top:8px; line-height:1.5;">
            ⚠️ Este documento es una <strong>prefactura de referencia</strong> para el contador.<br/>
            El CFDI oficial debe timbrase en el portal del SAT antes de entregarlo a Providencia.
          </div>
        </div>
        <div style="min-width:250px; background:#f8fafc; border:1.5px solid #cbd5e1; border-radius:8px; padding:14px 18px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
            <span style="color:#475569;">SUBTOTAL:</span>
            <span style="font-family:monospace; font-weight:700;">$${subtotal.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; border-bottom:1px solid #e2e8f0; padding-bottom:8px;">
            <span style="color:#2563eb; font-weight:700;">I.V.A. (16%):</span>
            <span style="font-family:monospace; font-weight:700; color:#2563eb;">+$${ivaAmt.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:17px; font-weight:900; color:#0f172a;">
            <span>TOTAL:</span>
            <span style="color:#047857;">$${total.toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
          </div>
          <div style="font-size:10px; color:#64748b; margin-top:6px; text-align:right;">
            (${totalKg.toLocaleString('es-MX',{minimumFractionDigits:2})} kg × $${PRICE_PER_KG.toFixed(2)}/kg + IVA 16%)
          </div>
        </div>
      </div>

      <!-- PIE FISCAL -->
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px; display:flex; align-items:center; justify-content:space-between; margin-top:14px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:44px; height:44px; background:#1e3a8a; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:20px;">📄</div>
          <div>
            <div style="font-weight:800; font-size:11px; color:#0f172a;">DESGLOSE FISCAL CFDI 4.0 — EMISIÓN SAT</div>
            <div style="font-size:10px; color:#64748b; margin-top:2px;">
              Clave SAT: 24141500 · Unidad: KGM · Obj. Impuesto: 02 · Receptor RFC: GTP930115PU1
            </div>
          </div>
        </div>
        <div style="text-align:right; font-size:9px; color:#94a3b8; font-family:monospace;">
          REM: ${remision} · OC: ${oc}<br/>
          ${fecha} · ${signer}
        </div>
      </div>

    </div>
  `;

  const opt: any = {
    margin:     [8, 10, 8, 10],
    filename:   `Prefactura_Remision_114400_TH_Nava_${totalKg}kg.pdf`,
    image:      { type: 'jpeg', quality: 0.98 },
    html2canvas:{ scale: 2, useCORS: true },
    jsPDF:      { unit: 'mm', format: 'letter', orientation: 'portrait' },
  };

  await html2pdf().set(opt).from(html).save();
}

