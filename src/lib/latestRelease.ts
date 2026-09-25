export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.8.1 Enterprise: Conciliación de Deuda Providencia $919,116.06, Vencidos $81,780.00, F-6302/F-6307 y Cierre Rápido de OCs',
  date: '25 de Septiembre de 2026',
  time: '10:45 PM',
  summary: 'Ajuste financiero de máxima precisión: Conciliación de Deuda Total Providencia en $919,116.06 MXN ($805,190.14 en 10 CRs vigentes + $113,925.92 en Facturas 6302 y 6307), desglose oficial de Vencidos en $81,780.00 (CR TH-946), botón interactivo de 1 clic para cerrar y finiquitar OCs desde la tarjeta del dashboard (OC 14114 de Nava), y depuración del pod de Evelia con opción para archivar OCs al día y enfoque en la OC activa 9784.',
  highlights: [
    '📊 Deuda Total Providencia Cuadrada al Centavo ($919,116.06 MXN): 10 Contrarecibos vigentes ($805,190.14) + 2 Facturas en revisión ($113,925.92: F-6302 de 298 kg por $14,864.24 y F-6307 de 1,986 kg por $99,061.68).',
    '🚨 Monitoreo de Vencidos ($81,780.00 MXN): Clasificación oficial del CR TH-946 (Factura 6167) como único documento vencido.',
    '🔒 Botón Rápido de Cierre de OC en Alertas: Acceso directo desde el dashboard para cerrar la OC 120267114114 de Nava con sus 88.99 kg de merma acordada mediante acta formal.',
    '🧹 Descongestionamiento de Dashboard (GT Evelia): Erradicación de botones duplicados y nuevo botón "Guardar y Ocultar del Tablero" para expedientes al 100%, priorizando la OC activa 12026439784 (5,100 kg).',
    '🧪 206 Pruebas Unitarias Verificadas: Conciliación matemática auditada y pasando al 100%.',
  ],
};

