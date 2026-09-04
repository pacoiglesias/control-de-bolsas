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

    // 2. Extraer todas las partidas de facturas amparadas en el HTML
    const rowRegex = /<tr[^>]*name="l_\d+"[^>]*>\s*<td[^>]*>([0-9]{3,8})<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([0-9,]+\.[0-9]{2})<\/td>/gi;
    const rowMatches = [...text.matchAll(rowRegex)];

    // 5. Fechas de Recepción y Pago
    const fecRecMatch = text.match(/Fecha\s*Recepci[oó]n:\s*<strong>([0-9]{2}\/[0-9]{2}\/[0-9]{4})<\/strong>/i) ||
                        text.match(/Fecha\s*Recepci[oó]n:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const fechaRecepcion = fecRecMatch ? fecRecMatch[1].trim() : undefined;

    const fecPagoMatch = text.match(/Fecha\s*Pago:\s*<strong>([0-9]{2}\/[0-9]{2}\/[0-9]{4})<\/strong>/i) ||
                         text.match(/Fecha\s*Pago:\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i);
    const fechaPago = fecPagoMatch ? fecPagoMatch[1].trim() : undefined;

    // 6. Cadena Original
    const cadMatch = text.match(/1\|\d{4}\|[A-Z0-9-]+\|[^<]+/);
    const cadenaOriginal = cadMatch ? cadMatch[0].trim() : undefined;

    // 7. Sello Digital
    const selloMatch = text.match(/Sello\s*digital[\s\S]*?<td[^>]*align="center">([\s\S]*?)<\/td>/i);
    const selloDigital = selloMatch ? selloMatch[1].replace(/<[^>]+>/g, '').trim() : undefined;

    // 8. Departamento TH vs GT
    const upperCr = contrareciboNumber.toUpperCase();
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
    } else {
      // 2. Factura Folio fallback
      const facMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>\s*<td[^>]*>([0-9]{3,8})<\/td>/i) ||
                       text.match(/Factura\s*No\.[\s\S]*?<td[^>]*>([0-9]{3,8})<\/td>/i) ||
                       text.match(/Factura\s*No\.?[^0-9]*([0-9]{3,8})/i);
      const facturaFolio = facMatch ? facMatch[1].trim() : '';

      // 3. Serie / Control Interno
      const serieMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>[\s\S]*?<td[^>]*>([0-9\s/]+)<\/td>/i);
      const serieControlInterno = serieMatch ? serieMatch[1].trim() : undefined;

      // 4. Importe
      const importeMatch = text.match(/<tr[^>]*name="l_\d+"[^>]*>[\s\S]*?<td[^>]*>([0-9,]+\.[0-9]{2})<\/td>/i) ||
                           text.match(/1\|\d{4}\|[A-Z0-9-]+\|[^|]+\|[^|]+\|([0-9.]+)\|/);
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
