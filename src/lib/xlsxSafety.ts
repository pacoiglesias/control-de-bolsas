/**
 * Límite de tamaño para archivos .xlsx/.xls/.csv que el usuario sube para
 * importar (Catálogo, Auditoría "Excel Clásico", importación de ventas).
 *
 * FIX (auditoría v8.9.10, mitigación de riesgo): la librería `xlsx`
 * (SheetJS) que usa este proyecto tiene 2 vulnerabilidades conocidas sin
 * parche disponible en el registro de npm -- "prototype pollution" y ReDoS
 * (denegación de servicio por expresión regular), ambas de severidad alta
 * (`npm audit`). La corrección real es cambiar la fuente del paquete a la
 * que SheetJS distribuye directamente desde su propio sitio
 * (cdn.sheetjs.com, fuera del registro de npm por decisión de ellos) --
 * pero esta sesión no tiene salida de red hacia ese dominio (solo hacia
 * los registries estándar), así que no se pudo instalar ni verificar esa
 * migración de forma segura. Cambiar `package.json` a ciegas, sin poder
 * confirmar que `npm install` funciona, es arriesgar romper la instalación
 * completa en la máquina real por resolver un riesgo que hoy es acotado.
 *
 * Mientras se decide y se prueba esa migración con acceso real a internet,
 * esto reduce el radio de exposición de los 3 lugares donde el sistema
 * llama `XLSX.read()` sobre un archivo que sube el usuario
 * (`importExcel.ts`, `Catalog.tsx`, `AuditSync.tsx`): un límite de tamaño
 * no detiene un ataque dirigido con un archivo pequeño, pero sí descarta
 * de entrada el caso más simple (un archivo corrupto o gigante, accidental
 * o no), y junto con el manejo de errores ya existente evita que un
 * parseo fallido quede silencioso.
 */
export const MAX_XLSX_IMPORT_MB = 15;

/** Devuelve un mensaje de error si el archivo excede el límite, o null si está bien. */
export function validarTamanoExcel(file: File): string | null {
  const mb = file.size / (1024 * 1024);
  if (mb > MAX_XLSX_IMPORT_MB) {
    return `El archivo pesa ${mb.toFixed(1)} MB, más del límite de ${MAX_XLSX_IMPORT_MB} MB para importaciones. Divídelo en partes más pequeñas o pide un archivo más ligero.`;
  }
  return null;
}
