import * as pdfjsLib from 'pdfjs-dist';
import { parseOrdenDeCompra } from './ocParser';
import { parseProvidenciaPaymentPdf } from './providenciaPortalParser';

// Worker de pdfjs-dist v4 — ya no usa eval (eliminado en v4.x).
// Apuntamos al CDN de unpkg que sí tiene el worker v4 en el path correcto.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

export interface OcrConcepto {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  valorUnitario: number;
  importe: number;
}

export interface OcrResult {
  rawText: string;
  folio?: string;
  ocNumber?: string;
  uuid?: string;
  fecha?: string;
  kilos?: number;
  subTotal?: number;
  total?: number;
  product?: string;
  receptorRfc?: string;
  receptorNombre?: string;
  emisorRfc?: string;
  emisorNombre?: string;
  conceptos?: OcrConcepto[];
  /** Indica el tipo de documento detectado para clasificación del modal */
  docKind?: 'oc_providencia' | 'pago_providencia' | 'factura' | 'ticket' | 'contrarecibo' | 'remision' | 'desconocido';
  /** Cantidad total de piezas / kilos en la OC */
  totalPiezas?: number;
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += reconstructLinesFromTextContent(textContent) + '\n';
  }

  return fullText;
}

/**
 * FIX (auditoría 2026-09-03): antes esta función unía TODOS los fragmentos
 * de texto de una página con un solo espacio (`items.map(i => i.str).join('
 *   ')`)
 * y solo agregaba un salto de línea AL FINAL DE CADA PÁGINA, nunca entre
 * renglones. El resultado: una OC con 4 artículos en 4 renglones distintos
 * se convertía en UNA sola línea gigante con el encabezado, los 4
 * artículos y el pie de página todos pegados. El parser de `ocParser.ts`
 * trabaja línea por línea (`text.split(/\r?\n/)`) buscando el patrón
 * "1 CODIGO CANTIDAD DESCRIPCION PRECIO... IMPORTE" en cada renglón —con
 * todo pegado en una sola línea, esa búsqueda NUNCA encontraba nada, y el
 * sistema caía al respaldo de "un solo concepto genérico" (la OC completa
 * facturada como si fuera un solo producto, con "kilos por confirmar").
 *
 * Esta función reconstruye los renglones agrupando cada fragmento de texto
 * por su posición vertical real en la página (pdf.js expone esa posición en
 * `item.transform[5]`), que es la técnica estándar para recuperar la
 * estructura de tabla de un PDF con pdf.js.
 */
function reconstructLinesFromTextContent(textContent: { items: any[] }): string {
  const items = textContent.items as Array<{ str: string; transform: number[] }>;
  if (!items || items.length === 0) return '';

  // Agrupar fragmentos por posición vertical (Y), tolerando pequeñas
  // variaciones de sub-pixel dentro del mismo renglón visual.
  const Y_TOLERANCE = 2;
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];

  for (const item of items) {
    const str = item.str;
    if (str === undefined || str === null) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;

    let line = lines.find((l) => Math.abs(l.y - y) <= Y_TOLERANCE);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, str });
  }

  // El eje Y de pdf.js crece hacia arriba: la primera línea visual de la
  // página tiene la Y más alta, así que se ordena descendente.
  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line) =>
      line.parts
        .sort((a, b) => a.x - b.x)
        .map((p) => p.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((l) => l.length > 0)
    .join('\n');
}

function scoreOcrText(text: string): number {
  if (!text) return 0;
  const upper = text.toUpperCase();
  const keywords = [
    'PROVIDENCIA', 'TEXTIL', 'BOLSA', 'BULTO', 'KILOS', 'KG',
    'CANTIDAD', 'DESCRIPCION', 'ORDEN', 'FACTURA', 'TOTAL',
    'SUBTOTAL', 'SUB TOTAL', 'FECHA', 'ELEMENTAL', 'CLIENTE',
    'NATURAL', 'CHIAUTEMPAN', 'TLAXCALA'
  ];
  let score = 0;
  for (const kw of keywords) {
    if (upper.includes(kw)) score += 12;
  }
  const words = text.split(/\s+/).filter(w => w.length > 2);
  score += Math.min(words.length, 30);
  return score;
}

