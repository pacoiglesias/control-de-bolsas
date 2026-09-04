/**
 * 🔍 Motor de Búsqueda Difusa (Fuzzy Search) con Distancia de Levenshtein
 * Permite encontrar folios, órdenes, contrarecibos, productos y clientes
 * incluso con errores tipográficos o diferencias de acentos y mayúsculas.
 */

import { normalizarTexto } from './finance';

/**
 * Calcula la distancia de edición de Levenshtein entre dos cadenas.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a ? a.length : 0;
  const bn = b ? b.length : 0;
  if (an === 0) return bn;
  if (bn === 0) return an;

  const matrix: number[][] = [];

  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sustitución
          Math.min(
            matrix[i][j - 1] + 1,     // inserción
            matrix[i - 1][j] + 1      // eliminación
          )
        );
      }
    }
  }

  return matrix[bn][an];
}

/**
 * Calcula el puntaje de similitud (0.0 a 1.0) entre dos textos.
 */
export function computeSimilarity(query: string, target: string): number {
  const q = normalizarTexto(query.trim());
  const t = normalizarTexto(target.trim());

  if (!q || !t) return 0;
  if (q === t) return 1.0;
  if (t.includes(q)) return 0.95;

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
  items: T[],
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
