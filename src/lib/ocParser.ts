import type { PurchaseOrderItem } from './types';

/**
 * Parser unico para el texto pegado de una Orden de Compra (OC) de
 * Providencia. Antes existian DOS implementaciones divergentes:
 * - TabResumen -> parseOCAndFill (en OrderModalProvider.tsx): solo sacaba
 *   folio/cliente, y el total de kilos con una regex generica que agarraba
 *   el primer numero despues de "BOLSA" -- con una OC real, esa regex
 *   capturaba el "120" de "120X125 CM" (una medida, no una cantidad),
 *   subiendo el pedido con 120 kg en vez de los 3,700 kg reales.
 * - TabProductos -> handlePasteOC: si extraia articulos, pero su regex de
 *   linea capturaba solo los NUMEROS FINALES de la linea (P.U., Dtos,
 *   Importe) porque la descripcion del articulo queda ENTRE la Cantidad y
 *   el P.U. en el formato real ("1 EGBO000095-SC 1,000.0000 BOLSA
 *   POLIETILENO 120X 125 CM _Sin Color 43.0000 0.0000 43,000.0000") -- la
 *   Cantidad real (1,000.0000) se quedaba pegada dentro del texto de la
 *   descripcion, y el codigo tomaba el Precio Unitario (43) como si fuera
 *   la Cantidad.
 *
 * Se unifica en una sola funcion correcta, probada contra una OC real
 * (Grupo Textil Providencia, OC 12026439713, 10/08/2026), y ambos botones
 * de "Pegar Texto de OC" la usan.
 */

export interface ParsedOC {
  oc: string;           // Numero real y largo de la OC (ej. "12026439713"), de "CDB OC:"
  folio: string;        // Folio interno corto (ej. "43/9713"), de "No. Ord. de Compra:"
  provider: string;     // De la seccion "Proveedor"
  client: string;       // Cliente detectado (Providencia u otro, de la primera linea)
  items: PurchaseOrderItem[];
  totalKilograms: number;      // Suma de las cantidades de cada articulo
  estimatedDeliveryDate: Date | null;  // De "Fecha Entrega: DD-mes-YYYY"
}

const MESES: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

// Linea de articulo real: {No.} {Codigo} {Cantidad} {Descripcion...} {P.U.} {Dtos} {Importe}
// La descripcion queda capturada de forma no-voraz entre la Cantidad y los
// 3 numeros finales -- funciona incluso si la descripcion misma contiene
// numeros con decimales (medidas como "1.20 M X 1.60 M"), porque el motor
// de regex solo se detiene cuando encuentra exactamente 3 tokens
// decimales consecutivos justo antes del fin de linea.
const ITEM_LINE_RE = /^\s*\d+\s+(\S+)\s+([\d,]+\.\d+)\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s*$/gm;

export function parseOrdenDeCompra(text: string): ParsedOC {
  const items: PurchaseOrderItem[] = [];
  if (text) {
    for (const m of text.matchAll(ITEM_LINE_RE)) {
      const [, code, cantidadStr, descRaw, puStr, , importeStr] = m;
      const desc = descRaw.trim();
      if (/subtotal|^total$/i.test(desc)) continue;
      const quantity = Number(cantidadStr.replace(/,/g, ''));
      if (!quantity || quantity <= 0) continue;
      items.push({
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        code: code.trim(),
        description: desc,
        quantity,
        unitPrice: Number(puStr.replace(/,/g, '')),
        amount: Number(importeStr.replace(/,/g, '')),
        unit: 'Kilos',
      });
    }
  }

  const ocMatch = text?.match(/CDB OC:\s*([\w/]+)/i);
  const folioMatch = text?.match(/No\.?\s*Ord(?:en)?\.?\s*de\s*Compra:\s*([^\s\n\r]+)/i);
  const providerMatch = text?.match(/Proveedor\s*\n\s*([^\n]+)/i);

  const isProvidencia = !!text?.match(/PROVIDENCIA/i);
  let client = '';
  if (isProvidencia) {
    client = 'GRUPO TEXTIL PROVIDENCIA SA DE CV';
  } else if (text) {
    const firstLine = text.split('\n')[0]?.split('|')[0]?.trim() ?? '';
    if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.includes(':')) {
      client = firstLine;
    }
  }

  let estimatedDeliveryDate: Date | null = null;
  const fechaMatch = text?.match(/Fecha Entrega:\s*(\d{1,2})-([a-záéíóúA-ZÁÉÍÓÚ]+)-(\d{4})/i);
  if (fechaMatch) {
    const dia = Number(fechaMatch[1]);
    const mes = MESES[fechaMatch[2].toLowerCase()];
    const anio = Number(fechaMatch[3]);
    if (!isNaN(dia) && mes !== undefined && !isNaN(anio)) {
      estimatedDeliveryDate = new Date(anio, mes, dia, 12, 0, 0);
    }
  }

  const kilosFromItems = round2sum(items);

  return {
    oc: ocMatch ? ocMatch[1].trim() : '',
    folio: folioMatch ? folioMatch[1].trim() : '',
    provider: providerMatch ? providerMatch[1].trim() : '',
    client,
    items,
    totalKilograms: kilosFromItems,
    estimatedDeliveryDate,
  };
}

function round2sum(items: PurchaseOrderItem[]): number {
  const sum = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  return Math.round(sum * 100) / 100;
}
