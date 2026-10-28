export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.2: Wizard de Facturación Parcial (Remisión 114400) y Tablero de Control Total',
  date: '27 de Octubre de 2026',
  time: '17:50',
  summary: 'Asistente interactivo de Facturación Parcial para la Remisión 114400 (6,805.76 kg · $347,366.00 MXN) que permite dividir el timbrado en múltiples facturas editables por renglón con saldo restante en vivo, botón directo en el Tablero de Entregas, y generación instantánea de prefactura PDF oficial.',
  highlights: [
    'Wizard Interactivo de Facturación Parcial (Remisión 114400): interfaz por partidas con inputs en vivo para dosificar kg a facturar ahora y visualizar el saldo restante por concepto.',
    'Persistencia Multi-sesión: almacenamiento local seguro (localStorage) que recuerda las cantidades ya timbradas para no duplicar ni perder saldo entre emisiones.',
    'Generación Instantánea de Prefactura PDF: desglose fiscal CFDI 4.0 con clave SAT 24141500, unidad KGM, $44.00/kg + 16% IVA y datos del receptor Providencia.',
    'Acceso Directo desde Tablero de Entregas: botón "✂️ Dividir Remisión" integrado en la tarjeta de TH · Nava para agilizar la operación diaria.',
    'Auditoría y Cuadre de Órdenes Abiertas: consolidación de las 2 OCs principales (OC 71/14400 y OC 43/9834) con conciliación de báscula vs patio.',
    'Caja Chica Auditada: calibrador transaccional garantizando exactamente $451,848.56 MXN en efectivo disponible.',
  ],
};

