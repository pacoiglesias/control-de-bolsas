export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.27: Rediseño Visual y Operativo Diario, Comparador de Facturas y Saldos en Pagos, Centro de Atención Unificado y Formularios Claros',
  date: '09 de Octubre de 2026',
  time: '10:20 AM',
  summary: 'v9.10.27: Traducción total del endurecimiento técnico a mejoras visuales y operativas de interfaz diaria: Centro de Atención Requerida Hoy unificado en el Dashboard sin widgets repetidos, con acceso directo a facturar entrega, cobrar vencidos o aclarar documentos; comparador visual de facturas en el HUD de pagos con desglose interactivo de total, pagos anteriores, saldo antes y saldo después de cada abono; semáforos de alta legibilidad en el listado de órdenes (Folio, Cliente, Kilos, Facturación c/IVA y Saldo Vivo); formularios ordenados por tarea con campos obligatorios marcados con asterisco (*); y 295 pruebas unitarias 100% en verde.',
  highlights: [
    '🎯 Centro Operativo "Atención Requerida Hoy": Unificación del panel principal del Dashboard, eliminando redundancias para priorizar órdenes con alertas, facturas por timbrar, cobranza vencida y pagos por conciliar con botones directos de acción.',
    '💳 Comparador y Desglose Financiero de Facturas y Saldos: Visualización instantánea del impacto de un abono (Total Factura, Pagos Anteriores, Saldo Antes y Saldo Después con aviso de liquidación 100%) antes de confirmar en el HUD de pagos.',
    '📊 Tabla de Órdenes con Semáforo y Lectura Clara: Distinción visual entre facturación c/IVA, cobrado efectivo y saldo pendiente con badges accesibles de alto contraste, reduciendo la necesidad de abrir múltiples pantallas.',
    '📝 Formularios Estructurados por Tareas: Marcación explícita de campos obligatorios (*) en datos de orden, precios de venta y costos de maquila, conservando la información ante errores recuperables.',
    '🛡️ Transacciones Atómicas e Idempotencia con Trazabilidad: Deduplicación binaria SHA-256, atomicidad con writeBatch en contrarrecibos multiorden y registro obligatorio en auditoría.',
    '🧪 295 Pruebas Unitarias y E2E 100% en Verde: Aislamiento determinista en 40 suites sin peticiones gRPC externas.',
  ],
};
