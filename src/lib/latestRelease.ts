export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.13.0: Órdenes de compra y pagos con varias facturas', date: '15 de Octubre de 2026', time: '',
 summary: 'La importación distingue OC de remisiones, conserva partidas y precios del documento y concilia transferencias por todas sus facturas.',
 highlights: ['Prioridad de la OC frente a las reglas genéricas de remisión y báscula.', 'Registro de OC con identidad exacta, kilos, partidas, departamento y precio real; sin facturas ni entregas artificiales.', 'Desglose completo de pagos Providencia: factura, contrarrecibo, fecha e importe por fila.', 'Aplicación atómica de las facturas de una transferencia, con comprobantes idempotentes y espejo de cobranza.', 'Acceso a expedientes históricos reales para conciliar documentos sin depender de la lista comercial activa.'],
};
