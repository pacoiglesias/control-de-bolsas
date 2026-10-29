/**
 * Precio unitario real de un documento, para la corroboración de kilos.
 *
 * Antes, parseOcrData dividía siempre el subtotal entre $43 fijos. Eso
 * inflaba los kilos de cualquier documento a otro precio: la factura 6438
 * (1,325 kg a $44, subtotal $58,300) quedaba en 1,355.81 kg. Este módulo
 * detecta el precio del propio documento; si no lo encuentra, devuelve
 * null y el llamador conserva el 43 heredado como último recurso.
 *
 * Fuentes, en orden:
 * 1. Conceptos ya parseados con valorUnitario: el más frecuente.
 * 2. Precios repetidos en el texto (`$ XX.XX`, al menos 2 veces, entre
 *    $1 y $200): el precio por kilo se repite en cada renglón, mientras
 *    que los importes y el IVA aparecen una sola vez. Entre candidatos
 *    se prefiere el más frecuente y, en empate, el que mejor cuadra con
 *    subtotal/kilos detectados.
 */

export interface ConceptoConPrecio {
  valorUnitario?: number;
}

function mode(values: number[]): number | null {
  if (values.length === 0) return null;
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  let bestCount = 0;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

export function detectDocumentUnitPrice(
  text: string,
  kilosDetectados?: number,
  subtotal?: number,
  conceptos?: ConceptoConPrecio[]
): number | null {
  if (conceptos && conceptos.length > 0) {
    const prices = conceptos
      .map((c) => Number(c.valorUnitario))
      .filter((p) => Number.isFinite(p) && p > 0);
    const fromConceptos = mode(prices);
    if (fromConceptos != null) return fromConceptos;
  }

  const counts = new Map<number, number>();
  for (const m of text.matchAll(/\$\s*([\d,]+\.\d{2})/g)) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(v) && v >= 1 && v <= 200) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  const candidates = [...counts.entries()].filter(([, c]) => c >= 2);
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    if (kilosDetectados && kilosDetectados > 0 && subtotal && subtotal > 0) {
      return (
        Math.abs(subtotal / a[0] - kilosDetectados) -
        Math.abs(subtotal / b[0] - kilosDetectados)
      );
    }
    return a[0] - b[0];
  });
  return candidates[0][0];
}

/** Precio unitario dominante entre las partidas de un documento. */
export function dominantItemUnitPrice(
  items?: Array<{ unitPrice?: number }>
): number | null {
  if (!items || items.length === 0) return null;
  return mode(
    items
      .map((it) => Number(it.unitPrice))
      .filter((p) => Number.isFinite(p) && p > 0)
  );
}
