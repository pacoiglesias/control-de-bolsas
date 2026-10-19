export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
 version: 'v9.15.3: Documentos conciliados y medios kilos', date: '16 de Octubre de 2026', time: '',
 summary: 'La OC y la remisión originales rigen la asignación; el estado del proveedor conserva sus referencias y muestra errores. Facturación por partida en kilos enteros o medios kilos, con merma y costo físico completos.',
 highlights: ['Producción y archivo histórico separados, con kilos físicos comprobables y próximos pasos por orden.', 'Registrar una remisión al cliente conserva sus facturas y pagos y no crea una compra adicional.', 'Las facturas nuevas conservan cambios concurrentes y actualizan su espejo sin generar entregas físicas.', 'Conciliación por departamento, fecha e importe; las asociaciones ambiguas requieren detalle.', 'Panel de documentos aplicados con facturado, pagado, saldo y datos fiscales pendientes.', 'Los XML completan facturas del portal conservando pagos y contrarrecibos.', 'Sin órdenes, productos, entregas ni saldos añadidos desde listas fijas del programa.', 'Pago del cliente separado del ingreso recibido; caja excluye movimientos eliminados y evita procesar un mismo evento dos veces.', 'Saldo de maquila compartido entre inicio, estado de cuenta y portal, con tarifas reales y corte del saldo inicial.', 'Revisión de saldos desde sus registros y portal con selección de orden, captura y confirmación en tres pasos.'],
};
