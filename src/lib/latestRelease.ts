export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.12.0: Inicio despejado y cartera consistente', date: '15 de Octubre de 2026', time: '',
 summary: 'Portada enfocada en pendientes diarios, resumen compacto y herramientas bajo demanda. Cartera calculada desde facturas con sus abonos.',
 highlights: ['Menú único para reportes, exportaciones y revisión; selector de vistas accesible.', 'Resumen compacto de cartera, vencido, kilos sin factura y caja, adaptable a móvil.', 'Cálculo compartido de cartera en inicio, barra lateral y auditoría: abonos parciales y varias facturas por CR.', 'Las entregas que exceden la orden solicitan revisión antes de facturar.', 'Carga bajo demanda de exportaciones Excel y PDF.'],
};
