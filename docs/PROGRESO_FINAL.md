# Control de Bolsas ERP — Progreso y Cierre de Calidad

## 1. Estado de Fases

- **Fase Actual:** **FASE 1 COMPLETADA**
- **Siguiente Fase:** **FASE 2: Seguridad de datos y reglas financieras**
- **Rama:** `main`
- **Commit Inicial de Partida:** `65c69d8`
- **Cambios Locales Iniciales:** Ninguno (`working tree clean`).

---

## 2. Diagnóstico de la Línea Base (Fase 1)

### Arquitectura y Fuentes de Verdad
- **Frontend:** React 18 + Vite + TypeScript (SPA/PWA) en `src/`.
- **Backend Serverless:** Firebase Cloud Functions v2 (Node.js 22, Express/HTTPS onCall) en `functions/src/`.
- **Base de Datos:** Cloud Firestore (`control-de-bolsas-89c88`).
  - Colección canónica de expedientes: `purchaseOrders`.
  - Colección espejo de facturas: `invoices`.
  - Gastos y pagos de caja: `expenses`.
  - Entregas de maquila: `purchases` / `maquilaDeliveries`.
  - Configuración financiera: `config/financials`.
- **Portal del Maquilador:** `src/pages/MaquiladorPortal.tsx` conectado a Cloud Function `getActiveMaquilaOrders` autenticada por PIN y cola offline local en IndexedDB (`offlineMaquilaDb.ts`).

### Riesgos Críticos Detectados para Fase 2 en Adelante

1. **Purga y Recreación Masiva en Sincronizador de Contrarrecibos:**
   - En `src/components/Cobranza/SincronizadorOficialModal.tsx`, la opción `purgeOldOrders` inicia en `true` por defecto. Si se ejecuta, archiva (`isDeleted: true`) expedientes no presentes en un array estático codificado.
   - Sincroniza y recrea documentos sin una vista previa granular que muestre por separado cada expediente afectado (OC, folio, CR, importes) y sin confirmación selectiva por expediente.
   - No respeta marcas de eliminación manual previa.

2. **Sobreescritura Automática y Manipulación de Saldos de Andrés (`historicalDebtAndres`):**
   - En `src/hooks/useAndresStats.ts` (líneas 29-33): Un `useEffect` detecta si `historicalDebtAndres > 500000` y ejecuta un `safeSetDoc` silencioso sobreescribiendo Firestore con `103411.84`.
   - En `src/hooks/useDashboardStatsV2.ts` (línea 229): Si el saldo configurado supera 500,000, silenciosamente se fuerza a `103411.84` en la visualización.
   - En `functions/src/handlers/maquilaPortal.ts` (línea 201): La Cloud Function descarta saldos negativos o superiores a 500,000 y sustituye por `103411.84`, invirtiendo el signo si la empresa tiene deuda pendiente con Andrés.

3. **Precios y Fallbacks:**
   - Hay componentes con fallbacks estáticos que ocultan inconsistencias en vez de advertir la falta de captura de precio o costo real del lote.

---

## 3. Verificaciones Ejecutadas en Fase 1

- `git status` -> `clean` (sin cambios no guardados).
- `git log -n 5 --oneline` -> HEAD en `65c69d8`.
- Inspección estructural de CI/CD en `.github/workflows/ci.yml` y `deploy.yml`.
- Inspección de `AGENTS.md` y reglas operativas de Providencia.
- Localización de riesgos en `SincronizadorOficialModal.tsx`, `useAndresStats.ts`, `useDashboardStatsV2.ts` y `functions/src/handlers/maquilaPortal.ts`.

---

## 4. Criterios de Aceptación para Fase 2

1. **Sincronizador de Contrarrecibos:**
   - Desactivar completamente cualquier purga automática o por defecto basada en listas estáticas.
   - El sincronizador debe funcionar en modo vista previa obligatoria con tabla detallada de diferencias (OC, folio, CR actual vs propuesto, importes).
   - Permitir al operador aceptar o rechazar cambios por expediente.
   - Respetar documentos marcados con eliminación deliberada (`isDeletedManually: true`).
2. **Saldo Histórico de Andrés:**
   - Eliminar el `safeSetDoc` automático en `useAndresStats.ts`. Consultar o abrir pantallas no debe modificar Firestore jamás.
   - Eliminar el aplastamiento de valores en `useDashboardStatsV2.ts` y `functions/src/handlers/maquilaPortal.ts`.
   - Respetar los valores negativos (deuda pendiente de la empresa) y montos altos válidos.
   - Mostrar advertencia visible en auditoría/UI ante valores inusuales en lugar de sobreescribir silenciosamente.
3. **Precios y Cálculos:**
   - Conservar precios de venta y costos de lote reales por entrega y factura.
   - Si falta un precio en un cálculo, mostrar alerta para captura en vez de inventar o fijar valores predeterminados.

---

## 5. Instrucciones para Retomar

1. Comprobar que el commit de partida de Fase 2 sea el de cierre de Fase 1.
2. Iniciar **FASE 2** abordando primero los 3 módulos críticos identificados:
   - `src/components/Cobranza/SincronizadorOficialModal.tsx`
   - `src/hooks/useAndresStats.ts`
   - `src/hooks/useDashboardStatsV2.ts` y `functions/src/handlers/maquilaPortal.ts`
3. Ejecutar pruebas unitarias de finanzas y auditoría (`npx vitest run`).
4. Generar commit de Fase 2 y actualizar este documento.
