# Cierre v9.10.30 - Registro de Fases

> Ultima actualizacion: 2026-10-09 18:39 CST
> Rama: main | HEAD: 8f37a94

---

## Estado Actual

Fase activa: FASE 3 COMPLETADA | En transito a FASE 4

---

## FASE 1 - Dependencias y CI - COMPLETADA

Commit: 9215bfd
- package.json: @firebase/rules-unit-testing bajado de ^6.0.0 a ^4.0.1
- npm ci, tsc, vitest: OK | build: OK (1788 modulos, PWA)

---

## FASE 2 - Calculos Financieros y Precios - COMPLETADA

Commit: 8f37a94

Hallazgos y correcciones:
1. OK - DEFAULT_CONFIG: salePricePerKg=43.00, costPricePerKg=38.00, commissionRate=0.08 (8%), commissionBase='subtotal'
2. OK - computeCommissionFromInvoiceTotal: divide invoiceTotal/1.16 para obtener subtotal, luego * 0.08. Correcto.
3. OK - computeFinancials: commission = saleTotal * commissionRate (base=subtotal). Correcto.
4. FIX - useAndresStats.ts: saldoProveedor ahora usa deudaHistorica del config en lugar de 103411.84 hardcodeado. useMemo ahora tiene [deudaHistorica] como dependencia.
5. FIX - executiveOnePagerPdf.ts: fallback de precio cambiado de ??0 a ??DEFAULT_CONFIG.salePricePerKg (43.00). Evita PDFs con total $0.
6. REVISAR (no critico) - useInvoiceParser.ts: salePrice/costPrice usan ??0 solo como ultimo fallback de OCR; el parser falla gracefully en ese caso, no produce datos inventados.
7. OK - FloatingKiloCalculator.tsx: estado inicial ??0 se sincroniza via useEffect con config real; solo transitorio visual.

Convencion historicalDebtAndres confirmada:
- Positivo: saldo a FAVOR de Andres (anticipos que le hemos dado, disponibles para maquila).
- Negativo: deuda que la empresa tiene CON Andres.
- Sanitizacion: valores > 500000 o cercanos a 1227839.35 se descartan y se sustituye por 103411.84.

Tests ejecutados: auditEngine.test.ts + auditEngineMore.test.ts -> 8/8 pasados | tsc: 0 errores.

---

## FASE 3 - Paneles y Flujo de Negocio - COMPLETADA

Objetivo: Verificación y auditoría de flujo completo en código y arquitectura:
1. **Dashboard & KPIs**:
   - `useDashboardStatsV2.ts`: `inventarioVivo`, `kilosPendientesFacturar`, `deudaAndres` calculados con fórmulas canónicas sincronizadas.
   - `DashboardBasculaView.tsx`: Mapeo exacto de OCs activas GT (`12026439784` - 5,100 kg) y TH (`120267114302` - 8,000 kg). Pedidos, entregados y faltantes en vivo.
2. **Portal Maquilador & Cloud Function**:
   - `functions/src/handlers/maquilaPortal.ts` (`getActiveMaquilaOrders` con `action === 'ledger'`): Lee `costPricePerKg` e `historicalDebtAndres` directamente de `config/financials`.
   - Utiliza `computeAndresBalance` de forma compartida con el frontend.
   - Manejo de amortizaciones (`cargo` por kilos recibidos) y anticipos (`abono` por pagos/egresos de caja).
3. **Pagar Andrés Modal (`PagarAndresModal.tsx`)**:
   - Conectado a `useAndresStats('Andres')` y `useConfig()`.
   - Registra movimientos en `expenses` con `type: 'egreso'` y `provider: 'Andrés'`, descontando de Caja Chica y recalculando en vivo el saldo de proveedor.
4. **Ciclo de Crédito y Contrarecibos (`useMoveInvoice.ts`)**:
   - Transiciones del tablero Kanban (`colRevision` -> `colPorCobrar` -> `colContador` -> `colCaja`).
   - Sincronización estricta de comisión del 8% sobre subtotal (`computeCommissionFromInvoiceTotal(invTotal, config)`).
   - Generación automática de ingresos/egresos en caja al mover facturas a/desde `colCaja`.

Pruebas ejecutadas:
- `npx tsc --noEmit` -> 0 errores.
- `npx vitest run` -> 319 pruebas unitarias pasadas (45 test files passed, 0 failures).
- `npm run build` -> Éxito total: Vite (1788 módulos), PWA Service Worker + precache generado, Cloud Functions tsc exitoso.

---

## FASE 4 - Permisos y Offline - PENDIENTE

Archivos a revisar:
- firestore.rules (seguridad, validación de roles y accesos sin auth requeridos por el portal)
- src/hooks/useAuth.ts / context de autenticación
- Service worker / IndexedDB offline (`offlineMaquilaDb.ts`) y sincronización tras reconexión

---

## FASE 5 - Validacion Final y Deploy - PENDIENTE

Prerequisito: Fases 1-4 completas y sin bloqueos criticos.
Comando: firebase deploy --only hosting
NO DESPLEGAR antes de completar fases 3 y 4.

---

## Historial de Commits

8f37a94 | fix(finance): historicalDebtAndres del config en useAndresStats y blindar precio PDF
1c877eb | docs: registro de fases CIERRE_V9_10_30.md
9215bfd | fix(deps): ajustar @firebase/rules-unit-testing a ^4.0.1
a0162f2 | docs: CHANGELOG.md v9.10.30
2fe41bf | feat(v9.10.30): eliminacion de fallbacks estaticos, blindaje precios

---

## Fallos / Bloqueos Conocidos

Ninguno activo.

---

## Proximo Paso al Retomar (FASE 4)

1. Leer este archivo
2. Iniciar FASE 4: Permisos y Offline
   a. Auditar firestore.rules para perfiles admin, operador y acceso público/anónimo del Portal Maquilador
   b. Verificar useAuth.ts y propagación de estado
   c. Verificar Service Worker y cola offline IndexedDB en MaquiladorPortal
3. Ejecutar pruebas unitarias de reglas si aplican o tsc/vitest
4. Documentar hallazgos en este archivo y hacer commit de la Fase 4
5. NO desplegar hasta completar fase 4 y validar fase 5
