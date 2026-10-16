export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.15.0: Cuentas conciliadas y operación guiada', date: '15 de Octubre de 2026', time: '',
 summary: 'Los documentos del portal se aplican a facturas y cobranza con trazabilidad. El inicio explica los siguientes pasos y el portal distingue órdenes de producción de contrarrecibos históricos.',
 highlights: ['Conciliación por departamento, fecha e importe; las asociaciones ambiguas requieren detalle.', 'Panel de documentos aplicados con facturado, pagado, saldo y datos fiscales pendientes.', 'Los XML completan facturas del portal conservando pagos y contrarrecibos.', 'Sin órdenes, productos, entregas ni saldos añadidos desde listas fijas del programa.', 'Pago del cliente separado del ingreso recibido; caja excluye movimientos eliminados y evita procesar un mismo evento dos veces.', 'Saldo de maquila compartido entre inicio, estado de cuenta y portal, con tarifas reales y corte del saldo inicial.', 'Revisión de saldos desde sus registros y portal con selección de orden, captura y confirmación en tres pasos.'],
};
