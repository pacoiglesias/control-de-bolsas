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
