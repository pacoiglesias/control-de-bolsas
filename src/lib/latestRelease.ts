export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.31: Sincronización No Destructiva, Inmutabilidad en Caja y Deduplicación Inteligente Maquila',
  date: '10 de Octubre de 2026',
  time: '07:45 AM',
  summary: 'v9.10.31: Sincronización no destructiva de contrarecibos oficiales preservando facturas reales, kilos de báscula y estados; inmutabilidad transaccional en movimientos de caja chica evitando sobreescritura de cobros y reversiones; y deduplicación inteligente en el portal maquilador protegiendo viajes idénticos legítimos.',
  highlights: [
    '⚖️ Sincronizador de Contrarecibos No Destructivo: Preservación íntegra de facturas, pagos y kilos de báscula al vincular contrarecibos a expedientes existentes. Selección granular vacía por defecto y eliminación de estimación artificial de kilos.',
    '💵 Inmutabilidad e Idempotencia en Caja Chica: Movimientos de ingreso y reversión registrados con identificadores únicos de Firestore, garantizando que cobros, reversiones y re-cobros conserven su historial íntegro sin sobreescrituras destructivas.',
    '🏭 Deduplicación Inteligente en Portal Maquilador: Discriminación de entregas por clientDeliveryId/deliveryId, permitiendo múltiples entregas legítimas con mismo tonelaje y remisión sin falsos bloqueos.',
    '🧪 Suite de Pruebas Ampliada: 341 pruebas automatizadas pasando al 100% (50 suites) y 0 fallos.',
    '🚀 Verificación Integral: Compilación limpia en Frontend Vite PWA y Cloud Functions backend.',
  ],
};
