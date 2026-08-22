# Radiografía del Sistema: Control Bolsas ERP (v8.9.15)

Este documento describe la arquitectura, la base de datos y los flujos del sistema. Está diseñado para que cualquier desarrollador o IA entienda cómo funciona el negocio sin perder avances previos.

## Arquitectura Base
*   **Frontend:** React 18 + Vite + TypeScript. Aplicación web progresiva (PWA) instalable en escritorio y móviles con Service Worker dedicado (`firebase-messaging-sw.js` y `workbox`).
*   **Capacidad Offline & Resiliencia (v8.9.15):** 
    *   `src/lib/offlineMaquilaDb.ts`: Almacenamiento transaccional en IndexedDB (`ControlBolsasOffline`) con reintentos automáticos para el Portal Maquilador en zonas sin cobertura celular.
    *   `src/lib/export.ts`: Respaldo en vivo y exportación a Excel / HTML Standalone.
*   **Backend:** Firebase (Cloud Firestore con transacciones atómicas, Cloud Storage para PDFs/XMLs, Firebase Authentication con RBAC estricto, Firebase Hosting).
*   **Notificaciones PWA (FCM) & Email (SendGrid):** Notificaciones Push en tiempo real vía Firebase Cloud Messaging (`useFCMNotifications.ts`) y recordatorios programados diarios por SendGrid (`@sendgrid/mail`).
*   **Gateway Unificado de Maquila:** `getActiveMaquilaOrders` procesa autenticación por PIN, libro mayor contable y registro de entregas directamente en Firestore (`purchaseOrders/{orderId}.deliveries[]`), con soporte CORS 204 y eliminación de bloqueos HTTP 403.
*   **Administración Local:** Scripts automatizados `1_INICIAR_EN_ESTA_PC.bat` y `RESPALDAR_A_USB.ps1` hacia unidad externa `D:\`.
*   **Cloud Functions (13 Funciones en Node.js 22 / us-east1):** 
    *   `parseUploadedPDF` / `parseDocumentData`: Extracción inteligente multimodal con **Google Gemini 2.0 Flash** para OCs y Facturas PDF/XML.
    *   `getActiveMaquilaOrders` / `registrarEntregaMaquila`: Portal interactivo de proveedores y confirmación de entregas.
    *   `enviarRecordatoriosVencimiento` / `checkOverdueInvoices`: Barridos diarios de cobranza y despacho de correos SendGrid a las 8:00 AM.
    *   `recalcDashboardStats` / `syncDashboardStats`: Reconstrucción determinista de indicadores sin tocar expedientes.
    *   `updateCajaChicaBalance` / `sanitizePurchaseOrder` / `reprocessOrder` / `scheduledMidnightBackup`.

## Modelo de Base de Datos (Firestore)

### Colección: `purchaseOrders` (Ventas / Expedientes)
Representa un requerimiento del cliente. Es el núcleo del sistema.
*   `folio`: String.
*   `totalKilograms`: Número total pedido.
*   `items[]`: Arreglo de artículos detallados extraídos de la OC (Cantidad, Unidad, Descripción, Precio Unitario, Importe).
*   `deliveries[]`: Entregas parciales (Kilos físicos entregados, fecha).
*   `invoices[]`: Facturas generadas. Cada factura tiene:
    *   `kilos`: Kilos que ampara esta factura.
    *   `financials`: Subtotal, Costo, Comisión y Flujo Neto. (El costo de compra y comisión pueden ser ajustados dinámicamente por pedido sin afectar el historial).
    *   `creditCycle`: Estatus de pago (`pending`, `overdue`, `paid`) y fechas de vencimiento.
    *   `collection`: Datos de cobranza (`contrareciboNumber`, `paidAmount`, etc).

### Colección: `products` (Catálogo Inteligente)
* `description`: Nombre del producto.
* `unit`, `defaultPrice`, `lastOrderDate`.
El sistema cuenta con un catálogo predictivo y un semáforo (Verde, Amarillo, Rojo) basado en el historial de compras del producto.

### Colección: `purchases` (Compras a Fabricante)
Representa mercancía que tú le compras a tu proveedor.
*   `expectedKilos` vs `receivedKilos`.
*   `totalAmount` vs `paidAmount`.

### Colección: `expenses` (Caja Chica)
Gastos operativos y flujo en efectivo (Ingresos/Egresos manuales).

## Notas Operativas y Lógica Financiera
1.  **Cálculo de Cobranza:** Se calcula iterando todas las facturas abiertas de todos los expedientes y agrupando la deuda por cliente.
2.  **Lógica Financiera Inmutable:** El IVA cobrado es parte íntegra de la utilidad (ya que los impuestos se manejan fuera del sistema). La fórmula es: `Utilidad Líquida = (Venta Facturada con IVA) - (Kilos * Costo Fabricante) - (Comisión Contabilidad)`.
3.  **Enlace Venta -> Compra:** Al generar o editar un pedido, el sistema automáticamente genera o actualiza el registro espejo de la deuda oficial en la colección `purchases` para Andrés (el proveedor) utilizando el costo dinámico asignado al expediente.
4.  **Enlace Compras -> Caja Chica:** Cuando se realiza un pago (abono o liquidación) a un proveedor en el panel de Compras, el sistema automáticamente genera un registro de egreso en `expenses` para que el saldo de Caja Chica coincida al centavo.

---

# 🤖 PROMPT MAESTRO PARA IA (AUDITORÍA O MEJORAS FUTURAS)

*Copia el siguiente recuadro y pégalo en Gemini / ChatGPT la próxima vez que necesites realizar modificaciones grandes al sistema:*

```text
Actúa como un Arquitecto de Software Experto. Eres el mantenedor del sistema "Control Bolsas ERP".
Se trata de una aplicación React + Vite + TypeScript conectada a Firebase (Firestore, Storage, Functions).
El sistema gestiona la compra, venta y cobranza de bolsas de plástico (polietileno) al mayoreo.

