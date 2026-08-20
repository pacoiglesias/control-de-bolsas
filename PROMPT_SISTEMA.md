# 🤖 CONTEXTO MAESTRO DEL SISTEMA (ERP CONTROL BOLSAS)

**Sistema:** ERP Control Bolsas — Bolsas Elemental Denim / Grupo Textil Providencia
**Versión:** v8.9.4
**Fecha:** 20 de Agosto de 2026
**URL de Producción:** <https://control-de-bolsas-69.web.app> (sitio secundario del mismo proyecto: <https://control-de-bolsas-89c88.web.app>)
**Firebase Project ID:** `control-de-bolsas-89c88` (el sitio de Hosting nombrado `control-de-bolsas-69` y el sitio por defecto `control-de-bolsas-89c88.web.app` sirven el mismo contenido)

Este documento es el contexto que debe pegarse (o adjuntarse) al pedirle a cualquier IA que audite, corrija o extienda el sistema. Está pensado para ser preciso y verificable contra el código real, no aspiracional.

---

## 🏗️ Arquitectura del Sistema

```text
ERP Control Bolsas (v8.9.4)
├── Frontend: React 18.3 + TypeScript + Vite 5 + CSS con variables + Framer Motion + PWA
│   └── src/
│       ├── components/ (Modales, Tablas, Layout, Dashboard, Cobranza, Compras, ui/icons.tsx, ErrorBoundaries)
│       ├── context/    (Auth, Orders, Invoices, Purchases, Expenses, Products, Toast, Undo)
│       ├── hooks/      (useDashboardStatsV2, useAndresStats, usePurchases, useExpenses, useMaquilaDeliveries, useSystemSettings, useNetworkStatus)
│       ├── lib/        (finance.ts, math.ts, format.ts, confirmDialog.tsx, parsers CFDI/XML, generadores PDF, export.ts)
│       └── pages/      (Dashboard, Orders, Compras, CajaChica, Cobranza, OcTracking, Catalog, AuditSync, Users, MaquiladorPortal, Settings, DataMining, Papelera)
├── Backend: Firebase Cloud Functions v2 (Node.js 22 / TypeScript)
│   └── functions/src/
│       ├── index.ts        (parseUploadedPDF, checkOverdueInvoices, sanitizePurchaseOrder, reprocessOrder,
│       │                     getActiveMaquilaOrders, registrarEntregaMaquila, validarPinMaquila, updateCajaChicaBalance,
│       │                     scheduledMidnightBackup)
│       ├── stats.ts        (syncDashboardStats, recalcDashboardStats — NUNCA borra expedientes, solo cuenta)
│       ├── shared/finance.core.ts (normalizarTexto, cálculos financieros compartidos frontend/backend)
│       └── ai/extractor.ts (parseDocumentData con Gemini — requiere email verificado y rol admin/manager)
├── DB: Cloud Firestore (purchaseOrders, invoices, purchases, expenses, products, maquilaDeliveries,
│        config/financials, system_settings/global, system_settings_private/maquila, system_logs, snapshots)
├── Storage: Firebase Storage (uploads/)
├── Auth: Firebase Authentication (Email/Password + email_verified obligatorio + Roles: admin, manager, viewer)
└── Backup: Cloud Function programada a medianoche + exportación JSON/Excel offline + respaldo local con backup.ps1
```

---

## 📱 Módulos y Pantallas del Sistema

| Ruta | Componente / Archivo | Funcionalidad Principal |
| :--- | :--- | :--- |
| `/` | `src/pages/Dashboard.tsx` | Cockpit maestro: KPIs (Efectivo en Caja, Ventas, Dinero en la Calle, Urgencias), Kilos Entregados, filtro TH/GT, Bitácora de Versiones. |
| `/ordenes` | `src/pages/Orders.tsx` + `KanbanBoard.tsx` | Expedientes maestros, Kanban con drag & drop (con confirmación al saltar varios pasos), entregas, facturas, cierre por menos kilos. |
| `/cobranza` | `src/pages/Cobranza.tsx` | Gestión de cartera, Estado de Cuenta, PDF oficial Providencia y asignación multi-factura de Contrarecibos. |
| `/caja-chica` | `src/pages/CajaChica.tsx` | Ingresos/egresos en efectivo, balance en tiempo real, corte bancario. |
| `/compras` | `src/pages/Compras.tsx` (usa `useAndresStats.ts`) | Estado de Cuenta y Libro Mayor con Andrés (deuda de material, anticipos y ajuste histórico configurable). **Fuente única de verdad para el saldo con Andrés** — cualquier otra pantalla que muestre este número debe leer del mismo lugar (`config?.historicalDebtAndres`), ver "Lecciones" abajo. |
| `/centro-control` | `src/pages/Settings.tsx` | Parámetros de negocio (precio venta/costo, comisión, ajuste histórico Andrés), identidad de empresa/cliente/taller, gestión de usuarios y PIN del Portal Maquilador. |
| `/oc` | `src/pages/OcTracking.tsx` | Seguimiento visual de órdenes de compra, avance de entregas. |
| `/catalogo` | `src/pages/Catalog.tsx` | Catálogo de productos, claves SAT, con buscador. |
| `/audit` | `src/pages/AuditSync.tsx` | Auditoría/edición masiva tipo hoja de cálculo — escribe directo a Firestore, requiere rol admin. |
| `/mining` | `src/pages/DataMining.tsx` | Análisis histórico de datos. |
| `/usuarios` | `src/pages/Users.tsx` | Administración de usuarios y roles. |
| `/portal-maquilador` | `src/pages/MaquiladorPortal.tsx` | Portal externo protegido por PIN (con bloqueo tras 5 intentos fallidos) para registrar entregas y consultar estado de cuenta — todo el acceso se valida en el servidor, no requiere sesión de Firebase Auth. |
| `/papelera` | `src/pages/Papelera.tsx` | Expedientes/registros marcados `isDeleted`, restaurables. |

