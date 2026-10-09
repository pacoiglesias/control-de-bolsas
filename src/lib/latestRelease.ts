export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.30: Eliminación Integral de Fallbacks Estáticos y Blindaje de Precios Flotantes',
  date: '09 de Octubre de 2026',
  time: '04:30 PM',
  summary: 'v9.10.30: Erradicación total de fallbacks fijos ($43/$38) a través de toda la aplicación, suite ampliada con 319 pruebas pasando, typecheck 100% limpio y build productivo verificado.',
  highlights: [
    '🚫 Erradicación de Fallbacks Fijos: Eliminados precios hardcodeados ($43/$38) en componentes clave, modales y lógica financiera; la aplicación detiene cálculos y marca revisión ante datos faltantes.',
    '🛡️ Blindaje de Tipos y TypeScript: Corrección completa de referencias nulas y contratos de datos en toda la base de código.',
    '🧪 Suite de Pruebas Robusta: 319 pruebas unitarias e integrales en verde sin fallos.',
    '🚀 Compilación y Empaquetado Limpio: Build exitoso para Frontend PWA y Cloud Functions.',
  ],
};