ARQUITECTURA:
1. Las órdenes de compra de los clientes se guardan en la colección 'purchaseOrders'. Tienen un arreglo de facturas (invoices[]), un arreglo de entregas (deliveries[]) y un arreglo de artículos detallados (items[]).
2. Existe una Cloud Function conectada a Gemini 2.0 Flash que procesa los PDFs subidos a Firebase Storage. Es bi-funcional: si subes una Orden de Compra, crea un expediente nuevo con sus artículos. Si subes una Factura, busca el expediente original (vía referencia OC) y anexa la factura.
3. La lógica financiera (comisiones del 6.9%, cálculos de deuda y vencimientos a 30 días) se procesa al vuelo mediante funciones en 'src/lib/finance.ts'.
4. La UX incluye un buscador global por teclado (Ctrl+K), Modo Oscuro (var --theme), y reportes en tiempo real.

REGLAS ESTRICTAS:
- No destruyas la estructura de los expedientes (PurchaseOrders). El costo y comisión a nivel expediente (`customCostPrice`, `customCommissionRate`) sobreescriben la configuración global pero NUNCA el historial pasado (Snapshots).
- Si alteras el esquema de base de datos en TypeScript ('src/lib/types.ts'), debes actualizar la lógica de validación de Zod en 'functions/src/index.ts'.
- Mantén el diseño de la interfaz alineado a los componentes actuales en 'src/components/ui/'.

OBJETIVO: 
[ESCRIBE AQUÍ LO QUE QUIERES LOGRAR. EJEMPLO: "Quiero añadir un módulo de Inventario Físico para cruzar las Compras con las Ventas."]
```

# 🔄 PROMPT DE AUTOMEJORA CONTINUA (AUTO-AUDITORÍA)

*Usa este prompt periódicamente para pedirle a la IA que evalúe y limpie el código del sistema:*

```text
Actúa como un Ingeniero de Software Staff experto en React, Firebase y Arquitecturas Cloud.
Tu tarea es realizar una "Auditoría de Automejora Continua" sobre este sistema (Control Bolsas ERP).

PASOS A SEGUIR:
1. Revisa los archivos principales (como src/lib/finance.ts, src/pages/OrderModal.tsx y functions/src/index.ts).
2. Identifica cuellos de botella de rendimiento (renders masivos por pulsación de tecla, loops O(N) ineficientes en `reduce` o dependencias de `useMemo` mal diseñadas).
3. Identifica "Full Table Scans" en Firestore (búsquedas no indexadas u O(N) masivas en las Cloud Functions). Recomienda estrategias de indexación inversa o agregación.
4. Identifica deuda técnica, código muerto o funciones ejecutadas dos veces.
5. Identifica vulnerabilidades de seguridad y DESAJUSTES en las Reglas de Firestore y Storage (ej. ¿Se activó una funcionalidad en Cloud Functions que las Storage Rules bloquean en el cliente?). Asegúrate de que `email_verified == true` esté presente.
6. NO implementes nuevas funcionalidades. Tu único objetivo es optimizar, limpiar, refactorizar y proponer mejoras de estabilidad.
7. Entrégame un Plan de Refactorización antes de tocar el código.
```
