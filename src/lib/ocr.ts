import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// We need to set the worker source. In Vite, we can point to the local file.
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

export async function extractTextFromImage(file: File): Promise<string> {
  try {
    const worker = await createWorker('spa');
    const ret = await worker.recognize(file);
    await worker.terminate();
    return ret.data.text || '';
  } catch (err) {
    console.warn('Fallback OCR without language model', err);
    const worker = await createWorker();
    const ret = await worker.recognize(file);
    await worker.terminate();
    return ret.data.text || '';
  }
}

export function parseOcrData(text: string): OcrResult {
  const result: OcrResult = { rawText: text };

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

  // 4. Parse Kilos
  const kilosMatch = text.match(/([\d,]+(?:\.\d+)?)\s*(?:KGM|KILOGRAMO|KG|KGS|KILOS)/i);
  if (kilosMatch && kilosMatch[1]) {
    result.kilos = parseFloat(kilosMatch[1].replace(/,/g, ''));
  }

  // 5. Parse Subtotal y Total
  const subTotalMatch = text.match(/SUBTOTAL\s*\$?\s*([\d,]+\.\d{2})/i);
  if (subTotalMatch && subTotalMatch[1]) {
    result.subTotal = parseFloat(subTotalMatch[1].replace(/,/g, ''));
  }

  const totalMatch = text.match(/TOTAL\s*\$?\s*([\d,]+\.\d{2})/i);
  if (totalMatch && totalMatch[1]) {
    result.total = parseFloat(totalMatch[1].replace(/,/g, ''));
  } else {
    const moneyMatches = [...text.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
    if (moneyMatches.length > 0) {
      const amounts = moneyMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
      result.total = Math.max(...amounts);
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
  if (text.includes('GTP930115PU1') || text.toUpperCase().includes('PROVIDENCIA')) {
    result.receptorRfc = 'GTP930115PU1';
    result.receptorNombre = 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
  }
  if (text.includes('EDE1902136T2') || text.toUpperCase().includes('ELEMENTAL DENIM')) {
    result.emisorRfc = 'EDE1902136T2';
    result.emisorNombre = 'ELEMENTAL DENIM';
  }

  return result;
}

export async function processPdfOrder(file: File): Promise<OcrResult> {
  const text = await extractTextFromPdf(file);
  return parseOcrData(text);
}
