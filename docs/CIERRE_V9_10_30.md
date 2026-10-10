# Cierre v9.10.30 - Registro de Fases

> Ultima actualizacion: 2026-10-09 18:39 CST
> Rama: main | HEAD: 8f37a94

---

## Estado Actual

Fase activa: FASE 2 COMPLETADA | En transito a FASE 3

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

## FASE 3 - Paneles y Flujo de Negocio - PENDIENTE

Objetivo: Recorrer flujo completo en la app web:
- Dashboard principal: KPIs, OCs GT (12026439784) y TH (120267114302), kilos entregados/faltantes
- Portal Maquilador (Andres): estado de cuenta, saldo, entregas
- Recepciones / bascula: registro de entregas
- Facturacion y contrarecibos: flujo CFDI -> CR -> cobranza
- Pagos al proveedor: PagarAndresModal

Metodo: Revision visual en la app + verificacion de datos contra Firestore via codigo.

---

## FASE 4 - Permisos y Offline - PENDIENTE

Archivos a revisar:
- firestore.rules
- src/hooks/useAuth.ts
- Service worker / cache offline

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

## Proximo Paso al Retomar (FASE 3)

1. Leer este archivo
2. Verificar HEAD: git log --oneline -3
3. Abrir https://control-de-bolsas-89c88.web.app/ y verificar:
   a. Dashboard: KPIs correctos, OCs GT y TH con kilos reales
   b. Portal Maquilador: saldo de Andres = historicalDebtAndres del config
   c. Registro de entrega (bascula): flujo de nueva entrega
   d. Facturacion: subir CFDI XML y verificar que vincula a OC correcta
   e. Contrarecibo: flujo CR -> estado "cobranza en proceso"
   f. Pagar Andres: modal, saldo resultante
4. Documentar hallazgos en este archivo
5. NO desplegar hasta completar fase 4
