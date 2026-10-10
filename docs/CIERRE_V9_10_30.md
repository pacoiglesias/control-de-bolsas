# Cierre v9.10.30 - Registro de Fases

> Ultima actualizacion: 2026-10-09 19:15 CST
> Rama: main | HEAD: 4998143

---

## Estado Actual

Fase activa: FASE 4 COMPLETADA | En transito a FASE 5

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

## FASE 4 - Permisos y Offline - COMPLETADA

Objetivo: Auditoría de seguridad de Firestore, autenticación y resiliencia offline:
1. **Reglas de Seguridad (`firestore.rules`)**:
   - `isAdmin()` / `isSuperAdmin()`: Verifica custom claims (`role: 'admin'`, `admin: true`) con token `email_verified == true`, existencia en `/admins/{uid}`, o correos de arranque institucionales.
   - `/system_settings/global`: Lectura pública permitida para branding inicial (Login) sin exponer credenciales.
   - `/system_settings_private/maquila`: PIN estrictamente aislado, inaccesible a clientes no autorizados; consultado exclusivamente por Cloud Functions mediante Admin SDK.
   - `/maquilaDeliveries` y `/expenses`: Protegidas contra inyección anónima; las entregas de maquila se procesan vía Cloud Function con verificación de PIN.
   - Inmutabilidad estricta y trazabilidad en `/payment_receipts` y `/system_logs`.
2. **Contexto de Autenticación (`AuthContext.tsx`)**:
   - Bloqueo de cuentas sin verificación (`emailVerified == true`), previniendo errores de `permission-denied` masivos en runtime.
   - Auto-aprovisionamiento seguro para correos de propietarios autorizados.
   - Cierre de sesión y log de auditoría en `system_logs`.
3. **Resiliencia Offline y PWA (`offlineMaquilaDb.ts` / `vite.config.ts`)**:
   - Cola offline en `IndexedDB` (`ControlBolsasOffline`) con fallback resiliente a `localStorage` y migración automática transparente.
   - Soporte para reintentos (`retryCount`), estados pendientes y marcas de tiempo.
   - PWA Service Worker (`workbox` v1.3.0) con precache de 72 assets críticos y estrategias `CacheFirst` para fuentes y `StaleWhileRevalidate` para recursos gráficos.

Pruebas ejecutadas:
- `firestoreRulesAndReceiptSecurity.test.ts` -> 10/10 pruebas de seguridad y comprobantes aprobadas.
- `offlineExcelSync.test.ts` + `excelAndMobileResilience.test.ts` -> 9/9 pruebas de sincronización offline aprobadas.
- Suite completa `npx vitest run` -> 319/319 pruebas aprobadas (45 test files passed, 0 failures).
- `npx tsc --noEmit` -> 0 errores.

---

## FASE 5 - Validacion Final y Deploy - PENDIENTE

Prerequisito: Fases 1-4 completas y sin bloqueos críticos.
Acciones de la fase:
1. Validación final en limpio (`npx tsc --noEmit`, `npx vitest run`, `npm run build`).
2. Despliegue oficial de Hosting: `firebase deploy --only hosting`.
3. Verificación de versión y estado en vivo en producción.

---

## Historial de Commits

4998143 | docs: completar auditoria Fase 3 de paneles y flujo de negocio
8f37a94 | fix(finance): historicalDebtAndres del config en useAndresStats y blindar precio PDF
1c877eb | docs: registro de fases CIERRE_V9_10_30.md
9215bfd | fix(deps): ajustar @firebase/rules-unit-testing a ^4.0.1
a0162f2 | docs: CHANGELOG.md v9.10.30
2fe41bf | feat(v9.10.30): eliminacion de fallbacks estaticos, blindaje precios

---

## Fallos / Bloqueos Conocidos

Ninguno activo.

---

## Proximo Paso al Retomar (FASE 5)

1. Leer este archivo
2. Ejecutar validación final pre-deploy: `npm run build`
3. Ejecutar `firebase deploy --only hosting`
4. Confirmar despliegue exitoso en `https://control-de-bolsas-89c88.web.app/`
5. Cerrar registro de release v9.10.30