---

## 🗂️ Colecciones Principales de Firestore

| Colección | Propósito |
| :--- | :--- |
| `purchaseOrders/{id}` | Expedientes maestros de clientes (pedidos, `items[]`, `deliveries[]`, `invoices[]`). |
| `invoices/{id}` | Colección espejo de facturas individuales para consultas indexadas. |
| `purchases/{id}` | Compras/entregas del maquilador (`expectedKilos`, `receivedKilos`, `pricePerKg`). |
| `expenses/{id}` | Movimientos de Caja Chica (ingresos y egresos, incluidos pagos a Andrés). |
| `maquilaDeliveries/{id}` | Entregas registradas desde el Portal Maquilador (escritas solo vía Cloud Function, nunca directo desde el cliente). |
| `products/{id}` | Catálogo de productos y precios base. |
| `config/financials` | Parámetros financieros globales, incluido `historicalDebtAndres` (ajuste de deuda histórica con el maquilador). |
| `system_settings/global` | Parámetros públicos de la aplicación. |
| `system_settings_private/maquila` | PIN del Portal Maquilador y contadores de intentos fallidos (`pinFailedAttempts`, `pinLockedUntil`). |
| `system_logs/{id}` | Bitácora append-only de auditoría. |
| `snapshots/{id}` | Respaldos JSON generados a medianoche y bajo demanda. |

---

## 🔑 Reglas de Negocio y Lógica Financiera

1. **Inmutabilidad de Snapshots Financieros:** el costo y precio de venta de una orden guardada no cambian al modificar la configuración global futura (`customCostPrice`/`customCommissionRate` por expediente).
2. **Regla de Contrarecibo:** una factura nunca se considera vencida si no tiene contrarecibo emitido.
3. **Cardinalidad CR:Facturas (1:N):** un Contrarecibo ampara una o varias facturas; una factura pertenece a un solo Contrarecibo.
4. **Separación estricta TH / GT:** un Contrarecibo nunca mezcla facturas de ambos departamentos.
5. **Fórmula de Utilidad:** `Utilidad Líquida = (Subtotal Facturado) − (Kilos × Costo Andrés) − (Subtotal × 8% Comisión Contador) − Gastos Operativos`, repartida 50/50.
6. **Saldo con Andrés:** `Total Pagado − Costo de Material Recibido + Ajuste Histórico Configurado` (`config.historicalDebtAndres`). Ver "Lecciones" abajo — este cálculo debe vivir en un solo lugar.
7. **Precisión Numérica:** cálculos financieros con `decimal.js-light`, sin errores de punto flotante.
8. **Autenticación Estricta:** `email_verified == true` obligatorio para leer o escribir. Ninguna regla de Firestore debe aceptar `request.auth != null` a secas — una sesión anónima (`signInAnonymously()`) es trivial de obtener con la configuración pública del proyecto.

---

## 📌 Guía de Desarrollo y Verificación

1. **Compilación obligatoria:** `npm run typecheck` (raíz) y `cd functions && npx tsc --noEmit` antes de dar por terminada una tarea, más `npm run build`.
2. **Pruebas unitarias:** `npm test` — deben pasar **72/72**.
3. **Lint:** `npm run lint` — 0 errores.
4. **No romper Hooks de React:** todos los hooks se declaran incondicionalmente en la raíz del componente.
5. **PDF eficiente:** carga dinámica `await import('html2pdf.js')`.
6. **Nunca borres nada sin consentimiento explícito** — ni datos de Firestore, ni archivos del proyecto. Mover/archivar es aceptable sin preguntar cuando ya se estableció el patrón; borrar de forma permanente, no.
7. **Después de un cambio real en el sistema:** documenta el hallazgo en `AUDIT_NOTEBOOK.md` (formato: fecha, archivo, problema, impacto, solución, verificación) y en `CHANGELOG.md`; si el usuario lo pide, también en `src/lib/systemChangelog.ts` (la Bitácora de Versiones dentro de la app — **es un archivo aparte, con su propio arreglo `SYSTEM_CHANGELOG`, y no se actualiza sola solo por editar `CHANGELOG.md`**).

## ⚠️ Lecciones de bugs reales ya encontrados en este sistema (no los repitas)

- **Fuentes de verdad duplicadas para el mismo cálculo.** `useDashboardStatsV2.ts` reimplementó su propia copia reducida de la configuración financiera y se le olvidó un campo (`historicalDebtAndres`), causando que el Dashboard mostrara un saldo con Andrés $1.33M distinto al de Compras → Andrés (`useAndresStats.ts`), que sí leía el dato real. **Antes de escribir un cálculo financiero nuevo, busca si ya existe un hook/función que lo calcule** y reutilízalo en vez de copiar la fórmula.
- **Escrituras sin transacción sobre arreglos compartidos** (`invoices[]`, `invoiceStatuses[]`) — mover una tarjeta de Kanban o deshacer una acción sin releer el documento real dentro de una transacción puede pisar cambios concurrentes o desincronizar el campo denormalizado del que dependen las consultas (`checkOverdueInvoices`, filtros del Dashboard).
- **Reglas de Firestore que confían en `request.auth != null` a secas** son vulnerables a sesiones anónimas creadas desde la consola del navegador con la configuración pública del proyecto (no es secreta). Exige rol o valida en el servidor.
- **Funciones "de mantenimiento" con lógica de borrado escondida.** `recalcDashboardStats` tenía, contradiciendo su propio comentario, un bloque que borraba expedientes permanentemente. Cualquier función invocable por un botón del Dashboard debe auditarse línea por línea antes de asumir que "solo recalcula".
