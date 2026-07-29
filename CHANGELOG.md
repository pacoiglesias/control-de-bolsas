# Historial de Versiones (Changelog) - Control Bolsas

Este documento rastrea la evolución del sistema desde su inicio hasta la versión actual.

## [v5.3.0] - 28 Julio 2026 (Seguimiento OC, Flujo 3 Estados y Respaldo Offline Sync)
* **Diferenciación Estricta Contrarecibo vs Folio:** Clarificación total en toda la UI y base de datos: GT-xxx y TH-xxx son números de Contrarecibo (CR), mientras que cada factura posee su Folio numérico individual.
* **Seguimiento OC (`/oc`):** Nueva vista dedicada para rastrear kilos contratados en Órdenes de Compra vs kilos surtidos y remanentes.
* **Flujo de Cobro de 3 Estados:**
  - `pending`: Por cobrar al cliente.
  - `paid`: 🟡 Con el Contador (cliente transfirió al contador).
  - `collected`: 💵 Recibida del Contador (efectivo recibido en Caja Chica neto de comisión).
* **Widget Dashboard "Por Recibir del Contador":** Monitoreo en vivo de facturas cobradas por el cliente pero pendientes de recibir del contador.
* **Comisión Editable en Porcentaje (%):** Edición directa en porcentaje (ej: 6.9%) en la pantalla de Configuración.
* **Complemento de Pago SAT (REP):** Control de estado de emisión (`pending`, `issued`, `na`).
* **Respaldo HTML Offline Mapeado (`bridge.ts`):** Exportación HTML offline sincronizada con campos de OC y estados de cobro.

## [v6.4] - 28 Julio 2026 (Auditoría de Automejora Continua)
* **Performance Extremo (O(1)):** Se refactorizaron los bucles matemáticos de React (`finance.ts` y `OrderModal.tsx`) para eliminar el sobre-cálculo masivo por cada pulsación de tecla.
* **Backend Optimizado:** Búsqueda O(1) para Complementos de Pago XML mediante indexación inversa (`invoiceUuids`), previniendo caídas por escaneos totales de la base de datos.
* **Seguridad (Zero-Trust):** Corrección en `storage.rules` para desbloquear la lectura de XML en la nube, y blindaje de Firebase Auth exigiendo `email_verified == true`.

## [v6.3] - 28 Julio 2026 (PWA y Automatización Local)
* **App PWA Instalable:** El sistema es ahora una Progressive Web App completa con íconos dinámicos en alta resolución autogenerados.
* **Control Maestro:** Reemplazo de más de 12 scripts de lote obsoletos por un único y elegante `CONTROL_MAESTRO.bat` interactivo.
* **Protector de Código:** Inclusión de `PROTEGER_CODIGO.bat` para automatizar la privacidad del repositorio en GitHub mediante API y un Personal Access Token.
* **Derechos de Autor:** Agregados metadatos y créditos explícitos (Paco Iglesias © 2026).

## [v6.2] - 28 Julio 2026 (Fase 7: Enterprise)
* **Procesamiento de XML (CFDI 4.0 y Pagos 2.0):** Soporte nativo para lectura cruda de XML con `fast-xml-parser`. Extrae los UUIDs de los Complementos de Pago (REP) e impacta la base de datos marcando automáticamente la factura como 'Emitido'.
* **Inmutabilidad Financiera (Snapshots):** `computeFinancials` ahora guarda una fotografía de los parámetros globales en el instante en que se crea la factura. Modificar los precios o comisiones globales hoy ya no altera el historial contable de meses pasados.
* **Pagos en Lote (Contrarecibos):** Nuevo botón visual en Cobranza para liquidar de golpe todas las facturas que compartan el mismo número de contrarecibo.
* **Integración Continua (CI/CD):** Implementación de GitHub Actions (`deploy.yml`) para compilar y desplegar automáticamente la nube en cada *git push*.

## [v6.1] - 28 Julio 2026 (Lectura de Facturas)
* **IA Bi-funcional:** La Inteligencia Artificial ahora es capaz de procesar **Facturas de Venta** además de Órdenes de Compra.
* **Conciliación Automática:** Si subes una Factura en PDF, la IA extrae la referencia de la OC (ej. OC 120267), busca el expediente original y anexa la factura automáticamente.
* Valida el Folio Fiscal (UUID) para asegurar que nunca se dupliquen las facturas.
* **Agrupación de Contrarecibos:** En la pantalla de Cobranza, las facturas que compartan el mismo número de contrarecibo mostrarán la etiqueta visual `Compartido` para facilitar el cobro en bloque.

## [v6.0] - 28 Julio 2026
* **Inteligencia Artificial Avanzada:** Gemini ahora extrae el detalle completo de los artículos (Cantidad, Unidad, Descripción, P.U., e Importe) desde la tabla de las Órdenes de Compra en PDF.
* **Rediseño de Expedientes (OrderModal):** 
  * Se añadió una tabla de "Detalle de Artículos" en la pestaña de Resumen.
  * Los precios unitarios ahora son individuales por partida, eliminando la dependencia del precio global de la configuración para las operaciones detalladas.
* **Mejoras UX Proactivas:**
  * **Modo Oscuro (Dark Mode):** Toggle global para cambiar la interfaz.
  * **Búsqueda Global (Ctrl+K):** Atajo de teclado en toda la app para buscar expedientes, clientes o folios rápidamente.
  * **Status en vivo:** Indicador de "Sistema OK" en línea/offline en la barra superior.
* **Documentación:** Creación de `INSTRUCCIONES_USO.md`, limpieza de scripts de migración antiguos y estandarización del `SISTEMA_ACTUAL.md`.

## [v5.2] - Julio 2026
* **Caja Chica Dinámica:** Integración del KPI de gastos en el Dashboard principal para conocer la liquidez real.
* **Cobranza Ágil:** Nuevo botón "💰 Marcar Cobrada" que auto-llena fecha y monto total de la factura con 1 clic.
* Modificación de la pestaña por defecto en expedientes desde Cobranza (abre directo en Facturas).

## [v5.0] - Julio 2026
* **Soporte Multi-Factura:** Migración de la estructura de base de datos. Las OCs pasaron de tener 1 ciclo de crédito a tener un arreglo de `invoices[]` y `deliveries[]` independientes.
* Actualización de la Cloud Function `checkOverdueInvoices` para recorrer los arreglos de facturas.
* Nuevas métricas en Dashboard (Kilos Entregados vs Pedidos).

## [v4.0]
* Parche de seguridad para proteger los datos financieros públicos en Hosting.
* Implementación de reglas restrictivas en Firestore (`firestore.rules`).

## [v1.0 - v3.0]
* Creación del ERP base en React/Vite.
* Conexión básica con Firebase (Auth, Firestore, Storage).
* Implementación original de la IA (GenAI) para extraer únicamente Total de Kilos y Folio.
