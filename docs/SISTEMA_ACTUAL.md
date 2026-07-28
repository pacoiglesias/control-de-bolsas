# Radiografía del Sistema: Control Bolsas ERP (v6.0)

Este documento describe la arquitectura, la base de datos y los flujos del sistema. Está diseñado para que cualquier desarrollador o IA entienda cómo funciona el negocio.

## Arquitectura Base
*   **Frontend:** React (Vite) + TypeScript. Interfaz modular, con estado global manejado a través de Contextos (AuthContext, ToastContext).
*   **Backend:** Firebase (Firestore para base de datos, Storage para PDFs/XMLs, Authentication para usuarios, Hosting para la web).
*   **Cloud Functions (Node.js):** 
    *   `parseUploadedPDF`: Lee los archivos subidos al Storage, envía el PDF a **Google Gemini 2.0 Flash** y determina si es una Orden de Compra o una Factura. 
        * Si es OC: Extrae folio, kilos, cliente y detalle de artículos. Crea el expediente en Firestore.
        * Si es Factura: Extrae la referencia de la OC, UUID y monto, busca el expediente de esa OC, y anexa la factura validando duplicados.
    *   `checkOverdueInvoices`: Tarea programada (`onSchedule`) que corre todos los días a medianoche para revisar las facturas y marcar las que vencieron como `overdue`.

## Modelo de Base de Datos (Firestore)

### Colección: `purchaseOrders` (Ventas / Expedientes)
Representa un requerimiento del cliente. Es el núcleo del sistema.
*   `folio`: String.
*   `totalKilograms`: Número total pedido.
*   `items[]`: Arreglo de artículos detallados extraídos de la OC (Cantidad, Unidad, Descripción, Precio Unitario, Importe).
*   `deliveries[]`: Entregas parciales (Kilos físicos entregados, fecha).
*   `invoices[]`: Facturas generadas. Cada factura tiene:
    *   `kilos`: Kilos que ampara esta factura.
    *   `financials`: Subtotal, Costo, Comisión y Flujo Neto.
    *   `creditCycle`: Estatus de pago (`pending`, `overdue`, `paid`) y fechas de vencimiento.
    *   `collection`: Datos de cobranza (`contrareciboNumber`, `paidAmount`, etc).

### Colección: `purchases` (Compras a Fabricante)
Representa mercancía que tú le compras a tu proveedor.
*   `expectedKilos` vs `receivedKilos`.
*   `totalAmount` vs `paidAmount`.

### Colección: `expenses` (Caja Chica)
Gastos operativos y flujo en efectivo (Ingresos/Egresos manuales).

## Notas Operativas y Lógica Financiera
1.  **Cálculo de Cobranza:** Se calcula iterando todas las facturas abiertas de todos los expedientes y agrupando la deuda por cliente.
2.  **Regla del Contrarecibo (IMPORTANTE):** El sistema permite que múltiples facturas compartan el mismo número de contrarecibo (`contrareciboNumber`). Sin embargo, **la cobranza y el estatus (`creditCycle.status`) se maneja a nivel de factura individual**. Actualmente no hay una funcionalidad nativa para "Agrupar facturas por Contrarecibo y pagarlas en bloque", cada factura debe marcarse pagada de manera independiente, aunque el sistema no restringe que se use el mismo número como referencia.

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
- No destruyas la estructura de los expedientes (PurchaseOrders).
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
2. Identifica cuellos de botella de rendimiento (renders innecesarios, loops ineficientes).
3. Identifica deuda técnica, código muerto o funciones repetidas.
4. Identifica vulnerabilidades de seguridad en las Reglas de Firestore o Storage.
5. NO implementes nuevas funcionalidades. Tu único objetivo es optimizar, limpiar, refactorizar y proponer mejoras de estabilidad.
6. Entrégame un Plan de Refactorización antes de tocar el código.
```
