export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.29: Correcciones TypeScript de Null-Safety en Exportador Excel y Pruebas',
  date: '09 de Octubre de 2026',
  time: '01:35 PM',
  summary: 'v9.10.29: Correcciones de TypeScript (null-safety) en masterExcelExporter para precios flotantes no configurados (saleKg/costKg), eliminación de import no utilizado en suite de emulador Firestore. Suite completa: 305 pruebas en verde, typecheck y lint sin errores ni advertencias.',
  highlights: [
    '🔧 Null-Safety en Exportador Excel: saleKg/costKg son number|null; el cálculo se detiene y muestra "SIN PRECIO" si el precio flotante no está configurado en lugar de fallar con TypeError.',
    '🧹 Limpieza de Import: Eliminado `expect` no utilizado en firestoreRulesRealEmulator.test.ts (TS6133 corregido).',
    '✅ Suite Integral: 305 pruebas en verde, typecheck 0 errores, ESLint 0 warnings.',
  ],
};
