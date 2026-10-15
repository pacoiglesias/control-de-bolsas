# Rectificación final 9.12.1

Se mantiene el rediseño y la cartera compartida de 9.12.0. La revisión de producción añadió estas rectificaciones:

- Los accesos de facturación del expediente usan el mismo formulario y transacción que la portada. Se retira el asistente antiguo con remisiones fijas, partidas prefijadas y emisión doble secuencial.
- Se elimina la creación inmediata de una factura en blanco. La captura manual pasa por conceptos, folio y validación antes de guardar.
- Las fechas de factura y vencimiento son visibles y editables. El XML conserva su fecha original y el plazo se calcula desde esa fecha; se rechazan fechas inexistentes o vencimientos anteriores.
- La pestaña de facturas prioriza historial y acciones. Datos fiscales y partidas de consulta quedan desplegables.
- El pendiente de facturación de Órdenes se suma por expediente para evitar que excesos de otra orden oculten entregas sin factura.
- La revisión de una sobreentrega abre la pestaña Entregas. El resumen muestra una sola unidad de kilos.
- Hosting desactiva la caché de la ruta inicial y del manifiesto de versión. La verificación detectó que `/` mantenía una hora de caché aunque `/index.html` ya tenía desactivada la caché.

La versión conserva los registros de negocio. Las discrepancias existentes de kilos, costos o asignación documental necesitan revisión contra comprobantes, sin correcciones financieras automáticas.

Verificación automatizada: 393 pruebas aprobadas y 7 omitidas que requieren el emulador de Firestore. Cobertura de líneas 74.42%, ramas 62.93% y funciones 92.25%.

La evidencia final de pruebas, compilación y publicación se incluye en el paquete local. La revisión visual en navegador cubre escritorio; se implementaron reglas adaptables, pero el navegador de comprobación no aplicó el ancho móvil solicitado, por lo que no se certifica una revisión a 390 px.
