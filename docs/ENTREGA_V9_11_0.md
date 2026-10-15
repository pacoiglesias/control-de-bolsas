# Entrega v9.11.0 — operación diaria y facturación

Fecha de cierre: 15 de octubre de 2026.

## Comparación inicial

La carpeta local y `pacoiglesias/control-de-bolsas`, rama `main`, coincidían en el commit `37510867d70ad081afe87dcab4bbbb1105891f75` (v9.10.33). La carpeta no tenía modificaciones pendientes. La comparación se confirmó con el conector de GitHub y posteriormente con `git fetch`.

## Cambios gráficos y de uso

- Inicio **Mi día**, con tres accesos principales: registrar entrega, registrar factura y registrar cobro.
- Lista **Qué sigue hoy**, con búsqueda por orden, factura o cliente y filtros por etapa. Muestra seis pendientes inicialmente y permite desplegar el resto.
- Una siguiente acción por factura, distinguiendo vencimientos, contrarrecibos pendientes y pagos por ingresar a caja. Muestra el saldo después de abonos parciales.
- Menú lateral con nombres más breves; eliminación de la segunda fila de selectores repetidos del tablero.
- Simulaciones y detalle financiero bajo una sección desplegable. El resumen ya no repite la franja animada de indicadores ni el radar de alertas.
- Estilos con los colores del tema, adaptación a móvil, botones de al menos 44 px en móvil y foco visible en los controles nuevos.
- El botón de facturación identifica el registro de una factura existente; no genera folios fiscales ficticios.

## Correcciones operativas

- Facturación rápida mediante la misma transacción que el editor: conserva las demás facturas y actualiza el espejo de cobranza.
- Revalidación de kilos con el expediente actual al guardar; protección ante capturas simultáneas.
- Asignaciones de kilos por factura para entregas parciales. Editar una factura no vuelve a consumir sus kilos; eliminarla libera únicamente su asignación.
- La última factura puede eliminarse conservando la orden y sus entregas. Facturas con pagos requieren reversión previa en Cobranza.
- Una edición desactualizada no puede sobrescribir pagos registrados mientras el documento estaba abierto.
- Entregas con kilos facturados protegidas contra eliminación y cambios en sus cantidades.
- Validación entre kilos totales, desglose de partidas y capacidad actual de la orden al capturar una entrega.
- Captura rápida actualiza también el espejo de facturas y permite que un contrarrecibo ampare varias facturas.
- XML: carga conceptos, cantidades y precios; exige revisión para otras unidades, descuentos o impuestos incompatibles con el registro rápido.
- Los cierres de producción no ocultan los pendientes financieros del inicio.
- Corrección de un doble conteo de kilos cuando el código normalizado coincide con el identificador de partida.

## Comprobaciones realizadas

- `npm run build`: frontend, PWA y compilación de Cloud Functions completados.
- `npm run lint`: sin errores ni advertencias.
- `npm run test:coverage`: **381 pruebas aprobadas**, 56 archivos aprobados y un archivo omitido.
- Cobertura: 74.26% de líneas/sentencias, 62.18% de ramas y 92.05% de funciones; supera los umbrales configurados.
- Cuatro pruebas de interacción sobre los componentes reales: filtros, expansión de pendientes, estados vacíos y modo consulta.
- Pruebas transaccionales con almacenamiento simulado para concurrencia, abonos, edición y eliminación.

Las siete pruebas omitidas requieren un emulador real de Firestore. No se hicieron cobros, entregas ni escrituras de prueba sobre datos de producción. La revisión inicial usó DOM simulado porque el navegador no pudo acceder al servidor local. Después de publicar se revisó visualmente el inicio de escritorio y se probaron filtros, búsqueda, estado vacío y límite inicial de seis pendientes en el sitio real. No se afirma una inspección visual completa en todos los dispositivos.

## Recorrido recomendado

1. Abre **Inicio → Mi día**. Elige una tarea de **Qué sigue hoy** o usa las tres acciones principales.
2. Registra los kilos y la remisión de la entrega. Si editaste una entrega dentro de la orden, guarda sus cambios antes de facturar.
3. Registra la factura con su folio real o carga su XML. Revisa conceptos e importes antes de guardar.
4. Añade el contrarrecibo de la factura y da seguimiento en **Cobranza**.
5. Confirma la recepción del dinero mediante el flujo de cobranza y caja existente.

## Publicación y recuperación

Destino: Firebase Hosting, sitios `control-de-bolsas-89c88` y `control-de-bolsas-69`. Esta entrega modifica el frontend; no requiere cambios en reglas ni en el código de Cloud Functions desplegado.

La publicación terminó y se comprobó por HTTP que ambos sitios y `bolsas.cobertores.com` sirven la misma versión `9.11.0`, con el mismo commit de código y la misma huella SHA-256 del HTML de la compilación local.

En la revisión posterior se detectó que el acceso con Google rechazaba el dominio principal (`auth/unauthorized-domain`). Con autorización explícita del usuario, se agregaron `bolsas.cobertores.com` y `control-de-bolsas-69.web.app` a la lista de dominios autorizados de Firebase Authentication, conservando los tres dominios previos. Se confirmó el inicio de sesión con Google desde el dominio principal y la carga de **Inicio → Mi día**.

Las siete observaciones operativas visibles del Centinela corresponden a tres contrarrecibos vencidos, tres facturas sin contrarrecibo y una entrega pendiente de facturación. Son pendientes de operación y cobranza; no representan fallos de compilación. Sus saldos y estados se conservan para gestionarlos con los comprobantes correspondientes.

La carpeta de entrega local contiene una copia del código, la compilación desplegable y un respaldo de Git. El manifiesto local registra el commit y el resultado de comprobación HTTP de los sitios. Las variables privadas de entorno permanecen en la carpeta de trabajo y no se incorporan al repositorio público.

Para recuperar el código desde el respaldo de Git: `git clone control-bolsas.bundle control-de-bolsas`. Instala dependencias con `npm ci` y `npm --prefix functions ci`. Conserva o restaura la configuración de entorno local antes de compilar. Para restaurar el hosting, usa el contenido `dist` del ZIP de entrega o recompila este commit y publica únicamente Hosting.

Se conserva una sola entrega activa local. El historial de Git y las versiones recuperables de Firebase se mantienen para permitir volver atrás.
