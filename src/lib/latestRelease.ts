export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.5: Reporte de Avance OC para Cliente con Desglose por Partida y Exportación Excel Multi-Hoja',
  date: '06 de Octubre de 2026',
  time: '10:15 PM',
  summary: 'v9.10.5: Implementación del reporte modal interactivo y exportable OcClientStatusReport para compartir el avance de Órdenes de Compra con clientes vía WhatsApp, Email, PDF/Impresión y Excel (.xlsx) multi-hoja con desglose por partida, entregas físicas y resumen financiero.',
  highlights: [
    '📊 Reporte Modal de Avance OC (OcClientStatusReport): Visualización ejecutiva del porcentaje de cumplimiento, kilos entregados, faltantes y por facturar.',
    '📋 Desglose Partida por Partida: Avance individual de cada ítem de la OC mostrando pedido, entregado y faltante.',
    '📑 Exportación a Excel Multi-Hoja (.xlsx): Generación de archivo Excel con Hoja 1 (Resumen General), Hoja 2 (Historial de Entregas) y Hoja 3 (Detalle por Partida).',
    '📲 Compartir en 1 Clic: Integración para envío vía WhatsApp formatted, correo electrónico mailto, PDF impreso y copia al portapapeles.',
    '⚡ Reflejo en Vivo: Cálculo automático y sincronización en tiempo real desde Firestore.',
  ],
};
