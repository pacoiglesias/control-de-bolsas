export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.14.0: Documentos del portal y captura guiada', date: '15 de Octubre de 2026', time: '',
 summary: 'Lee listados del portal y complementos de pago, conserva sus filas y señala lo que falta capturar o conciliar.',
 highlights: ['Listas de contrarrecibos generados y pagados con fechas, importes y saldos por fila.', 'Panel del proveedor con OC, folio, fecha e importe de cada factura, incluidas fechas partidas entre líneas.', 'Complemento de pago PDF con UUID y saldos de cada documento relacionado; distingue el monto pagado del total fiscal cero.', 'Inicio y Documentos muestran pendientes que se recalculan al capturar datos.', 'Advierte páginas faltantes, diferencias de OC o importe y facturas ausentes sin generar ventas ni cobros duplicados.'],
};
