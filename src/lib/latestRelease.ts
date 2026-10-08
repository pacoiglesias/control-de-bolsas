export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.15: Blindaje Integral contra Campos Undefined en Escrituras de Firestore e Ingesta Inteligente de Comprobantes PDF/CFDI',
  date: '07 de Octubre de 2026',
  time: '09:15 PM',
  summary: 'v9.10.15: Blindaje integral contra campos undefined en escrituras a Cloud Firestore (solución definitiva del error Unsupported field value: undefined al ingresar facturas PDF sin UUID como 6363_EDE1902136T2_06102026011126.pdf en GlobalDropInspectorModal); intercepción y sanitización recursiva universal en todas las llamadas updateDoc/addDoc del sistema con safeFirestore (safeUpdateDoc, safeSetDoc, safeAddDoc) y cleanUndefined; conversión resiliente de fechas toSafeTimestamp; y suite de 245 pruebas unitarias al 100% en 36 suites.',
  highlights: [
    '🛡️ Blindaje Total en GlobalDropInspectorModal: Solución del fallo crítico al registrar facturas en comprobantes PDF (como folio 6363); eliminación de asignaciones uuid: undefined, docFolio: undefined e importe: undefined, blindando la orden purchaseOrders/oc-120267114302 y cualquier otra OC contra rechazos de Firestore.',
    '⚡ Capa de Persistencia Segura (safeFirestore): Sustitución de updateDoc y addDoc directos en todos los componentes del ERP (Inspector de Comprobantes, Facturación Rápida, Conclusión de OCs, Contrarecibos, Monitor REP, Papelera, Catálogo, Almacenamiento de Documentos, Logs y Notificaciones) por safeUpdateDoc y safeAddDoc con auto-sanitización.',
    '🧹 Sanitizador Recursivo Universal (cleanUndefined): Omisión estricta de propiedades undefined en objetos de cualquier profundidad, mapas con notación de punto (dot-notation), arrays y colecciones embebidas, preservando intactas las instancias de Date, Timestamp y FieldValues (serverTimestamp(), deleteField()).',
    '📅 Validación Resiliente de Fechas (toSafeTimestamp): Helper unificado que valida la integridad de fechas extraídas por OCR evitando excepciones por cadenas vacías o malformadas.',
    '🧪 245 Pruebas Unitarias al 100%: 36 suites de pruebas pasando con cero errores y validación estricta de tipos en TypeScript 5.',
  ],
};
