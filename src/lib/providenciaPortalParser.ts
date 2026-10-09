export interface ParsedContrareciboPortalData {
  contrareciboNumber: string;
  facturaFolio: string;
  serieControlInterno?: string;
  importe: number;
  fechaRecepcion?: string;
  fechaPago?: string;
  cadenaOriginal?: string;
  selloDigital?: string;
  department: 'TH' | 'GT' | 'OTHER';
}

/**
 * Parsea texto HTML o copiado directamente del portal de proveedores de Providencia
 * (apps.mundoprovidencia.com) para extraer los datos oficiales del Contrarecibo.
 */
export function parseProvidenciaContrareciboHtml(content: string): ParsedContrareciboPortalData[] {
  if (!content) return [];
  const results: ParsedContrareciboPortalData[] = [];

  // 1. Detectar si es una tabla de resumen del portal con múltiples filas
  const tableRowRegex = /(?:[0-9]+\s+)?\b(TH-[0-9]+|GT-[0-9]+)\b\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([0-9]{2}\/[0-9]{2}\/[0-9]{4})\s+([0-9,]+\.[0-9]{2})/gi;
  const tableMatches = [...content.matchAll(tableRowRegex)];

  if (tableMatches.length > 0) {
    const seen = new Set<string>();
    for (const m of tableMatches) {
      const crNum = m[1].toUpperCase();
      if (!seen.has(crNum)) {
        seen.add(crNum);
        results.push({
          contrareciboNumber: crNum,
          facturaFolio: '',
          fechaRecepcion: m[2],
          fechaPago: m[3],
          importe: parseFloat(m[4].replace(/,/g, '')),
          department: crNum.startsWith('TH') ? 'TH' : 'GT',
        });
      }
    }
    return results;
  }

  // Dividir en bloques si se pegaron múltiples páginas HTML individuales consecutivas
  const chunks = content.includes('<!-- saved from url=')
    ? content.split(/<!--\s*saved from url=/i).filter(c => c.trim().length > 0)
    : content.split(/<\/html>/i).filter(c => c.trim().length > 0);

  const processSingleChunk = (text: string) => {
    // 1. Número de Contrarecibo
    const crMatch = text.match(/No\.\s*(?:TH|GT|CR)?-?([A-Z0-9-]+)/i) ||
                    text.match(/(?:TH|GT)-[0-9]+/i) ||
                    text.match(/id=[0-9]+(TH-[0-9]+|GT-[0-9]+)/i) ||
                    text.match(/1\|\d{4}\|(TH-[0-9]+|GT-[0-9]+)/i);

    let contrareciboNumber = '';
    if (crMatch) {
      contrareciboNumber = (crMatch[1] || crMatch[0]).trim();
      if (!contrareciboNumber.startsWith('TH-') && !contrareciboNumber.startsWith('GT-')) {
        const prefixMatch = text.match(/\b(TH|GT)-[0-9]+\b/i);
        if (prefixMatch) contrareciboNumber = prefixMatch[0].toUpperCase();
      }
    }

    // 2. Extraer todas las partidas de facturas amparadas en HTML o Texto Plano (PDF)
    const rowRegex = /<tr[^>]*name="l_\d+"[^>]*>\s*<td[^>]*>([0-9]{3,8})<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([0-9,]+\.[0-9]{2})<\/td>/gi;
    const rowMatches = [...text.matchAll(rowRegex)];

    // En texto plano de PDFs de Providencia las filas siguen el formato:
    // "6352 2 / 415 14,964.00 PMX"
    const textRowRegex = /\b([0-9]{3,8})\b\s+([0-9]+\s*\/\s*[0-9]+)\s+([0-9,]+\.[0-9]{2})\s*(?:PMX|MXN)?/gi;
    const textRowMatches = [...text.matchAll(textRowRegex)];

    // 5. Fechas de Recepción y Pago
    const fecRecMatch = text.match(/Fecha\s*Recepci[oó]n:\s*<strong>([0-9]{2}\/[0-9]{2}\/[0-9]{4})<\/strong>/i) ||
                        text.match(/Fecha\s*Recepci[oó]n:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                        text.match(/Recepci[oó]n[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    let fechaRecepcion = fecRecMatch ? fecRecMatch[1].trim() : undefined;

    const fecPagoMatch = text.match(/Fecha\s*Pago:\s*<strong>([0-9]{2}\/[0-9]{2}\/[0-9]{4})<\/strong>/i) ||
                         text.match(/Fecha\s*Pago:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) ||
                         text.match(/Pago[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    let fechaPago = fecPagoMatch ? fecPagoMatch[1].trim() : undefined;

    // Cadena Original con estructura oficial: 1|2026|TH-1195|05/10/2026|EDE1902136T2|74820|04/11/2026
    const cadDetails = text.match(/1\|\d{4}\|((?:TH|GT)-[0-9]+)\|(\d{2}\/\d{2}\/\d{4})\|[A-Z0-9-]+\|([0-9.]+)\|(\d{2}\/\d{2}\/\d{4})/i);
    if (cadDetails) {
      if (!contrareciboNumber) contrareciboNumber = cadDetails[1].toUpperCase();
      if (!fechaRecepcion) fechaRecepcion = cadDetails[2];
      if (!fechaPago) fechaPago = cadDetails[4];
    }

    // 6. Cadena Original
    const cadMatch = text.match(/1\|\d{4}\|[A-Z0-9-]+\|[^<\n\r]+/);
    const cadenaOriginal = cadMatch ? cadMatch[0].trim() : undefined;

    // 7. Sello Digital
    const selloMatch = text.match(/Sello\s*digital[\s\S]*?<td[^>]*align="center">([\s\S]*?)<\/td>/i) ||
                       text.match(/Sello\s*digital\s*\n\s*([A-Za-z0-9+/=]{40,})/i);
    const selloDigital = selloMatch ? selloMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

    // 8. Departamento TH vs GT
    const upperCr = (contrareciboNumber || (cadDetails ? cadDetails[1] : '')).toUpperCase();
    const department: 'TH' | 'GT' | 'OTHER' = upperCr.startsWith('TH') ? 'TH' : upperCr.startsWith('GT') ? 'GT' : 'OTHER';

    if (rowMatches.length > 0) {
      for (const rm of rowMatches) {
        results.push({
          contrareciboNumber: upperCr,
          facturaFolio: rm[1].trim(),
          serieControlInterno: rm[2].trim(),
          importe: parseFloat(rm[3].replace(/,/g, '')),
          fechaRecepcion,
          fechaPago,
          cadenaOriginal,
          selloDigital,
          department,
        });
      }
    } else if (textRowMatches.length > 0) {
      for (const trm of textRowMatches) {
        results.push({
          contrareciboNumber: upperCr,
          facturaFolio: trm[1].trim(),
          serieControlInterno: trm[2].trim(),
          importe: parseFloat(trm[3].replace(/,/g, '')),
          fechaRecepcion,
          fechaPago,
          cadenaOriginal,
          selloDigital,
          department,
        });
      }
    } else {
      // Fallback para factura única o formatos no tabulares
      const facMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>\s*<td[^>]*>([0-9]{3,8})<\/td>/i) ||
                       text.match(/Factura\s*No\.[\s\S]*?<td[^>]*>([0-9]{3,8})<\/td>/i) ||
                       text.match(/Factura\s*(?:No\.?)?[:\s]*F?-?([0-9]{3,8})/i) ||
                       text.match(/F-([0-9]{3,8})/i) ||
                       text.match(/\b([0-9]{4,6})\b\s+[0-9\s/]+\s+([0-9,]+\.[0-9]{2})/);
      const facturaFolio = facMatch ? facMatch[1].trim() : '';

      const serieMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>[\s\S]*?<td[^>]*>([0-9\s/]+)<\/td>/i) ||
                         text.match(/Serie[:\s]*([A-Z0-9\s/]+)/i);
      const serieControlInterno = serieMatch ? serieMatch[1].trim() : undefined;

      const importeMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>[\s\S]*?<td[^>]*>([0-9,]+\.[0-9]{2})<\/td>/i) ||
                           text.match(/1\|\d{4}\|[A-Z0-9-]+\|[^|]+\|[^|]+\|([0-9.]+)\|/) ||
                           text.match(/Total[:\s]*\$?\s*([0-9,]+\.[0-9]{2})/i) ||
                           text.match(/Importe[:\s]*\$?\s*([0-9,]+\.[0-9]{2})/i);
      let importe = 0;
      if (importeMatch) {
        importe = parseFloat(importeMatch[1].replace(/,/g, ''));
      }

      if (contrareciboNumber || facturaFolio) {
        results.push({
          contrareciboNumber: upperCr,
          facturaFolio,
          serieControlInterno,
          importe,
          fechaRecepcion,
          fechaPago,
          cadenaOriginal,
          selloDigital,
          department,
        });
      }
    }
  };

  if (chunks.length > 1) {
    for (const chunk of chunks) {
      processSingleChunk(chunk);
    }
  } else {
    processSingleChunk(content);
  }

  return results;
}

export interface ParsedProvidenciaPaymentData {
  contrareciboNumber: string;
  paymentDate: string;
  bancoCargo?: string;
  cuentaCargo?: string;
  bancoAbono?: string;
  cuentaAbono?: string;
  transferRef?: string;
  amount: number;
  currency?: string;
  observaciones?: string;
  facturaFolio?: string;
  pdfUrl?: string;
  department: 'TH' | 'GT' | 'OTHER';
}

/**
 * Parsea el volcado HTML o texto de la pantalla oficial de Detalle de Pago del Portal de Providencia:
 * (e.g. apps.mundoprovidencia.com/.../contrarecibos/detalle-pago/?id=12026TH-836&c=TH-836)
 */
export function parseProvidenciaPaymentDetailHtml(content: string): ParsedProvidenciaPaymentData | null {
  if (!content) return null;

  const isPaymentPage = content.includes('DETALLE DE PAGO') ||
                        content.includes('detalle-pago') ||
                        content.includes('Detalle de pago') ||
                        content.includes('Banco Cargo') ||
                        content.includes('Banco Abono');

  if (!isPaymentPage) {
    return null;
  }

  // 1. Contrarecibo Number
  const crMatch = content.match(/Contrarecibo:\s*<u>\s*(?:No\.\s*)?([A-Z0-9-]+)\s*<\/u>/i) ||
                  content.match(/Contrarecibo:\s*([A-Z0-9-]+)/i) ||
                  content.match(/detalle-pago\/\?[^"']*c=([A-Z0-9-]+)/i) ||
                  content.match(/detalle-pago\/\?[^"']*id=[0-9]*([A-Z0-9-]+)/i) ||
                  content.match(/\b(TH-[0-9]+|GT-[0-9]+)\b/i);

  const contrareciboNumber = crMatch ? crMatch[1].trim().toUpperCase() : '';

  // 2. Extraer celdas de la tabla
  const cellsMatch = [...content.matchAll(/<td[^>]*class="text_copyright"[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, '').trim());

  let paymentDate = '';
  let bancoCargo = '';
  let cuentaCargo = '';
  let bancoAbono = '';
  let cuentaAbono = '';
  let transferRef = '';
  let amount = 0;
  let currency = 'PMX';
  let observaciones = '';

  if (cellsMatch.length >= 7) {
    paymentDate = cellsMatch[0] || '';
    bancoCargo = cellsMatch[1] || '';
    cuentaCargo = cellsMatch[2] || '';
    bancoAbono = cellsMatch[3] || '';
    cuentaAbono = cellsMatch[4] || '';
    transferRef = cellsMatch[5] || '';
    amount = parseFloat(cellsMatch[6].replace(/,/g, '')) || 0;
    if (cellsMatch.length >= 8) currency = cellsMatch[7];
    if (cellsMatch.length >= 12) observaciones = cellsMatch[11];
    else if (cellsMatch.length >= 10) observaciones = cellsMatch[cellsMatch.length - 1];
  } else {
    // Fallbacks por expresiones regulares
    const dateMatch = content.match(/([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
    if (dateMatch) paymentDate = dateMatch[1];
    const amountMatch = content.match(/([0-9,]+\.[0-9]{2})\s*<\/td>\s*<td[^>]*class="text_copyright"[^>]*>\s*PMX/i) ||
                        content.match(/([0-9,]+\.[0-9]{2})/);
    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    const obsMatch = content.match(/PAGO\s*FAC#?([0-9]+)/i);
    if (obsMatch) observaciones = obsMatch[0];
  }

  // 3. Extraer folio de factura de observaciones (ej. "PAGO FAC#6084" -> "6084")
  const facMatch = observaciones.match(/FAC#?\s*([0-9]+)/i) || content.match(/PAGO\s*FAC#?\s*([0-9]+)/i);
  const facturaFolio = facMatch ? facMatch[1].trim() : '';

  // 4. URL del PDF de comprobante
  const pdfMatch = content.match(/href="([^"]+\.pdf[^"]*)"/i);
  const pdfUrl = pdfMatch ? pdfMatch[1].replace(/&amp;/g, '&') : undefined;

  const upperCr = contrareciboNumber.toUpperCase();
  const department: 'TH' | 'GT' | 'OTHER' = upperCr.startsWith('TH') ? 'TH' : upperCr.startsWith('GT') ? 'GT' : 'OTHER';

  return {
    contrareciboNumber: upperCr,
    paymentDate,
    bancoCargo,
    cuentaCargo,
    bancoAbono,
    cuentaAbono,
    transferRef,
    amount,
    currency,
    observaciones,
    facturaFolio,
    pdfUrl,
    department,
  };
}

/**
 * Parsea el texto extraído de un PDF oficial de Detalle de Pagos de Providencia
 * (portal de proveedores apps.mundoprovidencia.com, formato:
 *  "DETALLE DE PAGOS", "PAGO: TR_4987 TRANSFERENCIA: IMPORTE: 98,054.60 MXN",
 *  "8/678 TR_4987 6198 TH-990 30/09/2026 98,054.60 MXN").
 */
export function parseProvidenciaPaymentPdf(text: string): ParsedProvidenciaPaymentData | null {
  if (!text) return null;

  const isPayment =
    /DETALLE\s*DE\s*PAGOS?/i.test(text) ||
    /Docto\.?\s*SAP.*Docto\.?\s*Pago/i.test(text) ||
    (/PAGO:\s*TR_\d+/i.test(text) && /TRANSFERENCIA/i.test(text)) ||
    /apps\.mundoprovidencia\.com.*pagos/i.test(text);

  if (!isPayment) return null;

  // 1. Transferencia / Docto. Pago (ej. TR_4987, TR_4835)
  const trMatch = text.match(/PAGO:\s*(TR_\d+)/i) ||
                  text.match(/\b(TR_\d+)\b/i);
  const transferRef = trMatch ? trMatch[1].toUpperCase() : '';

  // 2. Importe total del pago (ej. 98,054.60 MXN)
  const importeMatch = text.match(/IMPORTE:\s*([\d,]+\.\d{2})\s*(?:MXN)?/i) ||
                       text.match(/\b([\d,]+\.\d{2})\s*MXN\b/i);
  const amount = importeMatch ? parseFloat(importeMatch[1].replace(/,/g, '')) : 0;

  // 3. Fila de tabla de desglose:
  // Docto. SAP | Docto. Pago | Factura | Detalle | Fecha Pago | Importe | Moneda
  // Ej: 8/678 TR_4987 6198 TH-990 30/09/2026 98,054.60 MXN
  // Ej: 8/660 TR_4835 6167 TH-946 25/09/2026 81,780.00 MXN
  const rowMatch = text.match(/(?:([0-9]+\/[0-9]+)\s+)?(TR_\d+)\s+([0-9]{3,8})\s+((?:TH|GT)-[0-9]+)\s+([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\s+([\d,]+\.\d{2})/i) ||
                   text.match(/([0-9]+\/[0-9]+)\s+.*?\b(TR_\d+)\b.*?\b([0-9]{3,8})\b.*?\b((?:TH|GT)-[0-9]+)\b.*?\b([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\b.*?([\d,]+\.\d{2})/i);

  let doctoSap = '';
  let facturaFolio = '';
  let contrareciboNumber = '';
  let paymentDate = '';
  let rowAmount = 0;

  if (rowMatch) {
    doctoSap = rowMatch[1] || '';
    facturaFolio = rowMatch[3] || '';
    contrareciboNumber = rowMatch[4] ? rowMatch[4].toUpperCase() : '';
    paymentDate = rowMatch[5] || '';
    rowAmount = parseFloat(rowMatch[6].replace(/,/g, '')) || 0;
  } else {
    // Extracciones individuales de respaldo
    const crMatch = text.match(/\b((?:TH|GT)-[0-9]+)\b/i);
    if (crMatch) contrareciboNumber = crMatch[1].toUpperCase();

    const facMatch = text.match(/Factura\s*[:#]?\s*([0-9]{3,8})/i) ||
                     text.match(/\bTR_\d+\s+([0-9]{3,8})\b/i);
    if (facMatch) facturaFolio = facMatch[1];

    const dateMatch = text.match(/Fecha\s*Pago\s*[:#]?\s*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})/i) ||
                      text.match(/\b([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4})\b/);
    if (dateMatch) paymentDate = dateMatch[1];

    const sapMatch = text.match(/\b([0-9]+\/[0-9]+)\b/);
    if (sapMatch) doctoSap = sapMatch[1];
  }

  const finalAmount = rowAmount > 0 ? rowAmount : amount;
  const upperCr = contrareciboNumber.toUpperCase();
  const department: 'TH' | 'GT' | 'OTHER' = upperCr.startsWith('TH') ? 'TH' : upperCr.startsWith('GT') ? 'GT' : 'OTHER';

  return {
    contrareciboNumber: upperCr,
    paymentDate,
    bancoCargo: 'TRANSFERENCIA',
    transferRef,
    amount: finalAmount,
    currency: 'MXN',
    observaciones: `Detalle de Pagos Providencia ${transferRef} - Factura #${facturaFolio} - CR ${upperCr}${doctoSap ? ` (SAP ${doctoSap})` : ''}`,
    facturaFolio,
    department,
  };
}
