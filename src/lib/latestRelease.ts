export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.7.0 Enterprise: Centinela Continuo en Vivo, Dial de Salud ERP y Directiva Staff Engineer',
  date: '25 de Septiembre de 2026',
  time: '06:30 PM',
  summary: 'Integración del motor de auditoría continua Centinela en vivo con dial visual de salud del ERP (HealthGaugeDial) en el Dashboard, diagnóstico de anomalías en tiempo real, blindaje tipado en modales de subida y adopción de la directiva Staff Engineer.',
  highlights: [
    '🛡️ Centinela Continuo & Dial de Salud: Tarjeta dinámica en el Dashboard con HealthGaugeDial animado (0 a 100%) y diagnóstico exhaustivo de 4 cuadrantes (Báscula, Facturación SAT, Andrés y Caja Chica).',
    '🚨 Badge Inteligente con Silencio Operativo: Badge que permanece oculto cuando el sistema está 100% blindado y alerta con código de severidad al primer síntoma de inconsistencia.',
    '📋 Plan Maestro Proactivo & Directiva Staff Engineer: Documento maestro de acción contra la redundancia de pantallas (PLAN_MEJORAS_PROACTIVAS.md) y directiva operativa v2.0 (PROMPT_SISTEMA.md).',
    '⚡ 204 Tests Unitarios & Cero Errores: 100% de la suite pasando y compilación de producción verificada al centavo.',
  ],
};
