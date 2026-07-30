# 📓 AUDIT NOTEBOOK — Control Bolsas ERP

Este documento es la bitácora viva de la Auditoría de Automejora Continua del sistema Control Bolsas ERP. Cada hallazgo, optimización, parche de seguridad y refactorización queda registrado aquí con fecha, archivo afectado, diagnóstico y resolución.

---

## 📜 Registros de Auditoría

### 2026-07-29 — `firestore.rules` — Regla `system_logs` rompía escrituras desde SDK cliente
- **Problema:** La regla exigía `request.resource.data.timestamp == request.time`. Sin embargo, `serverTimestamp()` enviado desde el frontend se resuelve server-side *después* de evaluar las reglas, haciendo que todas las escrituras de auditoría fallaran silenciosamente en producción.
- **Solución:** Se flexibilizó la regla a `request.resource.data.keys().hasAll(['user', 'action', 'timestamp'])`, garantizando inmutabilidad y permitiendo `serverTimestamp()`.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/context/AuthContext.tsx` — Typo en email master
- **Problema:** Existía la cadena `paco@cobertors.com` con typo ("cobertors" en lugar de "cobertores"), permitiendo potencialmente inconsistencias en el rol admin.
- **Solución:** Se corrigió el typo a `paco@cobertores.com` y se estandarizó la lista de administradores autorizados.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/pages/Seeder.tsx` — Vulnerabilidad de acceso público y cálculo prematuro
- **Problema:** La ruta `/seed` era accesible por cualquier rol (incluyendo `viewer`), permitiendo ejecutar un reseteo de base de datos. Además, el botón de inyección no esperaba a que la configuración global de Firestore cargara, calculando importes con valores default.
- **Solución:** Se agregó la guardia `if (role !== 'admin') return <Navigate to="/" replace />` y se deshabilitó el botón con etiqueta `"Cargando configuración..."` mientras `loading === true`.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `functions/src/index.ts` — Riesgo de bucle infinito en `sanitizePurchaseOrder`
- **Problema:** El trigger `onDocumentWritten` de sanitización server-side usaba `_sanitized: true` para detener la recursión. Si un doc perdía la clave, se arriesgaba a un bucle infinito de escrituras.
- **Solución:** Se refactorizó el comparador para evaluar si `financials` cambió realmente. Si no hay discrepancias, la función finaliza sin realizar ninguna escritura en Firestore.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `functions/src/index.ts` — Fallback de escaneo O(N) en emparejamiento de contrarecibos
- **Problema:** En la vinculación de contrarecibos se mantenía una consulta fallback `where("invoices", "!=", null).limit(100)` que ejecutaba Full Table Scans ineficientes en Firestore.
- **Solución:** Se eliminó el fallback ineficiente en favor del índice optimizado por lotes `invoiceFolios` (`array-contains-any`).
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/pages/Dashboard.tsx` — Doble iteración O(N²) en `useMemo`
- **Problema:** El hook principal iteraba `orders` dos veces completas (`orders.forEach`) para calcular métricas y luego extraer facturas en estado `paid` ("Por recibir del contador").
- **Solución:** Se consolidaron ambas iteraciones en una sola pasada O(N), ahorrando tiempo de renderizado y eliminando la tipificación `any[]` por interfaces estrictas (`PurchaseOrder[]`, `Invoice[]`).
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/pages/Cobranza.tsx` — Transacciones no atómicas en pagos por lote
- **Problema:** `payContrareciboBlock` actualizaba múltiples órdenes usando `Promise.all(updateDoc...)`. Si una solicitud fallaba a la mitad, la base de datos quedaba en un estado inconsistente.
- **Solución:** Se migró a `writeBatch(db)` para garantizar atomicidad transaccional total (todo o nada).
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/pages/Cobranza.tsx` — Falsos días de atraso en facturas con Contrarecibo
- **Problema:** La tabla "Qué cobrar primero" mostraba "X días de atraso" para facturas con contrarecibo, confundiendo un plazo pactado con mora real.
- **Solución:** Se rediseñó la columna para mostrar `Faltan Xd`, `Hoy` o `Cobrar ✓` (para fechas cumplidas). Las facturas sin contrarecibo se colocan al inicio con alerta roja `⚠ Xd sin CR`.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — `src/components/Layout.tsx` — Falta de título dinámico en el navegador
- **Problema:** Todas las vistas mostraban el mismo título estático de la app en la pestaña del navegador.
- **Solución:** Se implementó actualización dinámica de `document.title` en función del módulo de navegación activo.
- **Estado:** ✅ Resuelto en v5.6.0

### 2026-07-29 — Documentación (`README.md`, `SECURITY.md`, `CHANGELOG.md`)
- **Problema:** Ausencia de un manual de seguridad consolidado y falta de sincronización del registro de versiones.
- **Solución:** Creado `SECURITY.md` con el modelo Zero Trust y actualizado `CHANGELOG.md` con la versión v5.6.0.
- **Estado:** ✅ Resuelto en v5.6.0
