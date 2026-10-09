export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.25: Blindaje de Importación, Panel de Aclaración con Auditoría, Contrarrecibos Atómicos, Precios Dinámicos y Suite E2E de Resiliencia',
  date: '09 de Octubre de 2026',
  time: '08:45 AM',
  summary: 'v9.10.25: Refuerzo integral de confiabilidad, seguridad y operatividad del ERP: Erradicación definitiva de asignaciones arbitrarias a órdenes por omisión (eliminación de orders[0]); panel unificado de aclaración y confirmación en GlobalDropzoneHUD con selección obligatoria de orden destino, resumen previo y auditoría formal (logAction); contrarrecibos multiorden con validación previa de todos los folios, prevención de colisiones (hasCrCollision), escrituras atómicas (writeBatch) y reporte coordinado de Storage (storageWarning); cálculos financieros sin fallbacks fijos a $43 o $38, distinguiendo $0.00 legítimo de precio ausente (needsReview); deduplicación determinista por contenido binario (SHA-256), candado de concurrencia en memoria (inFlightOperations); y suite de 290 pruebas automatizadas en verde.',
  highlights: [
    '🚫 Erradicación de Asignación por Omisión (orders[0]): Ningún documento se asigna a ciegas; si no hay orden coincidente o se fuerza la importación, el operador debe seleccionar obligatoriamente la orden destino con datos distintivos visibles.',
    '📋 Panel de Aclaración y Confirmación con Auditoría: Interfaz en GlobalDropzoneHUD que despliega motivos claros, resumen previo con impacto contable, captura de notas y registro inmutable en auditoría (FORCED_DOCUMENT_IMPORT). Sin avance automático ciego en errores.',
    '📑 Contrarrecibos Multiorden Atómicos y Protección de Colisión: Validación estricta de todos los folios amparados; detección de colisión con contrarrecibos previos (hasCrCollision); actualización atómica mediante writeBatch(db); y reporte coordinado si Storage falla (storageWarning: true).',
    '💵 Precios Dinámicos y Cero Válido ($0.00): Eliminación de fallbacks estáticos a $43 o $38 en compras, ventas y conciliación; distinción entre $0.00 legítimo y precio ausente (needsReview: true); selección obligatoria ante múltiples facturas con saldo idéntico; y detección de sobrepagos (+X.XX).',
    '🔒 Deduplicación por SHA-256 y Bloqueo de Doble Clic: Cálculo determinista de huella SHA-256 sobre arrayBuffer para detectar archivos idénticos con nombres cambiados; candado en memoria inFlightOperations con try-finally que bloquea clics concurrentes.',
    '🧪 Suite E2E de Resiliencia (290 pruebas verdes): 12 nuevos escenarios de prueba en systemHardeningE2E.test.ts cubriendo colisiones, rechazos limpios, cancelaciones sin escrituras, concurrencia y validaciones financieras.',
  ],
};
