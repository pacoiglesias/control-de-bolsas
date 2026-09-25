export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.7.1 Enterprise: Consolidación de Rutas, Cero Pantallas Redundantes y Puente Logístico-Financiero',
  date: '25 de Septiembre de 2026',
  time: '06:45 PM',
  summary: 'Ejecución del Plan Maestro de Usabilidad: erradicación total de pantallas y rutas redundantes (unificación de Configuración y Usuarios en el Centro de Control con sincronización en URL), selector de perspectiva bidireccional entre Expedientes y Seguimiento de Báscula (OC), y navegación optimizada para todos los roles.',
  highlights: [
    '🧭 Unificación Definitiva de Configuración: Eliminación del enlace duplicado de personalización en la barra lateral; el Centro de Control ahora soporta navegación por URL (?tab=settings, ?tab=users, etc.) y permite a todos los roles acceder a sus temas sin fricción.',
    '🌉 Puente Bidireccional Expedientes ⇄ Báscula: Botón de cambio de perspectiva instantáneo en la cabecera de Expedientes (🚚 Modo Báscula & Logística) y en Seguimiento por OC (📂 Modo Administrativo & Finanzas).',
    '⚡ Depuración de Imports & Bundles: Retiro de imports perezosos duplicados en App.tsx y eliminación de componentes huérfanos sin llamadas.',
    '🛡️ 204 Pruebas Unitarias Verificadas: 100% de la suite pasando en Vitest y compilación estricta aprobada.',
  ],
};
