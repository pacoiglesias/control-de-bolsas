# v9.15.0 — Conciliación documental y operación guiada

Los listados del portal antes se archivaban sin completar las cuentas operativas. Además, la lectura de órdenes añadía datos fijos y el portal interpretaba contrarrecibos históricos como producción pendiente. Esta versión aplica las filas de facturas a sus órdenes y conserva los originales y el historial de los registros sustituidos.

## Comportamiento

- Facturas individuales vinculadas por OC; contrarrecibos asociados únicamente si existe una combinación única por departamento, fecha y suma exacta. Una asociación por estos criterios requiere conservar el detalle individual para su comprobación documental.
- REP con UUID, parcialidad, saldo anterior, pago y saldo insoluto. Pago acreditado al cliente separado de recepción interna del dinero. Reimportar no suma otro abono.
- XML o PDF fiscal que coincide con la factura del portal completa su identidad. El XML con conceptos en kilos completa cantidades sin crear otra venta ni entrega física. Una diferencia de UUID o importe detiene el cambio.
- Precios históricos y costos registrados conservados. No se calculan kilos dividiendo importes entre el precio de venta predeterminado. Los datos desconocidos se marcan pendientes.
- No hay inyección automática de órdenes, conceptos o entregas por folio o departamento. Las entregas inferidas de facturas quedan fuera del avance físico.
- Caja considera únicamente movimientos activos. Su actualización usa un marcador por evento para soportar reintentos sin sumar dos veces.
- La cuenta de maquila comparte fórmula y fecha de corte para no volver a cargar compras incluidas en el saldo inicial.
- Inicio con accesos de captura; documentos con importes aplicados y faltantes; revisión de saldos de solo lectura; portal con tres pasos y partidas visibles al seleccionar la orden.

## Alcance de la evidencia

Los listados recibidos son páginas parciales del historial. Registran importes y estados, pero no reemplazan XML, detalle individual de contrarrecibos, remisiones, costos ni arqueos físicos. Los faltantes continúan visibles y no se declaran comprobados por el hecho de que las sumas coincidan.

La reparación inicial conserva un respaldo completo previo de Firestore y sus subcolecciones, precondiciones de versión en cada escritura y un registro de conciliación. Los archivos de negocio y exportaciones se guardan localmente fuera del repositorio; Git contiene código y documentación sin credenciales.

## Validación de entrega

Pruebas financieras, lectura de documentos, idempotencia, enriquecimiento fiscal, avance físico y saldos de maquila; compilación de aplicación y funciones; revisión estática. La entrega local incluye los resultados finales de las comprobaciones y la identidad de la versión publicada.
