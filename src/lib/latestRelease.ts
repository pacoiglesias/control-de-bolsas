export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.14: Fase 2 — Índices Compuestos Firestore & Optimización Reactiva de Caché',
  date: '07 de Octubre de 2026',
  time: '08:30 PM',
  summary: 'v9.10.14: Fase 2 de optimización estructural completada: Despliegue de índices compuestos de Firestore (purchaseOrders, stored_documents, history, notifications, maquilaDeliveries, expenses, system_logs); supresión de re-renders redundantes en listeners reactivos ({ includeMetadataChanges: false } y guardrail docChanges().length === 0 en Invoices, Expenses, Purchases, Products, Presence y MaquilaDeliveries); segregación en memoria de órdenes activas vs concluidas.',
  highlights: [
    '⚡ Índices Compuestos en Firestore: Cobertura total en firestore.indexes.json para consultas multi-campo en documentos almacenados (docKind + uploadedAt, orderId + uploadedAt), historial (userId + type + lastUsed), notificaciones, entregas de maquila, gastos y bitácoras.',
    '🛡️ Supresión de Re-Renders Dobles y Metadata: Estandarización de { includeMetadataChanges: false } y centinela de detección de cambios de documentos en los 6 contextos y hooks reactivos clave, blindando la UI contra re-evaluaciones innecesarias ante ACKs locales.',
    '📊 Segregación de Órdenes Activas vs Concluidas: OrdersContext expone subconjuntos memoizados (activeOrders y closedOrders) optimizando el rendimiento de cómputo en Dashboard, Expedientes y Tracking.',
    '🧪 Cobertura Integral de Pruebas: 238 pruebas unitarias pasando al 100% (35 suites) con validación estricta de TypeScript 5 sin errores.',
  ],
};



