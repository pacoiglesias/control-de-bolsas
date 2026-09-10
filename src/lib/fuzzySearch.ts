/**
 * 🔍 Motor de Búsqueda Difusa (Fuzzy Search) con Distancia de Levenshtein Optimizada
 * Permite encontrar folios, órdenes, contrarecibos, productos y clientes
 * incluso con errores tipográficos o diferencias de acentos y mayúsculas.
 */

import { normalizarTexto } from './finance';

/**
 * Calcula la distancia de edición de Levenshtein entre dos cadenas de manera optimizada en memoria O(min(N, M)).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  // Asegurar que 'a' sea la cadena más corta para minimizar la memoria requerida
  let strA = a;
  let strB = b;
  let lenA = an;
  let lenB = bn;

  if (lenA > lenB) {
    strA = b;
    strB = a;
    lenA = bn;
    lenB = an;
  }

  let prevRow = new Int32Array(lenA + 1);
  let currRow = new Int32Array(lenA + 1);

  for (let j = 0; j <= lenA; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= lenB; i++) {
    currRow[0] = i;
    const charB = strB.charCodeAt(i - 1);

    for (let j = 1; j <= lenA; j++) {
      const cost = strA.charCodeAt(j - 1) === charB ? 0 : 1;
      const substitution = prevRow[j - 1] + cost;
      const insertion = currRow[j - 1] + 1;
      const deletion = prevRow[j] + 1;

      let min = substitution;
      if (insertion < min) min = insertion;
      if (deletion < min) min = deletion;

      currRow[j] = min;
    }

    // Intercambiar filas para la siguiente iteración
    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[lenA];
}

/**
 * Calcula el puntaje de similitud (0.0 a 1.0) entre dos textos.
 */
export function computeSimilarity(query: string, target: string): number {
  const q = normalizarTexto(query.trim());
  const t = normalizarTexto(target.trim());

  if (!q || !t) return 0;
  if (q === t) return 1.0;
  if (t.startsWith(q)) return 0.98;
  if (t.includes(q)) return 0.95;

  // Verificación multi-token (ej. "TH 836" dentro de "TEXTIL HOGAR TH-836")
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => t.includes(token))) {
    return 0.92;
  }

  const maxLen = Math.max(q.length, t.length);
  const distance = levenshteinDistance(q, t);
  return Math.max(0, 1 - distance / maxLen);
}

export interface FuzzySearchResult<T> {
  item: T;
  score: number;
  matchedField: string;
}

/**
 * Realiza una búsqueda difusa sobre una lista de elementos dados los campos a evaluar.
 * @param items Lista de elementos a buscar
 * @param query Término de búsqueda
 * @param extractFields Función para extraer las cadenas de texto a comparar de cada elemento
 * @param minScore Umbral mínimo de similitud (por defecto 0.45)
 */
export function fuzzySearch<T>(
  items: readonly T[],
  query: string,
  extractFields: (item: T) => Record<string, string | null | undefined>,
  minScore = 0.45
): FuzzySearchResult<T>[] {
  const cleanQuery = normalizarTexto(query.trim());
  if (!cleanQuery) return items.map((item) => ({ item, score: 1, matchedField: 'all' }));

  const results: FuzzySearchResult<T>[] = [];

  for (const item of items) {
    const fields = extractFields(item);
    let bestScore = 0;
    let bestField = '';

    for (const [fieldName, val] of Object.entries(fields)) {
      if (!val) continue;
      const score = computeSimilarity(cleanQuery, val);
      if (score > bestScore) {
        bestScore = score;
        bestField = fieldName;
      }
    }

    if (bestScore >= minScore) {
      results.push({ item, score: bestScore, matchedField: bestField });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
