export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.33: Blindaje de Red y Errores Offline en Maquila, Identidad Determinista en Bitácora y Protección de Margen Financiero Real',
  date: '11 de Octubre de 2026',
  time: '10:15 AM',
  summary: 'v9.10.33: Endurecimiento de la resiliencia offline en el Portal Maquilador con clasificación granular de errores (shouldQueueOfflineDeliveryError), identificadores deterministas en bitácoras de Cloud Functions, vinculación estricta de contrarrecibos por folio oficial amparado, aislamiento de costos estimados en el cálculo de margen real y suite ampliada a 355 pruebas aprobadas.',
  highlights: [
    '📶 Blindaje de Encolado Offline en Portal Maquilador: Clasificación precisa de errores de red vs validación; solo fallas de conexión o códigos transitorios se encolan en IndexedDB, informando de inmediato errores de datos al usuario.',
    '📋 Identidad Determinista y Reparación de Bitácoras: IDs deterministas en maquilaDeliveries y system_logs para que reintentos de entregas no generen registros duplicados y reparen auditorías automáticamente.',
    '🔄 Normalización de Contratos de Órdenes: Compatibilidad transparente entre id y orderId con normalizeActiveMaquilaOrders en pantallas de PIN y entrega.',
    '📑 Vinculación Estricta de Contrarrecibos: Detección rigurosa por folio oficial amparado, prevención de sobreescritura sobre órdenes pagadas existentes y no afectación de expedientes con CR previo.',
    '📊 Protección del Margen Financiero Real: Inclusión de banderas needsReview e isEstimatedCost que aíslan importaciones históricas del margen live, mostrando advertencias visibles ("Costo pendiente" / "Por revisar").',
    '💵 Idempotencia en Movimientos de Caja Chica: Condición estricta de facturas recolectadas efectivas para no emitir movimientos fantasma en caja.',
    '🧪 Suite de Pruebas Ampliada: 355 pruebas aprobadas en 52 suites con 0 fallos.',
  ],
};
