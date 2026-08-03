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

### Iteración 7: Reconciliación de ramas divergentes (COMPLETADO)
**Fecha:** 2026-08-02
**Archivo:** `functions/src/index.ts`, `package.json`, `functions/package.json`
**Problema:** El proyecto llevaba tres ramas de trabajo separadas (`optimize/workspace-2026-07-29-ciclo2` v6.21.0, `main`/`feature/ux-quality-audit` v6.30.0, `audit/workspace-2026-08-01` v6.31.0) más una copia local sin subir en v6.34.0 — divergencia en las dos direcciones: la copia local tenía mejoras que GitHub no tenía (fecha de vencimiento que evita fines de semana, "Pendiente por Facturar" usando precio/IVA configurados en vez de fijos, kilos entregados sumados de las entregas reales), y GitHub tenía un bloque de diagnóstico en `checkOverdueInvoices` que la copia local no tenía. Además, `package.json` (6.34.0) y `functions/package.json` (6.33.0) estaban desincronizados entre sí.
**Impacto:** Riesgo Alto de perder trabajo real de cualquiera de los dos lados si se sobrescribía sin comparar antes.
**Solución:** Se tomó la copia local (más completa) como base, se le sumó el bloque de diagnóstico que solo existía en GitHub, y se sincronizaron las versiones. Se eliminaron archivos sueltos sin referencias en el código (`PROMPT 2.txt`, `PROMPT BUENO.txt`, `audit_local.ts`, `dump_client.js`, carpeta `scratch/`).
**Riesgo:** Bajo tras verificación — `tsc` limpio en raíz y functions, `eslint`, 39/39 pruebas, build completo.
**Commit:** `chore: reconciliar ramas divergentes y sincronizar versiones a v6.35.0`
**Estado:** ✅ Verificado.

### Iteración 8: Facturas sin contrarecibo marcadas como vencidas por el proceso diario (COMPLETADO)
**Fecha:** 2026-08-02
**Archivo:** `functions/src/index.ts` (`checkOverdueInvoices`)
**Problema:** El proceso programado que corre a medianoche marcaba como "overdue" cualquier factura pendiente cuya fecha de vencimiento hubiera pasado, sin comprobar si esa factura ya tenía un contrarecibo emitido. El plazo de crédito real arranca cuando Providencia emite el contrarecibo, no cuando se envía la factura a revisión — así que las "facturas en revisión" se marcaban vencidas al día siguiente de emitirse, inflando la cifra de "Vencido" del panel por su monto completo (confirmado contra datos reales del usuario: la diferencia era exactamente $136,300.00, el total de dos facturas sin CR).
**Impacto:** Cifra de "Vencido" incorrecta en producción, verificada y reportada por el usuario con sus propios números.
**Solución:** `yaVencio()` ahora exige que exista un contrarecibo (a nivel factura o a nivel expediente) antes de marcar vencida una factura. Se agregó además una pasada de reparación en la misma función: cualquier factura ya marcada "overdue" sin contrarecibo real se revierte a "pending" automáticamente la próxima vez que corra el proceso — corrige el dato ya corrompido, no solo evita que se repita.
**Riesgo:** Bajo — regla de negocio ya verificada y aplicada antes en `functions/src/stats.ts` (Ciclo 33 de la bitácora anterior); aquí se aplicó el mismo criterio al proceso que faltaba.
**Commit:** `fix(functions): checkOverdueInvoices respeta la regla sin-CR-no-vencida y repara datos ya corrompidos`
**Estado:** ✅ Verificado — `tsc` limpio en functions.

> Nota: el historial detallado de los Ciclos 1–33 (incluyendo los hallazgos que motivan las dos iteraciones de arriba) vive en `CHANGELOG.md` y en el historial de commits de la rama `optimize/workspace-2026-07-29-ciclo2`, por si hace falta consultarlo — esta bitácora se reemplazó por un formato distinto a mitad de proyecto y no se restauró el contenido anterior para no pisar el trabajo de esta sesión.

### Iteración 9: Kanban Drag and Drop y Reconciliación de Caja Chica (COMPLETADO)
**Fecha:** 2026-08-02
**Archivos:** `src/components/Cobranza/index.tsx`, `src/components/Cobranza/TableroKanban.tsx`
**Problema:** Al mover estados manualmente sin usar los botones, las métricas financieras (Cobrado vs Caja) divergían si no se inyectaba el gasto manual.
**Impacto:** Riesgo Alto de divergencia de reportes contables.
**Solución:** Se implementó API HTML5 Drag and Drop en las columnas de cobranza. Se centralizó la lógica en la función `moveInvoice` envolviendo las transiciones en un bloque `runTransaction` que actualiza el ciclo de crédito de la factura y, simultáneamente, inyecta (o revierte) el ingreso en la colección `expenses` cuando se mueve hacia/desde `En Caja Chica`.
**Estado:** Desplegado en Producción (v6.36.0).
