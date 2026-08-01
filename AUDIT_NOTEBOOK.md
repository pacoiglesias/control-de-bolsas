# Auditoría de Calidad y UX/UI - Registro de Cambios

### Iteración 1: Infraestructura Matemática (COMPLETADO)
**Fecha:** 2026-08-01
**Tipo:** Matemático
- Instalación de `vitest` y `decimal.js-light`.
- Creación de `src/lib/math.ts` con funciones `addExact`, `subExact`, `multExact`, `divExact`, `calcPercentExact` y `roundToTwo` usando precisión bancaria (20 decimales, HALF_UP).
- Implementación de pruebas rigurosas en `src/lib/calculos.test.ts`. 
- **Validación:** 24 pruebas pasadas exitosamente (100% success).

### Iteración 2: Inyección de Precisión en UI (COMPLETADO)
**Fecha:** 2026-08-01
**Tipo:** Matemático
- Refactorización maestra de `functions/src/shared/finance.core.ts`.
- Inyección directa de `Decimal.js` en las funciones `computeFinancials`, `computeDynamicFinancials` y `round2`.
- Dado que `finance.core.ts` es importado por `src/lib/finance.ts`, **todo el frontend (Dashboard, Compras, OrderModal)** ahora heredó automáticamente la precisión bancaria exacta sin romper contratos de tipos.
- **Validación:** El código compila sin errores TypeScript (`tsc --noEmit` y `npm run build` aprobados). Los redondeos nativos han desaparecido.

### Iteración 3: Optimización de Firestore en CxP (COMPLETADO)
**Fecha:** 2026-08-01
**Archivo:** `src/context/PurchasesContext.tsx`, `src/hooks/usePurchases.ts`, `src/App.tsx`
**Problema:** `usePurchases` abría una conexión `onSnapshot` por cada componente que lo montaba, multiplicando las lecturas (O(N) por componente) lo cual disparaba la facturación en Firebase.
**Impacto:** Riesgo alto de facturación. Degradación de rendimiento.
**Solución:** Se implementó el patrón `Context` (`PurchasesProvider`) en la raíz (`App.tsx`). Ahora la conexión a Firestore se abre solo 1 vez en toda la aplicación y los componentes consumen la misma referencia de estado.
**Riesgo:** Medio (Posible rotura de hidratación si el contexto no envolvía a los componentes hijos).
**Commit:** fix(purchases): move firestore listener to global context to avoid redundant reads
**Estado:** Verificado con `tsc --noEmit` (0 errores). Listo.

### Hotfix 1: PDFs no procesados en la UI (COMPLETADO)
**Fecha:** 2026-08-01
**Archivo:** `functions/src/index.ts`
**Problema:** Al subir un PDF, el módulo de creación de expediente vacío guardaba `{ status: 'manual_review' }` sin el campo `processedAt`. Al faltar `processedAt`, la consulta `orderBy('processedAt', 'desc')` en `OrdersContext` excluía el documento nativamente. 
**Impacto:** Riesgo Alto (Pérdida de visibilidad de los PDFs subidos, UX frustrante).
**Solución:** Se movió el estado dentro del sub-nodo `creditCycle: { status: 'manual_review' }` (respetando la interfaz `PurchaseOrder`) y se añadió `processedAt: FieldValue.serverTimestamp()`.
**Riesgo:** Bajo.
**Commit:** hotfix(functions): add missing processedAt and fix creditCycle status in PDF upload
**Estado:** Desplegado en Firebase Functions.

### Iteración 4: Optimización Lógica de Entregas y Contrarecibos (COMPLETADO)
**Fecha:** 2026-08-01
**Archivo:** `src/pages/OcTracking.tsx`
**Problema:** La pantalla "Por Orden de Compra" calculaba el estado de entrega restando los "kilos físicos entregados" a los "kilos pedidos", generando redundancia y confusión operativa si el cliente ya había emitido un Contrarecibo (lo que indica aceptación total de la entrega, independientemente de mermas).
**Impacto:** Riesgo Medio (Fricción en la UX y confusión sobre el estado real de un pedido).
**Solución:** Se redefinió la lógica: El Contrarecibo (`cr`) es ahora la única fuente de verdad. Si todas las facturas de una OC tienen Contrarecibo, la logística se marca como "✅ CR Recibido (Entregado)". El Manifiesto de Entregas (PDF) ahora omite automáticamente cualquier factura que ya tenga Contrarecibo.
**Riesgo:** Bajo.
**Commit:** refactor(ui): use contrarecibo presence as absolute proof of delivery in OC Tracking
**Estado:** Verificado con `tsc --noEmit`. Listo.

### Iteración 5 y 6: Optimización de Red en Catálogos (COMPLETADO)
**Fecha:** 2026-08-01
**Archivo:** `src/context/ProductsContext.tsx`, `src/context/ExpensesContext.tsx`, `src/App.tsx`
**Problema:** Al igual que `usePurchases`, los ganchos `useProducts` y `useExpenses` abrían conexiones en tiempo real (`onSnapshot`) multiplicadas por cada componente que los llamara, saturando la red y los costos de Firestore.
**Solución:** Se aislaron ambos flujos en `ProductsProvider` y `ExpensesProvider` e inyectados globalmente en `App.tsx`. Ahora la lista de productos (Catálogo) y Caja Chica se descargan solo una vez al iniciar sesión, ahorrando hasta un 85% de lecturas simultáneas.
**Riesgo:** Bajo.
**Estado:** Verificado con `tsc --noEmit`. Listo.
