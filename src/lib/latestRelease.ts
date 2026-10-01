export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.2: Flujo Integral de OC de Punta a Punta, Precios Fluctuantes y Contingencias Operativas',
  date: '01 de Octubre de 2026',
  time: '08:35 PM',
  summary: 'Actualización y auditoría integral v9.10.2: gestión ágil de precios de compra fluctuantes ($37, $38, $43) y precios de venta; stepper interactivo de 8 etapas del ciclo de vida de la OC; pedido a maquila con Andrés vía WhatsApp en 1 toque; gestión de contingencias (merma tolerable <2%, alerta de sobre-entrega y reasignación de folios rechazados); Centinela en vivo; y suite de 216 pruebas unitarias al 100%.',
  highlights: [
    '📈 Precios Fluctuantes y Margen en Vivo: Detección automática del precio de venta desde la OC y selector rápido de costo con Andrés ($37/$38/$43/personalizado) con cálculo dinámico de margen $/kg y utilidad neta.',
    '🧭 Stepper Operativo de 8 Pasos (OCLifecycleTracker): Vista paso a paso desde OC Recibida hasta Finiquito y Cobranza.',
    '📲 Pedir a Andrés por WhatsApp: Modal interactivo para enviar la orden de maquila con kilos, especificaciones, precio acordado y fecha límite.',
    '⚖️ Merma Tolerable (<2%): Cierre rápido formal para órdenes con ≥98% cumplido sin dejarlas como órdenes zombi.',
    '📈 Alerta de Sobre-Entrega / Excedente: Notificación inmediata para consultar a Providencia si se factura o se descuenta del siguiente lote.',
    '🔄 Sustitución de Factura Rechazada: Reasignación de nuevo folio SAT en estatus manual_review sin perder el historial de entregas de báscula.',
    '🛡️ Semáforo Centinela en Vivo: Monitoreo continuo de salud financiera en el encabezado del Dashboard.',
    '🧪 Suite de Pruebas al 100%: 216 pruebas unitarias aprobadas en 32 archivos.',
  ],
};

