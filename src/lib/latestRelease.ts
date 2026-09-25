export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.6.1 Enterprise: Rediseño Ergonómico Anti-Colisión de Alertas Prioritarias & Reconciliación Canónica TH/GT',
  date: '25 de Septiembre de 2026',
  time: '03:15 PM',
  summary: 'Rediseño integral de la tarjeta de alertas prioritarias en el Dashboard: erradicación total de textos encimados y saltos verticales, reconciliación precisa de departamentos (TH Nava vs GT Evelia en OC 120267114302), cálculo exacto de saldo remanente (6,014 kg pendientes tras F-6307) y botones de acción compactos con 204 tests unitarios pasando.',
  highlights: [
    '📐 Rejilla y Tarjetas Anti-Colisión: Rejilla fluida responsiva (minmax 330px), cabecera desacoplada con chips no rompibles y botones de acción con ancho optimizado sin desbordamiento.',
    '🏢 Identificación Canónica TH vs GT: Corrección de la clasificación errónea de la OC 120267114302 (TH · José Nava), eliminando la confusión con Evelia.',
    '⚖️ Cálculo Exacto de Remanente: Reconocimiento de entregas y facturación parcial (F-6307: 1,986 kg) mostrando el saldo exacto pendiente de entregar (6,014 kg de 8,000 kg).',
    '🔗 3-Way Matching Horizontal: Semáforo de trazabilidad (OC ➔ Báscula ➔ Factura ➔ CR) bloqueado en una sola fila sin saltos de línea verticales.',
  ],
};
