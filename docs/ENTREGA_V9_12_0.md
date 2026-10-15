# Entrega 9.12.0

La portada se reorganizó alrededor de la operación diaria: encabezado sencillo, filtros con nombre, cuatro indicadores compactos, selector de vistas, capturas de entrega/factura/cobro y lista de próximos pasos. Reportes, exportaciones y revisión se agrupan en Herramientas; etapas y tabla de órdenes se consultan al desplegar Seguimiento. La barra lateral conserva un solo saldo de cartera.

Los avisos del encabezado y su detalle muestran pendientes de operación en lugar de presentar un porcentaje como estado técnico del sistema. Los accesos de revisión abren el expediente correspondiente. Las entregas que exceden los kilos pedidos solicitan revisión antes de iniciar facturación.

Inicio, barra lateral y totales de auditoría usan `buildReceivables`: facturas reales, abonos descontados, liquidaciones excluidas de deuda y varias facturas por contrarrecibo. La tabla de auditoría conserva cada factura y sus importes originales. No se sustituyen saldos faltantes con la tabla histórica oficial ni se inventa una factura desde una OC sin facturas. El saldo vencido es parte de la cartera, no se suma nuevamente.

Pruebas: 389 aprobadas y 7 omitidas que requieren el emulador de Firestore. Cobertura de líneas 74.37%, ramas 62.54%, funciones 92.15%. Incluye regresiones de consistencia entre vistas y pendientes de kilos calculados por orden. La entrega requiere compilación frontend/PWA/Functions y revisión de estilo sin errores antes de publicar.

La publicación actualiza Hosting; no cambia registros de negocio ni despliega funciones o reglas. Los saldos e inconsistencias documentales detectados requieren conciliación con documentos reales. El respaldo local contiene código, compilación y un bundle recuperable de Git; no es una exportación de Firestore ni contiene credenciales privadas.

Restauración: clonar `control-bolsas.bundle`, instalar dependencias con `npm ci`, recuperar las variables privadas desde su ubicación segura y compilar. `dist/` también se conserva como artefacto publicado. El historial de Git conserva versiones anteriores; la carpeta de entrega mantiene únicamente el paquete activo después de verificar el nuevo.
