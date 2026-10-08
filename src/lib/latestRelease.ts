export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.18: Ingesta Inteligente Touchless (Zero-Click), Respaldo Automático en Storage y Reactividad en Tiempo Real',
  date: '08 de Octubre de 2026',
  time: '10:50 AM',
  summary: 'v9.10.18: Implementación del nuevo motor FastTrack Touchless (autoDocumentPipeline) para ingesta masiva de facturas CFDI, tickets de báscula, remisiones y pagos sin requerir confirmaciones manuales ni botones de actualización; respaldo binario automático y persistente en Firebase Storage (uploadDocument) con metadatos asociados; deduplicación atómica garantizada y resolución interactiva en un toque únicamente ante casos de ambigüedad genuina de OC; reactividad instantánea vía onSnapshot en todo el ERP.',
  highlights: [
    '⚡ Ingesta Inteligente Touchless (Zero-Click): Al soltar o seleccionar facturas o comprobantes, el sistema los procesa en lote a máxima velocidad, extrae datos fiscales/operativos, identifica la OC canónica y los aplica al ERP sin clics intermedios.',
    '☁️ Respaldo Automático en Firebase Storage: Todos los documentos subidos (PDF, XML e imágenes) se almacenan de inmediato en la nube mediante uploadDocument con metadatos, tamaño y ruta para consulta y auditoría histórica.',
    '🔄 Reactividad en Vivo sin Botón de Actualizar: Las escrituras atómicas en Firestore actualizan la estampa serverTimestamp(), provocando un refresco instantáneo en el Dashboard, Métricas, Inventario en Patio y Cobranza.',
    '🛡️ Resolución Proactiva en Caso de Duda: Si un archivo no contiene OC unívoca, el HUD se pausa de forma elegante y solicita asignación en un solo toque con botones directos (TH Nava / GT Evelia) antes de continuar la cola.',
    '🚫 Deduplicación Fiscal Robusta: Facturas previamente registradas por folio o UUID son detectadas al instante y conservadas sin duplicar balances.',
  ],
};
