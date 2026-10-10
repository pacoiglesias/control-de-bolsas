# Control de Bolsas ERP — Progreso y Cierre de Calidad

## 1. Estado de Fases

- **Fase Actual:** **FASE 3 COMPLETADA**
- **Siguiente Fase:** **FASE 4: Portal del proveedor y funcionamiento sin conexión**
- **Rama:** `main`
- **Commit Previo de Partida:** `5bf2cc0` (Fase 2)
- **Cambios Realizados en Fase 3 (Estados y Flujo de Cobranza):**
  - `src/components/Cobranza/index.tsx`:
    - Eliminado el conjunto codificado `PAID_CRS_SET` (`new Set(['TH-836', 'TH-804', 'TH-768', ...])`).
    - Unificada la máquina de estados: `isCollected` (`status === 'collected'` o `collectedAt`), `isPaid` (`status === 'paid'` o `paidAt`), e `isPaidOrCollected`.
    - Unificados los cálculos de los KPIs de cabecera (`cobrado`, `comisiones`, `meDeben`, `vencido`) para coincidir exactamente con las columnas del tablero Kanban y el listado de facturas.
  - `src/components/Dashboard/MorningBriefingWidget.tsx`:
    - Eliminada la dependencia en `OFFICIAL_PAID_CRS_LIST` en el cálculo de `isPaid`. El estado de cobro procede exclusivamente de los datos persistidos en el documento.
  - `src/components/Cobranza/useMoveInvoice.ts`:
    - Incorporada protección contra dobles clics con bloqueo concurrente en memoria (`movingInvoices`).
    - Verificación del estado previo persistido en Firestore dentro de la transacción (`runTransaction`) para evitar movimientos redundantes.
    - Generación de identificadores deterministas en `PATHS.expenses` (`ingreso_cobro_${orderId}_${invoiceId}` y `reverso_cobro_${orderId}_${invoiceId}`) con `merge: true` para garantizar idempotencia y evitar ingresos duplicados en Caja Chica.
  - `src/components/Cobranza/useCobranzaActions.ts`:
    - En `fastCollectContrareciboBlock`, `collectContrareciboBlock` y `revertCollectedContrareciboBlock`, uso de IDs deterministas en `PATHS.expenses` (`ingreso_cr_${cleanCr}` y `reverso_cr_${cleanCr}`) con metadata completa (`contrareciboNumber`, `transferRef`, `source`).
  - `src/lib/__tests__/phase3CobranzaFlow.test.ts`:
    - Nueva suite unitaria con 7 pruebas que valida: clasificación canónica por columnas, ausencia de listas estáticas, consistencia numérica de KPIs e idempotencia de claves de gasto.

---

## 2. Verificaciones Ejecutadas en Fase 3

1. **TypeScript Typecheck:**
   - Comando: `npx tsc --noEmit`
   - Resultado: **0 errores**.
2. **Pruebas Unitarias de Fase 3:**
   - Comando: `npx vitest run src/lib/__tests__/phase3CobranzaFlow.test.ts`
   - Resultado: **7/7 pruebas pasadas**.
3. **Pruebas Unitarias de Conciliación Matemática y Fase 2:**
   - Comando: `npx vitest run src/lib/__tests__/datasetReconciliation.test.ts src/lib/__tests__/phase2DataSecurityAndRules.test.ts`
   - Resultado: **10/10 pruebas pasadas**.
4. **Suite Completa del Repositorio:**
   - Comando: `npx vitest run`
   - Resultado: **329/329 pruebas pasadas** (47 suites pasadas, 1 skipped, 0 fallos).
5. **Compilación de Producción:**
   - Comando: `npm run build`
   - Resultado: **Exitoso (código 0)** tanto en Vite frontend como en Cloud Functions.

---

## 3. Criterios de Aceptación para Fase 4 (Portal del Proveedor y Funcionamiento Sin Conexión)

1. **Portal del Proveedor (Maquilador / Andrés):**
   - Auditar `src/pages/MaquiladorPortal/` y Cloud Functions (`getActiveMaquilaOrders`, `reportMaquilaProduction`).
   - Sincronización bidireccional de producción, entregas y saldos sin riesgo de sobreescritura accidental.
2. **Funcionamiento Sin Conexión (Offline / IndexedDB):**
   - Asegurar que la persistencia offline no genere escrituras corruptas ni intente reintentar transacciones no idempotentes al recuperar conexión.
   - Diagnosticar service worker y caché PWA.

---

## 4. Instrucciones para Retomar

1. Mantenerse en rama `main`.
2. Commit de Fase 3 listo para registrarse.
3. No comenzar la Fase 4 hasta contar con la confirmación expresa del usuario.