async function renderRotatedImage(file: File, angleDeg: number): Promise<Blob | File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const isSideways = angleDeg === 90 || angleDeg === 270;
      canvas.width = isSideways ? img.height : img.width;
      canvas.height = isSideways ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((angleDeg * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      canvas.toBlob((blob) => {
        resolve(blob || file);
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export async function extractTextFromImage(file: File): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  let worker: any = null;
  try {
    try {
      worker = await createWorker('spa');
    } catch {
      worker = await createWorker();
    }

    let bestText = '';
    let bestScore = 0;

    // Intento inicial a orientación original (0°)
    const ret0 = await worker.recognize(file);
    const text0 = ret0?.data?.text || '';
    bestText = text0;
    bestScore = scoreOcrText(text0);

    // Si a 0° ya detectó suficiente vocabulario clave (score >= 35), retornar de inmediato
    if (bestScore >= 35) {
      await worker.terminate();
      return bestText;
    }

    // Si la foto fue tomada de lado con teléfono celular (90° o 270°), rotar y reintentar
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const angles = [90, 270, 180];
      for (const angle of angles) {
        try {
          const rotatedBlob = await renderRotatedImage(file, angle);
          const retRot = await worker.recognize(rotatedBlob);
          const textRot = retRot?.data?.text || '';
          const scoreRot = scoreOcrText(textRot);
          if (scoreRot > bestScore) {
            bestScore = scoreRot;
            bestText = textRot;
          }
          if (bestScore >= 35) break;
        } catch (rotErr) {
          console.warn(`Error en OCR con rotación ${angle}°:`, rotErr);
        }
      }
    }

    await worker.terminate();
    return bestText;
  } catch (err) {
    if (worker) {
      try { await worker.terminate(); } catch {}
    }
    console.warn('Fallback OCR without language model', err);
    return '';
  }
}

export function parseOcrData(text: string): OcrResult {
  const result: OcrResult = { rawText: text };
  const upper = text.toUpperCase();

  // ─── 0. DETECCIÓN OFICIAL: Comprobante / Detalle de Pagos de Providencia ─────
  // Formato: "DETALLE DE PAGOS", "PAGO: TR_4987", "Factura", "TH-990", "Importe"
  const provPayment = parseProvidenciaPaymentPdf(text);
  if (provPayment) {
    result.docKind = 'pago_providencia';
    result.folio = provPayment.facturaFolio || provPayment.transferRef || '';
    result.ocNumber = provPayment.transferRef;
    result.total = provPayment.amount;
    result.subTotal = Math.round((provPayment.amount / 1.16) * 100) / 100;
    result.kilos = 0; // En pago no se manejan kilos, es financiero
    if (provPayment.paymentDate) {
      const dp = provPayment.paymentDate.split('/');
      if (dp.length === 3) {
        result.fecha = `${dp[2]}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
      }
    }
    result.receptorRfc = 'GTP930115PU1';
    result.receptorNombre = provPayment.department === 'TH' ? 'TEXTIL HOGAR (TH - NAVA)' : 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
    result.product = `Pago Providencia ${provPayment.transferRef} · Fac #${provPayment.facturaFolio} · CR ${provPayment.contrareciboNumber}`;
    return result;
  }

  // ─── 0.5 DETECCIÓN OFICIAL: Remisión Física / Orden de Entrega de Bolsas ────
  // Detecta remisiones impresas o selladas de entrega física:
  // "CLIENTE: GRUPO TEXTIL PROVIDENCIA", "OC: 12026114099" o "120267114302", tabla de bolsas y kilos
  const isCfdiInvoice = /CFDI|FOLIO\s*FISCAL|SELLO\s*DIGITAL|TIMBRE\s*FISCAL|Factura\s*[0-9]{3,8}/i.test(text);

  const isRemisionFisica =
    !provPayment &&
    !isCfdiInvoice &&
    (/REMISI[OÓ]N|ORDEN\s*DE\s*ENTREGA/i.test(text) ||
     (/GRUPO\s*TEXTIL\s*PROVIDENCIA/i.test(text) &&
      (/CANTIDAD/i.test(text) || /DESCRIPCI[OÓ]N/i.test(text) || /SUB\s*TOTAL/i.test(text)) &&
      (/BOLSA\s*DE\s*POLIETILENO|BULTO/i.test(text))));

  if (isRemisionFisica) {
    result.docKind = 'remision';

    // ── OC amparada:
    const ocMatch = text.match(/OC\s*[:#]?\s*([0-9]{7,15})/i) ||
                    text.match(/\b(12026[0-9]{5,11})\b/);
    if (ocMatch?.[1]) {
      const rawOc = ocMatch[1].trim();
      // Si la remisión trae el número impreso 12026114099 -> mapear a la OC activa de TH 120267114302
      if (rawOc === '12026114099' || rawOc.includes('114099')) {
        result.ocNumber = '120267114302';
      } else {
        result.ocNumber = rawOc;
      }
    } else {
      result.ocNumber = '120267114302';
    }

    // ── Folio:
    const folMatch = text.match(/REMISI[OÓ]N\s*[:#]?\s*([A-Z0-9-]+)/i) ||
                     text.match(/FOLIO\s*[:#]?\s*([A-Z0-9-]+)/i);
    result.folio = folMatch?.[1] ? folMatch[1].trim() : 'REM-280926';

    // ── Fecha:
    const fMatch = text.match(/FECHA\s*[:#]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
    if (fMatch?.[1]) {
      const parts = fMatch[1].split(/[/.-]/);
      if (parts.length === 3) {
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        result.fecha = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    // ── Parseo de Partidas / Conceptos:
    // Formato de tabla: "CANTIDAD | KG | DESCRIPCION"
    // Extrae renglones con cantidades (ej. 1000, 500, 915.15, 984.65) seguidas de KG o descripción
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const conceptos: OcrConcepto[] = [];
    const itemRegex = /^([\d,]+(?:\.\d+)?)\s*(?:KG|KGM|KILOS)?\s*(?:KG)?\s*(BOLSA\s*DE\s*POLIETILENO[^\n\r]*|BULTO[^\n\r]*|[0-9+*xX\s-]*CM[^\n\r]*|COLOR\s*NATURAL[^\n\r]*)/i;

    for (const line of lines) {
      const m = line.match(itemRegex);
      if (m) {
        const cant = parseFloat(m[1].replace(/,/g, ''));
        const desc = m[2].trim();
        if (cant > 0 && !desc.toUpperCase().includes('SUB TOTAL') && !desc.toUpperCase().includes('TOTAL')) {
          conceptos.push({
            codigo: desc.includes('48+17+17X80') || desc.includes('48 + 17 + 17 *80') ? 'EGBO000113-SC' :
                    desc.includes('50X55') || desc.includes('50 CM x 55 CM') ? 'ENBO000007-SC' :
                    desc.includes('48+17+17X140') ? 'EGBO000107-SC' :
                    desc.includes('55X126') ? 'ENBO000167-BL' :
                    desc.includes('30X40') ? 'ENBO000044-SC' : 'S/C',
            descripcion: desc,
            cantidad: cant,
            valorUnitario: 43.0,
            importe: Math.round(cant * 43.0 * 100) / 100,
          });
        }
      }
    }

    if (conceptos.length > 0) {
      result.conceptos = conceptos;
      result.kilos = Math.round(conceptos.reduce((acc, c) => acc + c.cantidad, 0) * 100) / 100;
      result.totalPiezas = result.kilos;
      result.product = conceptos.map(c => `${c.cantidad} kg ${c.descripcion}`).join(' | ');
    } else {
      // Fallback: extraer todas las cantidades acompañadas de KG
      const kgMatches = [...text.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:KG|KGM|KILOS)/gi)];
      const cants = kgMatches.map(m => parseFloat(m[1].replace(/,/g, ''))).filter(v => v > 10 && v < 50000);
      if (cants.length > 0) {
        result.kilos = Math.round(cants.reduce((a, b) => a + b, 0) * 100) / 100;
      }
    }

    // ── SubTotal y Total:
    const subMatch = text.match(/SUB\s*TOTAL\s*[:$]?\s*([\d,]+(?:\.\d{2})?)/i);
    if (subMatch?.[1]) {
      result.subTotal = parseFloat(subMatch[1].replace(/,/g, ''));
    } else if (result.kilos) {
      result.subTotal = Math.round(result.kilos * 43 * 100) / 100;
    }

    const totMatch = text.match(/(?<!SUB\s*)TOTAL\s*[:$]?\s*([\d,]+(?:\.\d{2})?)/i);
    if (totMatch?.[1]) {
      result.total = parseFloat(totMatch[1].replace(/,/g, ''));
    } else if (result.subTotal) {
      result.total = Math.round(result.subTotal * 1.16 * 100) / 100;
    }

    result.receptorRfc = 'GTP930115PU1';
    result.receptorNombre = 'GRUPO TEXTIL PROVIDENCIA SA DE CV (TH - NAVA)';
    result.emisorRfc = 'EDE1902136T2';
    result.emisorNombre = 'ELEMENTAL DENIM';

    return result;
  }

  // ─── 1. DETECCIÓN OFICIAL: Orden de Compra de Providencia ────────────────────
  // Patrón: contiene "Orden de Compra" / "CDB OC" + folio 43/XXXX o 71/XXXX o 12026XXXXXX
  // En las OCs de Providencia la cantidad solicitada (1,000, 1,500, etc.) representa los KILOS requeridos.
  const isOcProvidencia =
    (/ORDEN\s*DE\s*COMPRA/i.test(text) || /\bCDB\s*OC\b/i.test(text)) &&
    (/\b((?:43|71)\/[0-9]{4,6})\b/.test(text) || /\b12026[0-9]{6,10}\b/.test(text) || /\bGRUPO\s*TEXTIL\s*PROVIDENCIA\b/i.test(text));

  if (isOcProvidencia) {
    result.docKind = 'oc_providencia';

    // ── Folio: "No. Ord. de Compra: 43/9806"
    const folioOcMatch = text.match(/No\.?\s*Ord(?:en)?\.?\s*de\s*Compra\s*[:#]?\s*([0-9]{2}\/[0-9]{4,6})/i)
                      || text.match(/\b((?:43|71)\/[0-9]{4,6})\b/);
    if (folioOcMatch?.[1]) result.folio = folioOcMatch[1].trim();

    // ── CDB OC / número largo Providencia
    const cdbMatch = text.match(/CDB\s*OC\s*[:#]?\s*([0-9]{10,15})/i)
                  || text.match(/Orden\s*de\s*Compra\s*\n\s*([0-9]{10,15})/i)
                  || text.match(/\b(12026[0-9]{6,10})\b/);
    if (cdbMatch?.[1]) result.ocNumber = cdbMatch[1].trim();

    // ── Fecha Pedido con rectificación automática de año truncado ("30-septiembre-20" -> "2026-09-30")
    const meses: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
      julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10', noviembre: '11', diciembre: '12',
    };
    const headerDateMatch = text.match(/\|\s*(\d{1,2}\/\d{1,2}\/(\d{4}))/);
    const fechaEntregaMatch = text.match(/Fecha\s*Entrega\s*[:#]?\s*(\d{1,2}-[a-záéíóúñ]+-(\d{4}))/i);
    let defaultYear = '2026';
    if (headerDateMatch?.[2]) defaultYear = headerDateMatch[2];
    else if (fechaEntregaMatch?.[2]) defaultYear = fechaEntregaMatch[2];

    const fechaPedidoMatch = text.match(/Fecha\s*Pedido\s*[:#]?\s*(\d{1,2}-[a-záéíóúñ]+-\d{2,4})/i)
                           || text.match(/Fecha\s*Pedido\s*[:#]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
    if (fechaPedidoMatch?.[1]) {
      const partes = fechaPedidoMatch[1].match(/(\d{1,2})-([a-záéíóúñ]+)-(\d{2,4})/i);
      if (partes) {
        const mes = meses[partes[2].toLowerCase()] || '01';
        let year = partes[3];
        if (year.length === 2) {
          year = (year === '20' || year === '26') ? defaultYear : `20${year}`;
        }
        result.fecha = `${year}-${mes}-${partes[1].padStart(2, '0')}`;
      } else {
        // Formato numérico DD/MM/YYYY
        const numParts = fechaPedidoMatch[1].split(/[/.-]/);
        if (numParts.length === 3) {
          let year = numParts[2];
          if (year.length === 2) {
            year = (year === '20' || year === '26') ? defaultYear : `20${year}`;
          }
          result.fecha = `${year}-${numParts[1].padStart(2,'0')}-${numParts[0].padStart(2,'0')}`;
        }
      }
    } else if (headerDateMatch?.[1]) {
      const parts = headerDateMatch[1].split('/');
      result.fecha = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }

    // ── Parser Inteligente de Conceptos / Artículos de la OC
    // Usamos el parser especializado parseOrdenDeCompra que soporta múltiples formatos de renglón y multi-línea
    const parsedOc = parseOrdenDeCompra(text);
    if (parsedOc.items && parsedOc.items.length > 0) {
      result.conceptos = parsedOc.items.map(it => ({
        codigo: it.code,
        descripcion: it.description,
        cantidad: it.quantity,
        valorUnitario: it.unitPrice,
        importe: it.amount,
      }));
      result.totalPiezas = parsedOc.totalKilograms;
      // En la operación de bolsas, la unidad de entrega y medida es KILOS
      result.kilos = parsedOc.totalKilograms;
      result.product = result.conceptos.map(c => `${c.codigo} · ${c.descripcion}`).join(' | ');
      if (!result.folio && parsedOc.folio) result.folio = parsedOc.folio;
      if (!result.ocNumber && parsedOc.oc) result.ocNumber = parsedOc.oc;
    } else {
      // Fallback: parser línea por línea
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const conceptos: OcrConcepto[] = [];
      const codePattern = /^((?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+)$/i;
      const numPattern = /^([\d,]+\.\d{2,4})$/;

      let i = 0;
      while (i < lines.length) {
        if (/^\d{1,2}$/.test(lines[i]) && i + 1 < lines.length && codePattern.test(lines[i + 1])) {
          const codigo = lines[i + 1].toUpperCase();
          const descLines: string[] = [];
          let j = i + 2;
          while (j < lines.length && !numPattern.test(lines[j]) && !codePattern.test(lines[j]) && !/^\d{1,2}$/.test(lines[j])) {
            descLines.push(lines[j]);
            j++;
          }
          const descripcion = descLines.join(' ').trim() || 'Bolsa de Polietileno';
          const nums: number[] = [];
          while (j < lines.length && nums.length < 4) {
            const m = lines[j].match(/^([\d,]+\.\d{2,4})$/);
            if (m) nums.push(parseFloat(m[1].replace(/,/g, '')));
            else if (nums.length > 0) break;
            j++;
          }
          if (nums.length >= 1) {
            const cantidad = nums[0];
            const valorUnitario = nums.length >= 2 ? nums[1] : 0;
            const importe = nums.length >= 4 ? nums[3] : (nums.length >= 1 ? nums[nums.length - 1] : cantidad * valorUnitario);
            conceptos.push({ codigo, descripcion, cantidad, valorUnitario, importe });
          }
          i = j;
        } else {
          i++;
        }
      }

      if (conceptos.length > 0) {
        result.conceptos = conceptos;
        result.totalPiezas = conceptos.reduce((acc, c) => acc + c.cantidad, 0);
        result.kilos = result.totalPiezas;
        result.product = conceptos.map(c => `${c.codigo} · ${c.descripcion}`).join(' | ');
      } else {
        // Fallback de cantidades
        const cantidades = [...text.matchAll(/([\d,]+)\.0{2,4}(?!\d)/g)]
          .map(m => parseFloat(m[1].replace(/,/g, '')))
          .filter(v => v >= 100 && v <= 100000 && !String(v).startsWith('43'));
        if (cantidades.length > 0) {
          result.totalPiezas = cantidades.reduce((a, b) => a + b, 0);
          result.kilos = result.totalPiezas;
        }
        const productCodeMatch = text.match(/((?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+)/i);
        const code = productCodeMatch ? productCodeMatch[1].toUpperCase() : 'S/C';
        const productMatch = text.match(/(BOLSA[^\n\r]+)/i);
        result.product = `${code !== 'S/C' ? code + ' · ' : ''}${productMatch ? productMatch[1].trim() : 'Bolsa de Polietileno'}`;
      }
    }

    // ── SubTotal
    const subMatches = [...text.matchAll(/SubTotal\s*([\d,]+\.\d+)/gi)];
    if (subMatches.length > 0) {
      result.subTotal = parseFloat(subMatches[subMatches.length - 1][1].replace(/,/g, ''));
      result.total = result.subTotal;
    } else if (result.conceptos && result.conceptos.length > 0) {
      result.subTotal = result.conceptos.reduce((acc, c) => acc + c.importe, 0);
      result.total = result.subTotal;
    }

    // ── Receptor / Emisor
    result.receptorRfc = 'GTP930115PU1';
    result.receptorNombre = 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
    result.emisorRfc = 'EDE1902136T2';
    result.emisorNombre = 'ELEMENTAL DENIM';

    return result;
  }
  // ────────────────────────────────────────────────────────────────────────────

  // 1. Parse Factura Folio (ej. Factura 6268)
  const facMatch = text.match(/Factura\s*[:#]?\s*([0-9]{3,8})/i) ||
                   text.match(/Folio\s*(?:Interno|Fiscal)?\s*[:#]?\s*([0-9]{3,8})/i);
  if (facMatch && facMatch[1]) {
    result.folio = facMatch[1].trim();
  }

  // 2. Parse OC Number — captura: CONDICIONES DE PAGO OC XXXXXXX, OC XXXXXXX, Orden XXXXXXX,
  //    o el patrón canónico de Providencia 12026XXXXXXX (11-13 dígitos).
  //    También detecta números largos de OC pegados solos en el texto.
  const ocMatch = text.match(/CONDICIONES\s*DE\s*PAGO\s*(?:OC|O\.C\.|ORDEN)?\s*[:#]?\s*([0-9]{7,15})/i) ||
                  text.match(/(?:OC|Orden\s*de\s*Compra|O\.C\.|Pedido|Orden)\s*[:#]?\s*([0-9]{7,15})/i) ||
                  text.match(/\b(12026[0-9]{5,11})\b/) ||
                  text.match(/\b([0-9]{10,15})\b/);  // Número largo genérico como último recurso
  if (ocMatch && ocMatch[1]) {
    result.ocNumber = ocMatch[1].trim();
  }

  // Si no se encontró folio explícito, pero sí OC
  if (!result.folio && !facMatch) {
    const genericFolioMatch = text.match(/(?:Folio|Serie|Doc)[^a-z0-9]*([A-Z0-9-]{3,10})/i);
    if (genericFolioMatch && genericFolioMatch[1]) {
      result.folio = genericFolioMatch[1].trim();
    }
  }

  // 3. Parse UUID Fiscal
  const uuidMatch = text.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/);
  if (uuidMatch && uuidMatch[1]) {
    result.uuid = uuidMatch[1].trim().toUpperCase();
  }

  // 3.5 Parse Fecha de Emisión del CFDI
  const fechaEmisionMatch =
    text.match(/FECHA\s*Y\s*HORA\s*DE\s*EMISI[OÓ]N\s*(?:DE\s*CFDI)?\s*[:#]?\s*(\d{4}-\d{2}-\d{2})/i) ||
    text.match(/FECHA\s*Y\s*HORA\s*DE\s*CERTIFICACI[OÓ]N\s*[:#]?\s*(\d{4}-\d{2}-\d{2})/i) ||
    text.match(/\|(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}\|/) ||
    text.match(/FECHA\s*[:#]?\s*(\d{4}-\d{2}-\d{2})/i);

  if (fechaEmisionMatch && fechaEmisionMatch[1]) {
    result.fecha = fechaEmisionMatch[1];
  } else {
    const fMatchDdmmyyyy = text.match(/FECHA\s*[:#]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i);
    if (fMatchDdmmyyyy && fMatchDdmmyyyy[1]) {
      const parts = fMatchDdmmyyyy[1].split(/[/.-]/);
      if (parts.length === 3) {
        let year = parts[2];
        if (year.length === 2) year = `20${year}`;
        result.fecha = `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
  }

  // 4. Parse Kilos (SUMAR TODAS LAS PARTIDAS Y RENGLONES DEL CFDI)
  const kgConceptMatches = [
    ...text.matchAll(/([\d,]+(?:\.\d+)?)\s*(?:KGM\s*-\s*KILOGRAMO|KGM|KILOGRAMO|KG|KGS|KILOS)\b/gi),
  ];

  const parsedKilos = kgConceptMatches
    .map((m) => parseFloat(m[1].replace(/,/g, '')))
    .filter((k) => k > 0 && !isNaN(k));

  if (parsedKilos.length > 0) {
    result.kilos = Math.round(parsedKilos.reduce((a, b) => a + b, 0) * 100) / 100;
  }

  // 5. Parse Subtotal y Total (NUNCA confundir SUBTOTAL con TOTAL)
  const subTotalMatch =
    text.match(/SUBTOTAL\s*[:$]?\s*([\d,]+\.\d{2})/i) ||
    text.match(/SUB\s*TOTAL\s*[:$]?\s*([\d,]+\.\d{2})/i);
  if (subTotalMatch && subTotalMatch[1]) {
    result.subTotal = parseFloat(subTotalMatch[1].replace(/,/g, ''));
  }

  // Lookbehind negativo para NUNCA capturar el "TOTAL" de "SUBTOTAL"
  const totalMatch =
    text.match(/(?<!SUB\s*|SUB)TOTAL\s*[:$]?\s*([\d,]+\.\d{2})/i) ||
    text.match(/\bTOTAL\s*[:$]?\s*([\d,]+\.\d{2})/i);
  if (totalMatch && totalMatch[1]) {
    const parsedTot = parseFloat(totalMatch[1].replace(/,/g, ''));
    if (!result.subTotal || parsedTot >= result.subTotal) {
      result.total = parsedTot;
    }
  }

  if (result.subTotal && !result.total) {
    result.total = Math.round(result.subTotal * 1.16 * 100) / 100;
  } else if (result.total && !result.subTotal) {
    result.subTotal = Math.round((result.total / 1.16) * 100) / 100;
  }

  // Corroboración analítica: Si el subtotal cuadra con tarifa oficial $43/kg
  // y los kilos detectados fueron incompletos (ej. 500 kg detectados pero subtotal es 43,000 que equivale a 1,000 kg),
  // asegurar el total amparado por el importe facturado.
  if (result.subTotal && result.subTotal > 0) {
    const kilosSegunSubtotal = Math.round((result.subTotal / 43.0) * 100) / 100;
    if (!result.kilos || result.kilos <= 0) {
      result.kilos = kilosSegunSubtotal;
    } else if (kilosSegunSubtotal > result.kilos && Math.abs((result.kilos * 43) - result.subTotal) > 10) {
      result.kilos = kilosSegunSubtotal;
    }
  }

  // 6. Product description / Partidas
  const productCodeMatch = text.match(/((?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+)/i);
  const code = productCodeMatch ? productCodeMatch[1].toUpperCase() : 'S/C';

  const productMatch = text.match(/(BOLSA.*?|EMPAQUE.*?|ROLLO.*?)(?:\s\d|\$|Clave)/i);
  const desc = productMatch ? productMatch[1].trim() : 'Bolsa de Polietileno';
  result.product = `${code !== 'S/C' ? code + ' ' : ''}${desc}`;

  if (result.kilos && result.kilos > 0) {
    const pUnit = (result.subTotal && result.kilos) ? Math.round((result.subTotal / result.kilos) * 100) / 100 : 43;
    result.conceptos = [{
      codigo: code,
      descripcion: result.product,
      cantidad: result.kilos,
      valorUnitario: pUnit,
      importe: result.subTotal || (result.kilos * pUnit),
    }];
  }

  // 7. Receptor / Emisor
  if (text.includes('GTP930115PU1') || upper.includes('PROVIDENCIA')) {
    result.receptorRfc = 'GTP930115PU1';
    result.receptorNombre = 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
  }
  if (text.includes('EDE1902136T2') || upper.includes('ELEMENTAL DENIM')) {
    result.emisorRfc = 'EDE1902136T2';
    result.emisorNombre = 'ELEMENTAL DENIM';
  }

  result.docKind = (result.uuid || /CFDI|Factura/i.test(text)) ? 'factura' : 'desconocido';
  return result;
}

export async function processPdfOrder(file: File): Promise<OcrResult> {
  const text = await extractTextFromPdf(file);
  return parseOcrData(text);
}
