export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.8.0 Enterprise: Calibración Maestra de Cartera Providencia, Saldo de Caja $844,526.90 y Auditoría de Cierres de OC',
  date: '25 de Septiembre de 2026',
  time: '07:20 PM',
  summary: 'Alineación matemática 1:1 con los registros del portal oficial de Providencia: actualización de los 10 Contrarecibos Vigentes ($805,190.14 MXN), padrón de 10 Contrarecibos Pagados ($1,032,087.04 MXN), calibración de saldo en efectivo de caja a $844,526.90, incorporación de la Factura 6271 (1,500 kg), y módulo de auditoría de cierre de OCs con reporte de kilos faltantes y exportación.',
  highlights: [
    '💵 Saldo en Efectivo Calibrado a $844,526.90 MXN: Actualización canónica del saldo físico real en caja chica.',
    '📑 Cartera Oficial Vigente ($805,190.14 MXN): Cuadre exacto de los 10 Contrarecibos en portal (GT-993, GT-962, TH-1103, GT-929, TH-1068, GT-904, TH-1030, GT-874, TH-990, TH-946).',
    '✅ Cartera Pagada Oficial ($1,032,087.04 MXN): Registro histórico consolidado de los 10 Contrarecibos liquidados.',
    '🧾 Ingesta Factura 6271 (1,500 kg): OC 120267114114 de Nava elevada al 98.63% de cumplimiento (6,411.01 kg facturados), saldo final de sólo 88.99 kg.',
    '🏁 Auditoría y Reportes de Cierre de OC: Modal interactivo OcClosureModal y tablero OcFulfillmentReportModal con métricas de faltantes, mermas de pesaje, valor a $38/kg y exportación a CSV/WhatsApp.',
    '🛡️ 206 Pruebas Unitarias Verificadas: 100% de la suite pasando en Vitest con tipado estricto.',
  ],
};
