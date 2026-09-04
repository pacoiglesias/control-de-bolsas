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

export function parseOrdenDeCompra(text: string): ParsedOC {
  const items: PurchaseOrderItem[] = [];
  if (text) {
    const lines = text.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      if (/subtotal|^total\b|importe con letra|orden de compra|p\.?\s*u\.?/i.test(line)) continue;

      // Formato A: {No.} {Codigo} {Cantidad} {Descripcion} {P.U.} {Dtos} {Importe}
      // Ej: "1 EGBO000095-SC 1,000.0000 BOLSA POLIETILENO 120X 125 CM _Sin Color 43.0000 0.0000 43,000.0000"
      const matchA = line.match(/^\s*\d+\s+([a-zA-Z0-9_-]+)\s+([\d,]+\.\d+)\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s*$/);
      if (matchA) {
        const [, code, cantidadStr, descRaw, puStr, , importeStr] = matchA;
        const desc = descRaw.trim();
        const quantity = Number(cantidadStr.replace(/,/g, ''));
        if (quantity > 0 && !/subtotal/i.test(desc)) {
          items.push({
            id: 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            code: code.trim(),
            description: desc,
            quantity,
            unitPrice: Number(puStr.replace(/,/g, '')),
            amount: Number(importeStr.replace(/,/g, '')),
            unit: 'Kilos',
          });
          continue;
        }
      }

      // Formato B: {No.} {Codigo} {Descripcion} {Cantidad} {P.U.} {Dtos} {Importe}
      // Ej: "1 egbo000107-sc BULTO POLIETILENO 48 x 17 + 17 x 140 CM CAL 250 1,000.0000 43.0000 0.0000 43,000.0000"
      const matchB = line.match(/^\s*\d+\s+([a-zA-Z0-9_-]+)\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s*$/);
      if (matchB) {
        const [, code, descRaw, cantidadStr, puStr, , importeStr] = matchB;
        const desc = descRaw.trim();
        const quantity = Number(cantidadStr.replace(/,/g, ''));
        if (quantity > 0 && !/subtotal/i.test(desc)) {
          items.push({
            id: 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            code: code.trim(),
            description: desc,
            quantity,
            unitPrice: Number(puStr.replace(/,/g, '')),
            amount: Number(importeStr.replace(/,/g, '')),
            unit: 'Kilos',
          });
          continue;
        }
      }

      // Formato C: {No.} {Descripcion} {Cantidad} {P.U.} {Importe} (Sin código explícito o 3 números al final)
      const matchC = line.match(/^\s*\d+\s+(.+?)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s+([\d,]+\.\d+)\s*$/);
      if (matchC) {
        const [, descRaw, cantidadStr, puStr, importeStr] = matchC;
        const desc = descRaw.trim();
        const quantity = Number(cantidadStr.replace(/,/g, ''));
        if (quantity > 0 && !/subtotal/i.test(desc)) {
          // Extraer posible código al inicio de la descripción si existe
          const codeMatch = desc.match(/^([a-zA-Z0-9_-]+)\s+(.+)$/);
          const finalCode = codeMatch ? codeMatch[1] : '';
          const finalDesc = codeMatch ? codeMatch[2] : desc;
          items.push({
            id: 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            code: finalCode,
            description: finalDesc,
            quantity,
            unitPrice: Number(puStr.replace(/,/g, '')),
            amount: Number(importeStr.replace(/,/g, '')),
            unit: 'Kilos',
          });
          continue;
        }
      }
    }
  }

  // Si no se encontraron items en renglones contiguos, analizar formato multi-línea (PDF vertical)
  if (items.length === 0 && text) {
    const rawLines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let i = 0;
    while (i < rawLines.length) {
      const line = rawLines[i];
      const isItemNum = /^\d{1,2}$/.test(line);
      const isProductCode = /^(?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+$/i.test(line) ||
                            /^[a-zA-Z]{2,6}[0-9]{3,8}-[a-zA-Z0-9]+$/i.test(line);

      let code = '';
      let desc = '';

      if (isItemNum && i + 1 < rawLines.length && (
        /^(?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+$/i.test(rawLines[i + 1]) ||
        /^[a-zA-Z]{2,6}[0-9]{3,8}-[a-zA-Z0-9]+$/i.test(rawLines[i + 1])
      )) {
        code = rawLines[i + 1];
        i += 2;
      } else if (isProductCode) {
        code = line;
        i += 1;
      } else {
        i++;
        continue;
      }

      // Extraer descripción
      const descLines: string[] = [];
      while (i < rawLines.length) {
        const cur = rawLines[i];
        if (/^(?:cantidad|p\.?\s*u\.?|dtos|importe|articulo)$/i.test(cur) ||
            /^[\d,]+(?:\.\d+)?$/.test(cur) ||
            /^\d{1,2}$/.test(cur) ||
            /^(?:EGBO|ENBO)[0-9]{6}-[A-Z0-9]+$/i.test(cur)) {
          break;
        }
        descLines.push(cur);
        i++;
      }
      desc = descLines.join(' ').trim();

      // Recolectar números subsiguientes (saltando encabezados como Cantidad, P.U., Dtos, Importe)
      const numbers: number[] = [];
      while (i < rawLines.length && numbers.length < 4) {
        const cur = rawLines[i];
        if (/^(?:cantidad|p\.?\s*u\.?|dtos|importe)$/i.test(cur)) {
          i++;
          continue;
        }
        const numMatch = cur.match(/^([\d,]+(?:\.\d+)?)$/);
        if (numMatch) {
          numbers.push(Number(numMatch[1].replace(/,/g, '')));
          i++;
        } else {
          break;
        }
      }

      if (numbers.length > 0) {
        const quantity = numbers[0];
        const unitPrice = numbers.length > 1 ? numbers[1] : 43;
        const amount = numbers.length >= 4 ? numbers[3] : quantity * unitPrice;

        if (quantity > 0) {
          items.push({
            id: 'item_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            code: code.trim().toUpperCase(),
            description: desc || 'Bolsa de Polietileno',
            quantity,
            unitPrice,
            amount,
            unit: 'Kilos',
          });
        }
      }
    }
  }

  // Extraer folio, OC y proveedor
  const ocMatch = text?.match(/CDB\s*OC:\s*([\w/]+)/i) || text?.match(/Orden\s*de\s*Compra\s*\n\s*(\d{8,14})/i);
  const folioMatch = text?.match(/No\.?\s*Ord(?:en)?\.?\s*de\s*Compra:\s*([^\s\n\r]+)/i);
  const providerMatch = text?.match(/Proveedor\s*\n\s*([^\n]+)/i) || text?.match(/([Nn]\d{3,5}\s*-\s*[^\n]+)/);
  let provider = providerMatch ? providerMatch[1].trim() : '';
  if (/ELEMENTAL\s*DENIM|N0321/i.test(provider)) {
    provider = ''; // Es nuestro propio nombre/código de proveedor ante Providencia, no un proveedor externo
  }

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
  const fechaMatch = text?.match(/Fecha\s*Entrega:\s*(\d{1,2})-([a-záéíóúA-ZÁÉÍÓÚ]+)-(\d{2,4})/i)
    || text?.match(/Fecha\s*Pedido:\s*(\d{1,2})-([a-záéíóúA-ZÁÉÍÓÚ]+)-(\d{2,4})/i);
  if (fechaMatch) {
    const dia = Number(fechaMatch[1]);
    const mes = MESES[fechaMatch[2].toLowerCase()];
    let anio = Number(fechaMatch[3]);
    if (anio < 100) anio += 2000;
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
