# Entrega 9.13.0 — lectura y registro de documentos Providencia

Las órdenes de compra se identifican antes de la remisión genérica. Se conserva el folio corto, la OC completa, todas las partidas y el precio impreso. Las cantidades pedidas no generan entregas ni facturas. La coincidencia de una OC requiere su identidad; no se asigna por importe a un pedido anterior.

El detalle de pagos admite varias facturas. Se muestra cada asignación y se verifica que su suma coincida con el encabezado. Se consultan los expedientes persistidos aunque no aparezcan entre los contrarrecibos activos del tablero. Las filas se aplican juntas en una transacción, con comprobantes que evitan repetir abonos. Una factura ausente, ambigua o sin saldo suficiente exige conciliación sin registrar parcialmente la transferencia.

Las tres entradas de documentos (arrastrar, botón rápido y modal de carga) comparten el registro de OC y de PDF de pagos. No se requiere elegir una OC para reconocer un detalle de pagos con facturas identificadas.

Validación: 403 pruebas aprobadas; 7 pruebas de reglas requieren emulador y se omiten en esta ejecución. Compilación de aplicación y funciones y revisión estática verificadas antes de publicar. Los documentos originales y los datos privados extraídos se conservan fuera del repositorio.

## Seguimiento 9.13.1

Una OC con lista explícita de facturas vacía y sin importe facturado no se interpreta como factura histórica por tener folio. El seguimiento muestra cero kilos entregados y facturados hasta su captura. Las tareas operativas indican la entrega pendiente y solicitan factura, contrarrecibo o cobro conforme existen sus antecedentes. La revisión de pagos identifica las facturas faltantes por folio/CR y permite volver a comprobarlas después de su captura. Cerrar sin aplicar se informa como documento pendiente; no se cuenta como duplicado. La prueba adicional protege la OC nueva con 9,500 kg sin documentos posteriores.

Comprobación en producción: se cargó la OC 71/14400 con sus siete partidas. El PDF TR_5189 se leyó con dos asignaciones, pero no se aplicó: faltan los expedientes de las facturas 6193 y 6224. El usuario confirmó que aún faltan datos por capturar. No se reconstruyeron esas facturas ni se crearon abonos.
