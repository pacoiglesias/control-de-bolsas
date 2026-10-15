# Entrega 9.14.0 — documentos Providencia y captura pendiente

El importador reconoce listados de contrarrecibos pagados o generados, el panel de facturas del proveedor y complementos de pagos en PDF. Conserva cada fila extraída y el documento original, con una identidad basada en el contenido para evitar archivos repetidos. Arrastrar, el botón rápido y la carga del archivo utilizan la misma ruta de registro.

Inicio y Documentos muestran los documentos faltantes, diferencias de importe u OC y páginas no incluidas. La lista se recalcula al capturar los expedientes. Un listado del portal no aporta conceptos, kilos ni UUID fiscal de todas las facturas: se registra como referencia para conciliación y solicita los XML/PDF faltantes sin generar ventas, entregas ni ingresos adicionales. Los listados pagados no aportan fecha ni referencia bancaria y no producen nuevos abonos.

El REP PDF se reconoce por su tipo, número fiscal y documentos relacionados. Los UUID partidos entre columnas se reconstruyen y se validan los saldos y el monto total pagado; el TOTAL fiscal de cero no se usa como monto del pago. La coincidencia con una factura exige el UUID real. Se solicita vincular el cobro para impedir que un TR y su REP dupliquen ingresos.

Los documentos de este caso se verificaron con el mismo extractor PDF.js que usa la aplicación: 25 filas pagadas de 116 resultados, 25 facturas de 187, 11 contrarrecibos generados y dos documentos relacionados del complemento 6389. La OC 71/14400 se conserva con siete partidas y 9,500 kg pedidos; su folio no genera entregas ni facturas ficticias. Los originales y la extracción completa permanecen fuera de Git.
