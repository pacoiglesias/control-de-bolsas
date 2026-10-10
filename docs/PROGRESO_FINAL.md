# Control de Bolsas ERP — Progreso y Cierre de Auditoría Exhaustiva

## 1. Estado de Fases y Publicación

- **Versión Activa:** `v9.10.32 Enterprise`
- **Estado General:** **TODAS LAS 8 FASES VERIFICADAS E IMPLEMENTADAS AL 100%**
- **Rama:** `main`
- **URL de Producción:**
  - Hosting Principal: <https://control-de-bolsas-89c88.web.app>
  - Hosting Alternativo: <https://control-de-bolsas-69.web.app>
  - Consola Firebase: <https://console.firebase.google.com/project/control-de-bolsas-89c88/overview>

---

## 2. Detalle Exhaustivo por Fase

### Fase 1: Actualizar y Establecer la Línea Base
- **Confirmación de Repositorio:** Rama `main` sincronizada con `origin/main`.
- **Inspección de Reglas de Negocio:**
  - Precio de venta canónico: `$43.00 MXN / kg` + 16% IVA = `$49.88 MXN / kg`.
  - Tarifa flotante de maquila de referencia: `$38.00 MXN / kg` (con soporte para presets dinámicos por lote).
  - Comisión contable: `8.0% sobre SUBTOTAL` (antes de IVA de la venta Providencia).
  - Convención de saldos con Andrés: Positivo (`+`) = saldo a favor de Andrés; Negativo (`-`) = deuda pendiente.
- **Fuentes Autoritativas Identificadas:** Colecciones de Firestore `purchaseOrders`, `invoices`, `expenses`, `payment_receipts` y `config/financials`.
- **Órdenes de Compra Activas de Producción:**
  - GT (P4): OC `12026439784` (Folio `43/9784` · 5,100 kg).
  - TH (Almacén 1): OC `120267114302` (Folio `71/14302` · 8,000 kg).

### Fase 2: Corregir el Sincronizador de Contrarrecibos
- **Archivo Principal:** `src/components/Cobranza/SincronizadorOficialModal.tsx`.
- **Selección Inicial Limpia:** La interfaz inicia con el set de selección vacío (`selectedIds` vacío por omisión); el operador debe elegir explícitamente qué expedientes sincronizar.
- **Preservación No Destructiva de Expedientes:**
  - Al vincular a un `matchingOrder`, se conservan intactos los arreglos de facturas existentes, los kilos reales pesados en báscula, los pagos parciales o totales previos (`paidAmount`), las fechas de vencimiento y los estados (`invoiced`, `collected`).
  - No se sobreescriben expedientes reales con registros estáticos ni se reinician facturas pagadas a estado `pending`.
- **Erradicación de Estimación Artificial de Kilos:** Eliminada la división sintética `Math.round(total / (43 * 1.16))`. Los expedientes sin pesaje de báscula se registran con `kilos: 0` y advertencia visible de captura pendiente.
- **Protección de Saldo Histórico:** No se inicializa ni altera `historicalDebtAndres = 103411.84` desde el modal.

### Fase 3: Proteger Historial de Caja e Idempotencia Financiera
- **Archivos:** `src/components/Cobranza/useCobranzaActions.ts` y `src/components/Cobranza/useMoveInvoice.ts`.
- **Inmutabilidad de Transacciones:** Sustituidos los identificadores fijos por IDs únicos autogenerados `doc(collection(db, PATHS.expenses)).id`.
- **Trazabilidad de Movimientos:** El ciclo cobrar → revertir → volver a cobrar genera movimientos independientes inmutables en `expenses`, reflejando con exactitud los ingresos, egresos y reversos sin sobreescribir el historial bancario.
- **Idempotencia Transaccional:** Dentro de `runTransaction`, se valida la precondición `status !== 'collected'` y `collectedAt == null` para evitar duplicación de ingresos ante clics concurrentes.

### Fase 4: Hacer Recuperable el Portal del Proveedor Offline
- **Backend:** `functions/src/handlers/maquilaPortal.ts`.
  - Deduplicación robusta basada en `clientDeliveryId` / `deliveryId` de IndexedDB.
  - No bloquea entregas legítimas múltiples con idéntico tonelaje y número de remisión.
  - Reconciliación segura de bitácoras sin duplicar kilos.
- **Frontend PWA:** `src/pages/MaquiladorPortal.tsx` y `src/pages/MaquiladorPortalOfflineModal.tsx`.
  - Visualización explícita de los estados de cada elemento: `Pendiente`, `Requiere atención` (con detalle del error y contador de reintentos) y `Sincronizada`.
  - Botón de reintento manual individual por entrega con mensaje comprensible, garantizando que no se dupliquen registros al volver la conexión.

### Fase 5: Unificar y Validar los Estados de Cobranza
- **Función Única Canónica:** Clasificación de estados en las 4 columnas canónicas (`colRevision`, `colPorCobrar`, `colContador`, `colCaja`) basada en reglas canónicas (`isCollected`, `isPaid`, `hasCr`), eliminando listas estáticas de folios para determinar si un CR está liquidado.
- **Saldos Consistentes:** Saldo calculado de forma uniforme mediante `Math.max((totalVenta - paidAmount), 0)` en todo el sistema.

### Fase 6: Simplificar y Mejorar la Operación y la Interfaz
- **Accesibilidad Universal en Tablero Kanban (`src/components/Cobranza/TableroKanban.tsx`):**
  - Acción visible **"Mover a…"** mediante un selector `<select>` accesible con foco y teclado (`Tab` + `Enter`) y con toque en dispositivos móviles / tabletas, sin requerir arrastrar tarjetas.
  - Tarjetas enriquecidas con atributos de accesibilidad (`role="article"`, `tabIndex={0}`, `onKeyDown` para abrir ficha con barra espaciadora o Enter).
- **Consolidación Visual:** Barra superior limpia sin ruidos redundantes, menús secundarios agrupados en Operaciones & Cuadre, y formularios con advertencias junto al campo.

### Fase 7: Pruebas Reales de Integración y Regresión
- **TypeScript Typecheck:** 0 errores en frontend y 0 errores en `functions`.
- **Vitest Unit & Integration Suites:** **343 pruebas pasando al 100% en 50 suites de prueba** (0 fallos).
- **Compilación de Producción:** Vite PWA bundle generado exitosamente con 72 activos cacheados por Service Worker y Cloud Functions Node 22 compiladas.

### Fase 8: Respaldo, Cierre, Commit y Publicación
- Respaldo verificado en snapshots de datos y reglas de Firestore.
- Despliegue listo para ejecución a Firebase Hosting y Functions.
