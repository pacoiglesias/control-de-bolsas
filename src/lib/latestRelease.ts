export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.28: Blindaje Criptográfico de Pagos, Reglas Firestore de Esquema, Preservación de Cero ($0.00) y Cero Warnings de Linter',
  date: '09 de Octubre de 2026',
  time: '11:35 AM',
  summary: 'v9.10.28: Endurecimiento integral de seguridad de pagos, esquema de base de datos y consistencia financiera: Erradicación de referencias bancarias débiles (folios o nombres de archivo) con obligatoriedad de clave de rastreo SPEI o huella SHA-256 binaria; identificadores canónicos sin colisión por hashing determinista; reglas de seguridad Firestore reforzadas en /payment_receipts con validación estricta de esquema y roles; preservación de precios y costos legítimos a $0.00 mediante coalescencia nula (??); eliminación del 100% de errores y advertencias de linter; y 304 pruebas automatizadas en verde.',
  highlights: [
    '🔒 Blindaje de Identidad de Pagos Bancarios: Rechazo automático de referencias débiles (nombre de archivo, OC o folio de orden) sin clave SPEI, referencia bancaria o huella criptográfica SHA-256, enviando a revisión manual obligatoria con motivo detallado.',
    '🔑 Identificadores Libres de Colisión: Generación determinista de claves de almacenamiento con hash hexadecimal (BANK_..._hash o SHA256_...) para evitar sobrescrituras de documentos con caracteres especiales o nombres normalizados idénticos.',
    '🛡️ Reglas de Seguridad Firestore de Esquema (/payment_receipts): Validación en base de datos que exige rol de gerencia o administración, correspondencia exacta entre receiptKey y docId, monto positivo, trazabilidad de appliedBy y appliedAt.',
    '💵 Preservación de Precios y Costos a Cero ($0.00): Reemplazo universal de operadores || por coalescencia nula (??) en reportes de utilidad, prefacturas, calculadora flotante, banners de báscula y sincronización con Excel, respetando fletes bonificados y muestras sin forzar $43/$38.',
    '🧹 Linter y TypeScript al 100% Limpio: Eliminación total de advertencias y errores (no-useless-escape, no-empty, imports huérfanos y chequeo estricto de tipos con tsc).',
    '🧪 Suite Integral de 304 Pruebas Automatizadas en Verde (41 archivos de prueba): Cobertura completa de modelos financieros, pipeline de documentos, transacciones de pagos y reglas de acceso.',
  ],
};
