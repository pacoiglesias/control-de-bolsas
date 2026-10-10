# Control de Bolsas ERP — Progreso y Cierre de Calidad

## 1. Estado de Fases

- **Versión Activa:** `v9.10.31 Enterprise`
- **Estado General:** **TODAS LAS VERIFICACIONES Y AUDITORÍAS SUPERADAS (100% EN VERDE)**
- **Rama:** `main`
- **URL de Producción:**
  - Hosting Principal: <https://control-de-bolsas-89c88.web.app>
  - Hosting Alternativo: <https://control-de-bolsas-69.web.app>
  - Consola Firebase: <https://console.firebase.google.com/project/control-de-bolsas-89c88/overview>

---

## 2. Resumen de Mejoras y Fases Auditadas

### Fase 1: Línea Base y Diagnóstico Canónico
- Verificación de entorno, dependencias y reglas de negocio vigentes ($43.00/kg venta, $38.00/kg maquila flotante de referencia, 8.0% comisión contable sobre subtotal).
- Identificación de fuentes de verdad en Firestore (`purchaseOrders`, `invoices`, `expenses`, `payment_receipts`, `config/financials`).

### Fase 2: Seguridad de Datos y Sincronización No Destructiva
- **Sincronizador Oficial (`SincronizadorOficialModal.tsx`):**
  - **Vinculación No Destructiva en Expedientes Existentes (`matchingOrder`):** Al vincular un contrarecibo a una orden existente, NO se destruye ni sobreescribe el arreglo `invoices[]`, ni se resetean los kilos reales de báscula, ni se reinician cobros (`paidAmount`) ni se degradan estados a `'pending'` si ya estaban en revisión o cobrados.
  - **Erradicación de Estimación Artificial de Kilos:** Eliminada la división sintética `Math.round(total / (43 * 1.16))`. Los expedientes sin remisión física de báscula se registran con `kilos: 0` y nota de captura pendiente, evitando corromper la balanza de maquila o los inventarios.
  - **Protección de `historicalDebtAndres`:** Eliminada la inicialización / sobreescritura automática de `103411.84` desde el sincronizador. La deuda histórica se gestiona exclusivamente por `useConfig` y ajustes del ERP.
  - **Selección Granular:** El conjunto de elementos seleccionados se inicializa vacío por omisión; ningún cambio se aplica sin la acción explícita del operador.

### Fase 3: Inmutabilidad e Idempotencia en Movimientos de Caja
- **Inmutabilidad de Transacciones (`useCobranzaActions.ts`, `useMoveInvoice.ts`):**
  - Sustituidos los identificadores estáticos de sobreescritura (`ingreso_cr_...`, `reverso_cr_...`, `ingreso_cobro_...`) por IDs únicos generados mediante `doc(collection(db, PATHS.expenses)).id`.
  - Cobros, reversiones y re-cobros posteriores generan registros históricos independientes en `expenses`, permitiendo que el historial y saldo bancario de caja chica refleje con total fidelidad los movimientos reales.
  - **Idempotencia Transaccional:** Dentro de `runTransaction`, si una factura ya fue recolectada (`collectedAt != null` o `status === 'collected'`), se omite para evitar sumar ingresos duplicados ante clics paralelos.

### Fase 4: Portal del Proveedor y Deduplicación Inteligente
- **Deduplicación Robusta de Entregas (`maquilaPortal.ts`):**
  - La comprobación de idempotencia descansa primariamente en el `deliveryId`/`clientDeliveryId` generado por la PWA en IndexedDB.
  - Permite registros legítimos múltiples con el mismo tonelaje y folio de remisión general (ej. dos viajes de 500 kg en el mismo día) sin falsos rechazos, mientras que los reintentos automáticos tras reconexión offline se detectan y responden limpiamente con `alreadyProcessed: true`.
  - **Sanitización Comercial:** Precios de venta al cliente, márgenes de ganancia y comisiones permanecen estrictamente ocultos para el maquilador.

### Fase 5: Simplificación Visual y Operativa
- Consolidación de barra de herramientas superior con botones de acción rápida, menú unificado de operaciones y eliminación de parpadeos de recarga.

### Fase 6: Pruebas Integrales de Ciclo Completo
- Cobertura completa de ciclo GT (OC 12026439784) y TH (OC 120267114302).
- Comprobación de comisiones contables, fórmulas de liquidación y signos de saldo con Andrés.

---

## 3. Matriz de Pruebas y Cobertura Final

- **TypeScript Typecheck Frontend & Functions:** **0 errores (código de salida 0)** en ambos proyectos.
- **Suite Vitest Total:** **341 pruebas pasadas al 100%**, 50 suites pasadas, 1 omitida (emulador local), 0 fallos.
- **Build de Producción:** **Exitoso (Vite PWA + Cloud Functions compilados al 100%)**.
