export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.24: Búsqueda Rápida Universal Spotlight (Ctrl+K), Integridad Antiduplicados en Báscula, Idempotencia de Pagos y Prevalencia de Precios',
  date: '08 de Octubre de 2026',
  time: '07:35 PM',
  summary: 'v9.10.24: Endurecimiento total de integridad del ERP: Buscador Universal Spotlight unificado con indicador de carga, ranking por relevancia y pie v9.10.24 Enterprise; detector de duplicados de báscula con y sin folio (pesaje y fecha exacta) y límites estrictos de palabra; resolución prioritaria de orden destino ante duplicados; idempotencia estricta de pagos bancarios con historial de abonos y prevención de ambigüedad; prevalencia de precios reales pactados en la orden sobre defaults de configuración y preservación íntegra de importes de CFDIs al editar.',
  highlights: [
    '🔍 Buscador Universal Spotlight Unificado (Ctrl+K): Único punto de entrada global, retiro de paleta anterior, estado de carga en memoria, ordenamiento por relevancia y pie actualizado a v9.10.24 Enterprise.',
    '⚖️ Báscula sin Folio y Blindaje Antiduplicados: Detección infalible de pesajes repetidos sin folio por coincidencia de kilos y fecha exacta, y límites estrictos de palabra para evitar falsos positivos en notas.',
    '🎯 Orden Destino Prioritaria: Resolución limpia de duplicados evitando el error de "sin orden destino" mediante asociación directa con duplicateOrder.',
    '🏦 Idempotencia y Ambigüedad de Pagos Bancarios: Registro en paymentsHistory de cada abono, rechazo de pagos repetidos y alerta obligatoria de asignación manual ante facturas con saldo idéntico.',
    '💵 Prevalencia de Precios Reales y Totales CFDI: Respeto estricto a precios de la orden y documento con flags isEstimatedPrice/Cost, preservando totales SAT al editar facturas.',
    '📑 Integridad en Contrarecibos: Rechazo de auto-asignaciones a ciegas ante contrarecibos sin folios claros cuando existen múltiples facturas pendientes.',
  ],
};
