export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.11.0: Operación diaria más clara y facturación segura',
  date: '14 de Octubre de 2026',
  time: '',
  summary: 'Inicio con próximos pasos por prioridad, navegación más simple y controles para conservar kilos, facturas y pagos al editar documentos.',
  highlights: [
    'Mi día: tres acciones principales y una lista filtrable con la siguiente tarea de cada factura.',
    'Menos controles repetidos y simulaciones financieras disponibles bajo demanda.',
    'Facturación rápida con transacción: conserva cambios concurrentes y actualiza el espejo de cobranza.',
    'Facturas parciales con desglose de kilos por documento y reversión precisa.',
    'Eliminar la última factura conserva la orden; los documentos con pagos requieren reversión previa.',
    'Entregas validadas con el saldo actual y coincidencia entre partidas y kilos totales.',
    'XML con conceptos reales y revisión explícita para unidades o impuestos incompatibles.',
  ],
};
