# 🤖 GEMINI — CONTEXTO MAESTRO DEL SISTEMA (ERP CONTROL BOLSAS)

**Sistema:** ERP Control Bolsas — Grupo Textil Providencia  
**Versión:** v7.8.0 Enterprise Master Edition  
**Fecha:** Agosto 2026  
**URL de Producción:** <https://control-de-bolsas-69.web.app>  
**Firebase Project:** control-de-bolsas-69  
**Hosting Domain:** control-de-bolsas-69.web.app  

---

## 🏗️ Arquitectura del Sistema

```text
ERP Control Bolsas (v7.8.0 Enterprise Master Edition)
├── Frontend: React 18.3 + TypeScript + Vite 5 + Vanilla CSS + PWA
│   └── src/
│       ├── components/ (Modales, Tablas, Layout, ErrorBoundaries)
│       ├── context/    (Auth, Orders, Invoices, Purchases, Expenses, Toast, Undo)
│       ├── hooks/      (Presence, Stats, Maquila, SystemSettings)
│       ├── lib/        (Finance, Math, Parsers CFDI/XML, Sounds, Export)
│       └── pages/      (Dashboard, Orders, Compras, CajaChica, Cobranza, OcTracking, etc.)
├── Backend: Firebase Cloud Functions v2 (Node.js 22 / TypeScript)
│   └── functions/src/
│       ├── index.ts        (parseUploadedPDF, checkOverdueInvoices, sanitizePurchaseOrder, backups)
│       ├── stats.ts        (syncDashboardStats, recalcDashboardStats, extractStats)
│       └── ai/extractor.ts (parseDocumentData con Gemini 2.5 Flash)
├── DB: Cloud Firestore (purchaseOrders, invoices, purchases, expenses, products, config, system_logs)
├── Storage: Firebase Storage (uploads/, identidad/)
├── Auth: Firebase Authentication (Email/Password + Email Verified + Roles: admin, manager, viewer)
└── Backup: Snapshots diarios a medianoche + Exportación HTML/Excel Offline
```

---

## 📱 Módulos y Pantallas del Sistema

| Ruta | Componente / Archivo | Funcionalidad Principal |
| :--- | :--- | :--- |
| `/` | `src/pages/Dashboard.tsx` | KPIs ejecutivos, semáforo de facturas, flujo neto, gráficos de venta/cobranza. |
| `/ordenes` | `src/pages/Orders.tsx` | Listado y administración de expedientes, entregas, facturas y contrarecibos. |
| `/cobranza` | `src/components/Cobranza.tsx` | Gestión de cuentas por cobrar, seguimiento de contrarecibos y estados de cobro. |
| `/caja-chica` | `src/pages/CajaChica.tsx` | Control de ingresos/egresos en efectivo, balance en tiempo real y arqueo de caja. |
| `/compras` | `src/pages/Compras.tsx` | Registro de compras a fabricantes (Andrés), kilos recibidos vs pedidos y liquidaciones. |
| `/centro-control`| `src/pages/ControlCenter.tsx` | Monitoreo del sistema, configuración financiera, reparaciones y utilidades admin. |
| `/oc` | `src/pages/OcTracking.tsx` | Seguimiento visual de órdenes de compra, avance de entregas y estatus global. |
| `/catalogo` | `src/pages/Catalog.tsx` | Catálogo maestro de productos, precios sugeridos y consumo recurrente. |
| `/captura-rapida`| `src/pages/FastEntry.tsx` | Alta acelerada de pedidos y facturas mediante pegado de texto o escaneo OCR. |
| `/audit` | `src/pages/AuditSync.tsx` | Auditoría de integridad contable y reconciliación de bases de datos. |
| `/mining` | `src/pages/DataMining.tsx` | Análisis profundo de datos históricos, patrones de compra y tendencias. |
| `/usuarios` | `src/pages/Users.tsx` | Administración de usuarios, asignación de roles y control de accesos. |
| `/portal-maquilador`| `src/pages/MaquiladorPortal.tsx` | Portal externo protegido por PIN para reporte de entregas y estado de cuenta. |

---

## 🗂️ Colecciones Principales de Firestore

| Colección | Propósito |
| :--- | :--- |
| `purchaseOrders/{id}` | Expedientes maestros de clientes (pedidos, artículos `items[]`, entregas `deliveries[]`, facturas `invoices[]`). |
| `invoices/{id}` | Colección espejo de facturas individuales para consultas indexadas ultra-rápidas. |
| `purchases/{id}` | Deuda y compras a maquiladores/fabricantes (`expectedKilos`, `receivedKilos`, `paidAmount`). |
| `expenses/{id}` | Movimientos de Caja Chica (ingresos por cobro de facturas y egresos operativos). |
| `products/{id}` | Catálogo de productos, claves del SAT y precios base. |
| `config/financials` | Parámetros financieros globales (precio venta, costo compra, comisión, días de crédito). |
| `system_settings/global` | Parámetros públicos de la aplicación (balance de caja chica, avisos). |
| `system_settings_private/maquila` | Configuración confidencial del portal maquilador (PIN de acceso servidor). |
| `system_logs/{id}` | Bitácora append-only inviolable de auditoría y acciones críticas. |
| `snapshots/{id}` | Respaldos JSON completos generados automáticamente a medianoche y bajo demanda. |

---

## 🔑 Reglas de Negocio y Lógica Financiera

1. **Inmutabilidad de Snapshots Financieros:** El costo y comisión de una orden guardada no se alteran al cambiar la configuración global futura.
2. **Regla de Contrarecibo:** Una factura *nunca* se considera vencida (`overdue`) si no cuenta con número de contrarecibo emitido por Providencia.
3. **Fórmula de Flujo Neto:** `Utilidad Líquida = (Total Factura con IVA) - (Kilos * Costo Fabricante) - (Comisión Contabilidad)`.
4. **Precisión Numérica:** Todas las operaciones financieras se redondean y operan con `decimal.js-light` evitando errores IEEE 754.
5. **Autenticación Estricta:** Todo usuario autenticado debe tener `email_verified == true` en Firebase Auth para realizar lecturas o escrituras.

---

## 📌 Guía de Desarrollo para Asistentes de IA

1. **Compilación Obligatoria:** Ejecutar siempre `npm run typecheck` y `npm run lint` antes de dar por terminada una tarea.
2. **Pruebas Unitarias:** Ejecutar `npm run test` para asegurar que las 45 pruebas sigan pasando.
3. **No romper Hooks de React:** Declarar todos los hooks incondicionalmente en la raíz de los componentes.
4. **Seguridad en Storage & Firestore:** Los documentos privados o confidenciales (como PINs o configuraciones secretas) deben residir en colecciones protegidas y las llaves de IA inyectadas vía Google Cloud Secret Manager (`defineSecret`).
