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
    const pageText = textContent.items.map((item: any) => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  return fullText;
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

  // 2. Parse OC Number (ej. CONDICIONES DE PAGO OC 12026439713 o OC 120267114114)
  const ocMatch = text.match(/CONDICIONES DE PAGO\s*(?:OC|O\.C\.|ORDEN)?\s*[:#]?\s*([0-9]{7,15})/i) ||
                  text.match(/(?:OC|Orden de Compra|O\.C\.|Pedido|Orden)\s*[:#]?\s*([0-9]{7,15})/i) ||
                  text.match(/\b(12026[0-9]{6,10})\b/);
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
