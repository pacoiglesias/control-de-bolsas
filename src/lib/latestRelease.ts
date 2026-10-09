export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.10.23: Rediseño Centrado en Expediente, Lista Priorizada de Trabajo, Pantalla de Diferencias 4-Way, Historial y Cierre Diario',
  date: '08 de Octubre de 2026',
  time: '06:15 PM',
  summary: 'v9.10.23: Evolución integral del ERP conforme a los 8 pilares operativos: Unificación del flujo alrededor del expediente (resumen, entregas, facturas, cobranza e historial inmutable), Lista de Trabajo Priorizada en el inicio con acciones urgentes y motivos de atención, Pantalla de Diferencias 4-Way Matching (Pedido vs Báscula vs Facturas vs Cobro), Cierre Operativo Diario con checklist de validación, desactivación de auto-asignaciones dudosas para documentos financieros, tooltips explicativos contextuales para conceptos contables (Subtotal, IVA, Utilidad, Flujo de Caja), y robustecimiento del Kanban de Cobranza.',
  highlights: [
    '⚡ Lista de Trabajo Priorizada en Inicio: Console inteligente que jerarquiza entregas pendientes de facturar, facturas en revisión, facturas vencidas y cobros por conciliar, explicando el motivo de atención con acceso directo al expediente.',
    '⚖️ Pantalla de Diferencias 4-Way Matching: Vista analítica interactiva que contrasta en paralelo Pedido ↔ Báscula ↔ Factura ↔ Pagos, detectando kilos en patio sin facturar, facturas que exceden báscula o saldo pendiente.',
    '📜 Línea de Tiempo e Historial Inmutable: Pestaña en cada expediente que audita quién hizo cada cambio, fecha, hora y valores anteriores y nuevos (kilos, importes y estados).',
    '🏁 Cierre Operativo Diario y Checklist: Modal con balance diario de pesajes en báscula, facturación CFDI emitida, flujo de caja chica y lista de verificación antes de terminar la jornada.',
    '🛡️ Integridad en Carga de Documentos: Supresión del auto-apply agresivo para evitar registros silenciosos o basados en coincidencias dudosas de importe.',
    'ℹ️ Ayuda Contextual Financiera: Micro-tooltips junto a cada campo explicando subtotal, IVA del 16%, comisión del 8% y diferencia entre margen neto ($1.56/kg) y flujo bruto ($8.44/kg).',
  ],
};
