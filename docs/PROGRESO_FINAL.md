# Control de Bolsas ERP — Progreso y Cierre de Calidad

## 1. Estado de Fases

- **Fase Actual:** **FASE 2 COMPLETADA**
- **Siguiente Fase:** **FASE 3: Estados y flujo de cobranza**
- **Rama:** `main`
- **Commit Previo:** `68241d6`
- **Cambios Realizados en Fase 2:**
  - `src/components/Cobranza/SincronizadorOficialModal.tsx`: Eliminada purga masiva automática y convertida en vista previa de diferencias granular con selección explícita por checkbox y protección ante soft-delete.
  - `src/hooks/useAndresStats.ts`: Eliminado `safeSetDoc` automático para evitar sobreescrituras al abrir la pantalla; preservado el signo y montos válidos en `historicalDebtAndres`.
  - `src/hooks/useDashboardStatsV2.ts`: Eliminada sustitución arbitraria a `103411.84` ante montos superiores a 500k.
  - `functions/src/handlers/maquilaPortal.ts`: Respetado el signo negativo (deuda con Andrés) y montos legítimos en la Cloud Function.
  - `src/lib/__tests__/phase2DataSecurityAndRules.test.ts`: Nueva suite unitaria para verificar las reglas y protecciones implementadas.

---

## 2. Verificaciones Ejecutadas en Fase 2

1. **TypeScript Typecheck:**
   - Comando: `npx tsc --noEmit`
   - Resultado: **0 errores**.
2. **Pruebas Unitarias de Fase 2:**
   - Comando: `npx vitest run src/lib/__tests__/phase2DataSecurityAndRules.test.ts`
   - Resultado: **3/3 pruebas pasadas**.
3. **Pruebas Unitarias de Conciliación Matemática:**
   - Comando: `npx vitest run src/lib/__tests__/datasetReconciliation.test.ts`
   - Resultado: **7/7 pruebas pasadas**.
4. **Suite Completa de Pruebas:**
   - Comando: `npx vitest run`
   - Resultado: **322/322 pruebas pasadas** (46 archivos pasados, 0 fallos).

---

## 3. Criterios de Aceptación para Fase 3 (Estados y Flujo de Cobranza)

1. **Modelo de Estados Unificado:**
   - Ciclo formal: `revision` (en revisión sin contrarrecibo) -> `pending` (por cobrar con contrarrecibo) -> `paid` (con el contador) -> `collected` (liquidado en caja).
   - Eliminar cualquier lista estática de folios codificados que marque facturas como pagadas; el estado debe proceder del campo persistido en Firestore.
2. **Consistencia y Fuente de Verdad:**
   - Todas las vistas, contadores de badges, columnas del Kanban, filtros y reportes deben consumir la misma fuente autoritativa de estados.
   - Idempotencia en movimientos de cobranza para evitar que dobles clics o concurrencia generen movimientos duplicados en Caja Chica.
3. **Trazabilidad:**
   - Registrar auditoría con usuario, sello de tiempo, estado previo y nuevo estado en cada transición.

---

## 4. Instrucciones para Retomar

1. Comprobar que el commit de partida de Fase 3 sea el de cierre de Fase 2.
2. Iniciar **FASE 3** auditando `src/components/Cobranza/useMoveInvoice.ts`, `src/components/Cobranza/TableroKanban.tsx` y `src/hooks/useOrders.ts`.
3. Validar consistencia de estados y ejecutar pruebas de cobranza y ciclo de crédito.
4. Generar commit de Fase 3 y actualizar este documento.
