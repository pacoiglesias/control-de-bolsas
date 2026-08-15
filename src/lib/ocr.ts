import * as pdfjsLib from 'pdfjs-dist';

// We need to set the worker source. In Vite, we can point to the local file.
// For production, we can rely on a CDN or local assets, but typically:
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface OcrResult {
  rawText: string;
  folio?: string;
  kilos?: number;
  total?: number;
  product?: string;
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

export function parseOcrData(text: string): OcrResult {
  const result: OcrResult = { rawText: text };

  // 1. Parse Folio / OC
  // Look for "OC", "Orden", "Folio" followed by a number
  const folioMatch = text.match(/(?:OC|Orden de Compra|Folio|Pedido)[^a-z0-9]*([A-Z0-9-]{4,15})/i);
  if (folioMatch && folioMatch[1]) {
    result.folio = folioMatch[1].trim();
  }

  // 2. Parse Kilos
  // Look for a number followed by KG, KGS, KILOS
  // or a number in a column that could be quantity
  const kilosMatch = text.match(/([\d,]+\.?\d*)\s*(?:KG|KGS|KILOS)/i);
  if (kilosMatch && kilosMatch[1]) {
    result.kilos = parseFloat(kilosMatch[1].replace(/,/g, ''));
  }

  // 3. Parse Total
  // Look for a $ sign followed by a number with decimals
  // We match all of them and probably take the largest or the last one (usually the Grand Total)
  const moneyMatches = [...text.matchAll(/\$\s*([\d,]+\.\d{2})/g)];
  if (moneyMatches.length > 0) {
    const amounts = moneyMatches.map(m => parseFloat(m[1].replace(/,/g, '')));
    result.total = Math.max(...amounts); // The grand total is usually the largest amount
  }
  
  // 4. Product description
  // This is highly specific to the PDF format, but we can look for common keywords like "BOLSA", "EMPAQUE", "ROLLO"
  const productMatch = text.match(/(BOLSA.*?|EMPAQUE.*?|ROLLO.*?)(?:\s\d|\$)/i);
  if (productMatch && productMatch[1]) {
    result.product = productMatch[1].trim();
  }

  return result;
}

export async function processPdfOrder(file: File): Promise<OcrResult> {
  const text = await extractTextFromPdf(file);
  return parseOcrData(text);
}
