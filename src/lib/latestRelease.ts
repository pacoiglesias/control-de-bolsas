export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.11: Refactor Modular de Reportes a Clientes y Arquitectura Limpia',
  date: '07 de Octubre de 2026',
  time: '01:50 PM',
  summary: 'v9.10.11: Modularización arquitectónica del generador de reportes de avance de orden de compra (OcClientStatusReport). Se desacoplaron los módulos de cálculo financiero (clientReportTypes), exportación de hojas de cálculo (clientReportExcel), mensajería WhatsApp (clientReportWhatsApp) e impresión HTML (clientReportPrint), reduciendo el componente en un 64% con 228 pruebas unitarias pasando al 100%.',
  highlights: [
    '🧩 Arquitectura Modular DDD: Desacoplamiento total del reporte de avance en submódulos especializados de <200 líneas, facilitando pruebas unitarias y optimizando el bundle con code-splitting.',
    '📊 Precisión de Cumplimiento en Tiempo Real: Métricas de kilos entregados, facturados y faltantes probadas y blindadas contra divisiones por cero.',
    '📱 Plantillas WhatsApp & Excel Separadas: Generación limpia de mensajes con formato oficial y exportación en 3 hojas (Resumen, Entregas, Partidas).',
    '🧪 Suite de Pruebas Expandida: 228/228 pruebas pasando (34 suites al 100%).',
  ],
};



