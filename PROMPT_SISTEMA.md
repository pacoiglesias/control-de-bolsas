# 🤖 GEMINI — CONTEXTO MAESTRO DEL SISTEMA (ERP CONTROL BOLSAS)

**Sistema:** ERP Control Bolsas — Grupo Textil Providencia  
**Versión:** v8.6.0 Providencia Financial Core & Official Reconciliation Suite  
**Fecha:** Agosto 2026  
**URL de Producción:** <https://bolsas.cobertores.com> / <https://control-de-bolsas-69.web.app>  
**Firebase Projects:** control-de-bolsas-89c88 / control-de-bolsas-69  
**Hosting Domains:** bolsas.cobertores.com & control-de-bolsas-69.web.app  

---

## 🏗️ Arquitectura del Sistema

```text
ERP Control Bolsas (v8.6.0 Providencia Financial Core & Official Reconciliation Suite)
├── Frontend: React 18.3 + TypeScript + Vite 5 + Vanilla CSS + Framer Motion + PWA
│   └── src/
│       ├── components/ (Modales, Tablas, Layout, Dashboard, Cobranza, ErrorBoundaries)
│       ├── context/    (Auth, Orders, Invoices, Purchases, Expenses, Toast, Undo)
│       ├── hooks/      (Presence, Stats, Maquila, SystemSettings, AndresStats)
│       ├── lib/        (Finance, Math, Parsers CFDI/XML, PDF Generators, Export)
│       │   ├── providenciaStatementPdf.ts (Estado de Cuenta Oficial Providencia PDF)
│       │   ├── netProfitReportPdf.ts     (Reporte P&L y Reparto 50/50 PDF)
│       │   └── ...
│       └── pages/      (Dashboard, Orders, Compras, CajaChica, Cobranza, OcTracking, etc.)
├── Backend: Firebase Cloud Functions v2 (Node.js 22 / TypeScript)
│   └── functions/src/
│       ├── index.ts        (parseUploadedPDF, checkOverdueInvoices, sanitizePurchaseOrder, backups)
│       ├── stats.ts        (syncDashboardStats, recalcDashboardStats, extractStats)
│       └── ai/extractor.ts (parseDocumentData con Gemini 2.5 Flash)
├── DB: Cloud Firestore (purchaseOrders, invoices, purchases, expenses, products, config, system_logs)
├── Storage: Firebase Storage (uploads/, identidad/)
├── Auth: Firebase Authentication (Email/Password + Email Verified + Roles: admin, manager, viewer)
└── Backup: Snapshots diarios a medianoche + Exportación JSON/Excel Offline + PDF Suite
```

---

## 📱 Módulos y Pantallas del Sistema

| Ruta | Componente / Archivo | Funcionalidad Principal |
| :--- | :--- | :--- |
| `/` | `src/pages/Dashboard.tsx` | Cockpit Maestro con Live Ticker, Vistas Modulares (Ejecutiva, Cobranza, Maquila, Todo), Pipeline Interactivo, Corte 50/50 y Semáforo. |
| `/ordenes` | `src/pages/Orders.tsx` | Expedientes maestros, Stepper 6 etapas, entregas, facturas, cierre por menos kilos y WhatsApp proactivo. |
| `/cobranza` | `src/pages/Cobranza.tsx` | Gestión de cartera, Estado de Cuenta Espejo, Generador de PDF oficial Providencia y asignación multi-factura de CRs. |
| `/caja-chica` | `src/pages/CajaChica.tsx` | Control de ingresos/egresos en efectivo, balance en tiempo real, corte bancario y registro de traspasos. |
| `/compras` | `src/pages/Compras.tsx` | Deuda con Andrés ($42/kg), amortizaciones por entrega, libro mayor de anticipos y pagos en 1 clic. |
| `/centro-control`| `src/pages/ControlCenter.tsx` | Monitoreo del sistema, parámetros de negocio, respaldos locales/nube y reparaciones de integridad. |
| `/oc` | `src/pages/OcTracking.tsx` | Seguimiento visual de órdenes de compra, avance de entregas y estatus global. |
| `/catalogo` | `src/pages/Catalog.tsx` | Catálogo maestro de productos, claves SAT y precios sugeridos. |
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

1. **Inmutabilidad de Snapshots Financieros:** El costo ($42/kg) y venta ($43/kg) de una orden guardada no se alteran al cambiar la configuración global futura.
2. **Regla de Contrarecibo:** Una factura *nunca* se considera vencida (`overdue`) si no cuenta con número de contrarecibo emitido por Providencia.
3. **Fórmula de Flujo Neto y Reparto:** `Utilidad Líquida = (Subtotal Facturado) - (Kilos * $42 Costo Andrés) - (Subtotal * 0.08 Comisión Contador) - Gastos Operativos`. Reparto 50% Paco / 50% Socio.
4. **Precisión Numérica:** Todas las operaciones financieras se redondean y operan con `decimal.js-light` evitando errores IEEE 754.
5. **Autenticación Estricta:** Todo usuario autenticado debe tener `email_verified == true` en Firebase Auth para realizar lecturas o escrituras.

---

## 📌 Guía de Desarrollo y Verificación

1. **Compilación Obligatoria:** Ejecutar siempre `npm run typecheck` y `npm run build` antes de dar por terminada una tarea.
2. **Pruebas Unitarias:** Ejecutar `npm test` asegurando que las **59 pruebas automatizadas** pasen al 100%.
3. **No romper Hooks de React:** Declarar todos los hooks incondicionalmente en la raíz de los componentes.
4. **Generación PDF Eficiente:** Utilizar carga dinámica `await import('html2pdf.js')` para no penalizar el peso inicial del bundle.

