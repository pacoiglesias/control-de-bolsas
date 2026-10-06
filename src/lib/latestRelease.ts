export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.6: Emisión Dual Simultánea y Facturación Inteligente en 1 Clic para Remisión 6439784 (Lic. Evelia Castillo / GT)',
  date: '06 de Octubre de 2026',
  time: '11:15 PM',
  summary: 'v9.10.6: Implementación del asistente de división inteligente de remisiones y emisión dual simultánea en 1 clic para la remisión oficial 6439784 (2,000 kg entregados en Planta P4) solicitada por la Lic. Evelia Castillo para ser facturada en dos facturas de 1,000 kg ($49,880.00 c/u con IVA). Corrección integral de la conciliación de entregas por partida y prevención de duplicados.',
  highlights: [
    '⚡ Emisión Dual Simultánea en 1 Clic: Nuevo modal asistido que genera y timbra en un solo paso ambas facturas (Factura 1 de 1,000 kg: 500+500 kg y Factura 2 de 1,000 kg: 1,000 kg) vinculadas a la OC 12026439784.',
    '🎯 Atajos de 1 Clic en Emisión Guiada: Botones directos para cargar instantáneamente Factura 1 (1,000 kg · $49,880), Factura 2 (1,000 kg · $49,880) o Lote Completo (2,000 kg · $99,760).',
    '📦 Corrección del Desglose Canónico de Partidas (OC 43/9784): Asignación canónica estricta de las 3 partidas reales (EGBO000095-SC, EGBO000093-SC, EGBO000018-SC) evitando duplicidad de kilos en entregas.',
    '🔒 Conciliación Inteligente de Remisiones Parciales: Enlace seguro que descuenta de forma escalonada los kilos facturados en la remisión sin cerrarla prematuramente hasta amparar los 2,000 kg totales.',
    '🛡️ Blindaje de Folios Duplicados: Validación en tiempo real tanto individual como dual contra toda la base de datos de órdenes.',
  ],
};
