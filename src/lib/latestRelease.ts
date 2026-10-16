export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.15.2: Entregas claras y producción comprobable', date: '16 de Octubre de 2026', time: '',
 summary: 'Entregas y báscula muestra primero las órdenes de producción y los documentos que faltan. Las facturas no generan entregas y una remisión al cliente no crea otra compra al proveedor.',
 highlights: ['Producción y archivo histórico separados, con kilos físicos comprobables y próximos pasos por orden.', 'Registrar una remisión al cliente conserva sus facturas y pagos y no crea una compra adicional.', 'Las facturas nuevas conservan cambios concurrentes y actualizan su espejo sin generar entregas físicas.', 'Conciliación por departamento, fecha e importe; las asociaciones ambiguas requieren detalle.', 'Panel de documentos aplicados con facturado, pagado, saldo y datos fiscales pendientes.', 'Los XML completan facturas del portal conservando pagos y contrarrecibos.', 'Sin órdenes, productos, entregas ni saldos añadidos desde listas fijas del programa.', 'Pago del cliente separado del ingreso recibido; caja excluye movimientos eliminados y evita procesar un mismo evento dos veces.', 'Saldo de maquila compartido entre inicio, estado de cuenta y portal, con tarifas reales y corte del saldo inicial.', 'Revisión de saldos desde sus registros y portal con selección de orden, captura y confirmación en tres pasos.'],
};
