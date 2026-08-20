# Radiografía del Sistema: Control Bolsas ERP (v8.9.4)

Este documento describe la arquitectura, la base de datos y los flujos del sistema. Está diseñado para que cualquier desarrollador o IA entienda cómo funciona el negocio.

## Arquitectura Base
*   **Frontend:** React 18.3 (Vite) + TypeScript. Aplicación web progresiva (PWA) instalable.
*   **Capacidad Offline:** `src/lib/export.ts` genera un respaldo `.html`/`.xlsx` con toda la base de datos para llevar el sistema en USB sin conexión. El Portal Maquilador tiene además su propia cola de sincronización offline (`useNetworkStatus.ts`).
*   **Backend:** Firebase (Firestore, Storage, Authentication, Hosting, Cloud Functions).
*   **Administración Local:** `INSTALAR_BUILD_DEPLOY.bat` orquesta instalación, typecheck, pruebas, lint, build y deploy en el orden correcto (Reglas → Cloud Functions → Hosting).
*   **Cloud Functions (Node.js 22):**
    *   `parseUploadedPDF` / `parseDocumentData`: leen los archivos subidos a Storage, envían el documento a **Google Gemini** y determinan si es una Orden de Compra o una Factura (requieren correo verificado y rol admin/manager).
        * Si es OC: extrae folio, kilos, cliente y detalle de artículos. Crea el expediente en Firestore.
        * Si es Factura: extrae la referencia de la OC, UUID y monto, busca el expediente y anexa la factura validando duplicados.
    *   `checkOverdueInvoices`: tarea programada diaria que marca facturas vencidas (nunca una factura sin contrarecibo).
    *   `registrarEntregaMaquila` / `getActiveMaquilaOrders`: acceso del Portal Maquilador, validado por PIN en el servidor (`validarPinMaquila`, con bloqueo tras 5 intentos fallidos).
    *   `recalcDashboardStats` / `syncDashboardStats`: recalculan los contadores agregados del Dashboard — **nunca borran expedientes** (ver Lecciones al final).

## Modelo de Base de Datos (Firestore)

### Colección: `purchaseOrders` (Ventas / Expedientes)
Representa un requerimiento del cliente. Es el núcleo del sistema.
*   `folio`: String.
*   `totalKilograms`: Número total pedido.
*   `items[]`: Arreglo de artículos detallados extraídos de la OC.
*   `deliveries[]`: Entregas parciales (kilos físicos entregados, fecha).
*   `invoices[]`: Facturas generadas. Cada factura tiene:
    *   `financials`: Subtotal, Costo, Comisión y Flujo Neto (el costo de compra y comisión pueden ajustarse por pedido sin afectar el historial — inmutabilidad de snapshots).
    *   `creditCycle`: Estatus de pago (`pending`, `overdue`, `paid`, `collected`) y fechas de vencimiento.
    *   `collection`: Datos de cobranza (`contrareciboNumber`, `paidAmount`, etc).
*   `invoiceStatuses[]`: arreglo desnormalizado del estatus de cada factura, usado por las consultas de Firestore (no soporta filtrar por subcampos de un arreglo de objetos). **Debe reescribirse junto con `invoices[]` en cada escritura** (usar `camposInvoices()`), o las consultas que dependen de él (detección de vencidas, filtros del Dashboard) quedan desincronizadas en silencio.

### Colección: `products` (Catálogo)
`description`, `unit`, `defaultPrice`, `lastOrderDate`.

### Colección: `purchases` (Compras al maquilador Andrés)
*   `expectedKilos` vs `receivedKilos`, `pricePerKg`.
*   Alimenta `useAndresStats.ts`, la fuente única de verdad del saldo con Andrés (ver Notas Operativas).

### Colección: `expenses` (Caja Chica)
Ingresos/egresos manuales, incluidos los pagos al maquilador (`provider: 'Andres'`).

### Colección: `maquilaDeliveries`
Entregas registradas desde el Portal Maquilador. Solo se escribe vía Cloud Function (`registrarEntregaMaquila`) — el cliente no tiene permiso de escritura directa.

