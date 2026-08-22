/**
 * ARCHIVADO (v8.9.9, auditoría Staff Engineer): código muerto -- ningún
 * archivo de src/ importaba nada de aquí (confirmado con grep). Además era
 * una trampa a futuro: `roundBankers()` usa redondeo bancario (mitad-al-par)
 * mientras que `round2()` en finance.core.ts -- la fuente única de verdad
 * real del proyecto -- usa redondeo estándar. Si alguien lo hubiera
 * importado por error pensando que era "el" helper de redondeo, los
 * centavos no habrían cuadrado contra el resto del sistema. Se archiva en
 * vez de borrarse (ver convención de _ARCHIVO_OBSOLETO/) por si hace falta
 * consultarlo.
 *
 * Utilidades Matemáticas y Financieras (Enterprise Grade)
 *
 * Evita problemas de precisión de punto flotante en JavaScript
 * usando un factor de escala (ej. multiplicar por 100 para trabajar con enteros en centavos).
 */

const FACTOR = 10000; // Tolerancia de 4 decimales internamente

export function add(a: number, b: number): number {
  return (Math.round(a * FACTOR) + Math.round(b * FACTOR)) / FACTOR;
}

export function subtract(a: number, b: number): number {
  return (Math.round(a * FACTOR) - Math.round(b * FACTOR)) / FACTOR;
}

export function multiply(a: number, b: number): number {
  return (Math.round(a * FACTOR) * Math.round(b * FACTOR)) / (FACTOR * FACTOR);
}

export function divide(a: number, b: number): number {
  const scaledB = Math.round(b * FACTOR);
  if (scaledB === 0) return 0;
  return (Math.round(a * FACTOR) / scaledB);
}

/** Redondeo bancario (round half to even) a N decimales */
export function roundBankers(num: number, decimals: number = 2): number {
  const d = Math.pow(10, decimals);
  const m = num * d;
  const dec = m % 1;
  if (dec === 0.5) {
    return (Math.floor(m) % 2 === 0 ? Math.floor(m) : Math.ceil(m)) / d;
  }
  return Math.round(m) / d;
}

/**
 * Formatea un monto como moneda.
 */
export function money(amount: number, currency: string = 'MXN'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Formatea un número como kilos (2 decimales)
 */
export function kilos(amount: number): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '0.00 kg';
  return amount.toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' kg';
}
