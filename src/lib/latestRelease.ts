export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.32: Accesibilidad Universal en Kanban (Mover a...), Gestión Visual de Cola Offline y Clasificación Canónica',
  date: '10 de Octubre de 2026',
  time: '08:15 AM',
  summary: 'v9.10.32: Implementación completa de las 8 fases de auditoría: selector visible y accesible "Mover a..." en tarjetas Kanban para toque y teclado sin depender de arrastre, visualización detallada de cola offline con estados (Pendiente, Requiere atención, Sincronizada) y reintento individual por elemento en el Portal Maquilador, inmutabilidad transaccional en Caja, sincronización no destructiva de contrarecibos y suite de 343 pruebas integrales aprobadas.',
  highlights: [
    '🎯 Accesibilidad Universal en Tablero Kanban: Selector visible "Mover a..." integrado en cada tarjeta para toque en pantallas táctiles y navegación con teclado (Tab + Enter), permitiendo transicionar expedientes entre Revisión, Por Cobrar, Contador y Caja sin depender de arrastrar tarjetas.',
    '📦 Gestión Visual de Cola Offline en Portal Maquilador: Visualización explícita de estados de cada entrega (Pendiente, Requiere atención por error de red/validación, Sincronizada) y botón de reintento manual individual con preservación de clave de idempotencia única.',
    '⚖️ Sincronizador Oficial No Destructivo: Preservación de facturas existentes, kilos reales de báscula, pagos y fechas al vincular contrarecibos; selección vacía por defecto y eliminación total de estimaciones artificiales de kilos.',
    '💵 Inmutabilidad en Caja Chica: Identificadores únicos de transacción en gastos y reversiones con precondiciones idempotentes que evitan duplicidad de ingresos ante clics concurrentes.',
    '🧪 Suite de Pruebas Integrales Ampliada: 343 pruebas unitarias y de integración superadas (50 suites) con 0 fallos.',
    '🚀 Compilación y Despliegue de Producción: Vite PWA (72 activos precacheados) y Cloud Functions Node 22 (24 servicios) al 100%.',
  ],
};