## Notas Operativas y Lógica Financiera
1.  **Cálculo de Cobranza:** se calcula iterando todas las facturas abiertas de todos los expedientes y agrupando la deuda por cliente/departamento (TH/GT).
2.  **Lógica Financiera:** el IVA cobrado es parte de la utilidad interna (los impuestos se manejan fuera del sistema). `Utilidad Líquida = (Venta Facturada con IVA) − (Kilos × Costo Andrés) − (Comisión Contabilidad 8%) − Gastos Operativos`.
3.  **Enlace Venta → Compra:** al generar o editar un pedido, el sistema genera/actualiza el registro espejo de la deuda con Andrés en `purchases`, usando el costo dinámico del expediente.
4.  **Enlace Compras → Caja Chica:** un pago a Andrés en `/compras` genera automáticamente un egreso en `expenses` para que Caja Chica cuadre al centavo.
5.  **Saldo con Andrés — fuente única de verdad:** `useAndresStats.ts` (usado por `/compras`) es la implementación de referencia: `Total Pagado − Costo de Material Recibido + config.historicalDebtAndres`. Cualquier otra pantalla que muestre este número (ej. el Dashboard) **debe leer `config.historicalDebtAndres` del mismo lugar** — una copia local de la configuración que omita ese campo produce un número distinto y equivocado (bug real, corregido en v8.9.4).

---

# 🤖 PROMPT MAESTRO PARA IA (AUDITORÍA O MEJORAS FUTURAS)

*Copia el siguiente recuadro y pégalo en tu asistente de IA la próxima vez que necesites realizar modificaciones grandes al sistema. Para el contexto completo y verificado del sistema, adjunta también `PROMPT_SISTEMA.md`.*

```text
Actúa como un Arquitecto de Software Experto. Eres el mantenedor del sistema "Control Bolsas ERP".
Se trata de una aplicación React + Vite + TypeScript conectada a Firebase (Firestore, Storage, Functions).
El sistema gestiona la compra, venta y cobranza de bolsas de plástico (polietileno) al mayoreo entre
Bolsas Elemental (dueño del sistema), Grupo Textil Providencia (cliente, departamentos TH/GT) y
Andrés (maquilador/proveedor).

ARQUITECTURA:
1. Las órdenes de compra de los clientes se guardan en 'purchaseOrders'. Tienen invoices[], deliveries[]
   e items[]. El arreglo desnormalizado invoiceStatuses[] debe reescribirse junto con invoices[] en cada
   escritura (usa camposInvoices()) o las consultas de vencidas/Dashboard se desincronizan en silencio.
2. Una Cloud Function conectada a Gemini procesa los PDFs/XML subidos a Storage. Es bi-funcional: si es
   una Orden de Compra crea un expediente nuevo; si es una Factura, busca el expediente original y la anexa.
3. La lógica financiera (comisión 8% sobre subtotal, IVA 16%, vencimientos a 30 días) vive en
   'src/lib/finance.ts' (frontend) y 'functions/src/shared/finance.core.ts' (backend, compartida).
4. El saldo con el maquilador Andrés tiene UNA fuente de verdad: 'src/hooks/useAndresStats.ts'. No la
   reimplementes en otro hook o componente.

REGLAS ESTRICTAS:
- No destruyas la estructura de los expedientes (purchaseOrders). El costo y comisión a nivel expediente
  (customCostPrice, customCommissionRate) sobreescriben la configuración global pero NUNCA el historial
  pasado (inmutabilidad de snapshots).
- Nunca borres datos ni archivos sin consentimiento explícito del usuario.
- Ninguna regla de Firestore debe aceptar `request.auth != null` a secas — una sesión anónima es trivial
  de obtener con la configuración pública del proyecto.
- Antes de escribir un cálculo financiero, busca si ya existe un hook/función que lo calcule.

OBJETIVO:
[ESCRIBE AQUÍ LO QUE QUIERES LOGRAR.]
```
