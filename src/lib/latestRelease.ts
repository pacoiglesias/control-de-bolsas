export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.25: Cierre Integral de Riesgos: Permisos Firestore, Detección Documental E2E, Contrarecibos Multiorden y Pagos Transaccionales',
  date: '09 de Octubre de 2026',
  time: '07:25 AM',
  summary: 'v9.10.25: Cierre riguroso de riesgos de integridad documental y financiera: separación estricta de permisos en Firestore (create/update para managers, borrado exclusivo de superadmin); propagación integral de colisiones de folio fiscal SAT y pesajes sospechosos en báscula con solicitud interactiva de revisión manual en GlobalDropzoneHUD; eliminación total de emparejamiento por sufijo en contrarecibos mediante coincidencia exacta normalizada y validación atómica multiorden (rollback total ante cualquier inconsistencia); transacciones atómicas con runTransaction en pagos con preservación de saldo histórico acumulado y tolerancia contable estricta de centavos SAT (<= $0.05); y prevalencia estricta de importes CFDI con distinción de cero válido ($0.00) en precios y partidas.',
  highlights: [
    '🔒 Separación Estricta de Permisos en Firestore: Desglose de create, update y delete en storedDocuments, invoices y ledger; managers no pueden borrar documentos críticos y superadmin es el único facultado.',
    '⚠️ Detección Documental E2E con HUD Interactivo: Propagación de hasFolioCollision e isSuspectDuplicate hasta la interfaz; solicitud explícita de confirmación de operador ante pesajes similares o folios con UUID SAT distinto en lugar de bloqueos ciegos o importación silenciosa.',
    '📑 Contrarecibos Multiorden Atómicos y Coincidencia Exacta: Retiro definitivo de emparejamiento por sufijo (endsWith); normalización estricta de folios y verificación previa de todas las facturas amparadas; si un solo folio falta o es ambiguo, se aborta sin tocar ninguna orden.',
    '🏦 Pagos Transaccionales con Preservación de Histórico: Escritura atómica vía runTransaction, huella digital reproducible de archivo para comprobantes sin referencia, conservación de saldo inicial en facturas históricas sin desglose previo y tolerancia contable estricta de centavos SAT (<= $0.05).',
    '💵 Prevalencia de Importes CFDI y Respeto a Cero Válido ($0.00): Eliminación de fallbacks con operador || que sobreescribían precios legítimos en $0.00 con $43.00, distinguiendo formalmente dato ausente de valor cero.',
    '🧪 Suite de Pruebas Senior de Integridad: 24 pruebas especializadas en auditSeniorIntegritySuite y autoDocumentPipelineIntegrity (278 pruebas totales del sistema verdes).',
  ],
};
