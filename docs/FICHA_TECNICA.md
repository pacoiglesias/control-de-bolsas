# Ficha Técnica y Reporte de Funciones: Control Bolsas ERP (v5.3.0)

Este documento detalla exhaustivamente todas las capacidades funcionales, operativas y técnicas del sistema al día de hoy.

## 1. Módulos Operativos

### 1.1 Módulo de Inteligencia Artificial (Lectura de Documentos)
- **Extracción de Órdenes de Compra (PDF):** La IA (Gemini 2.0 Flash) lee PDFs de órdenes de compra, extrayendo el Folio de la OC, Cliente, Kilos Totales y desglose de artículos.
- **Extracción de Facturas de Venta (PDF):** La IA detecta cuando un documento es una Factura, extrae el Folio de Factura, Contrarecibo (GT/TH), kilos facturados y montos con IVA, enlazándola al expediente correspondiente.
- **Procesamiento de Complementos de Pago (XML):** Lector nativo en la nube que analiza los nodos `pago20:DoctoRelacionado` de CFDIs de pago para conciliar automáticamente.

### 1.2 Módulo de Ventas (Órdenes / Expedientes / Seguimiento OC)
- **Diferenciación de Conceptos:** GT-xxx y TH-xxx son **Números de Contrarecibo (CR)**. Las facturas llevan su propia numeración de **Folio** independiente (ej. #6084, #6054).
- **Vista Seguimiento OC (`/oc`):** Control exclusivo por Orden de Compra para comparar kilos contratados vs. kilos surtidos, indicando remanentes o surtido completo.
- Control multi-entregas: Registro de entregas parciales por fecha y notas de remisión.
- Generación nativa de **Remisiones en PDF** listas para imprimir.

### 1.3 Módulo de Contrarecibos y Cobranza (Flujo de 3 Estados)
- **Menú "Contrarecibos / Cobranza":** Agrupación clara por folio de Contrarecibo (GT / TH).
- **Flujo Operativo de Cobro en 3 Pasos:**
  1. `pending` (Por Cobrar): Factura emitida al cliente.
  2. `paid` (🟡 Con el Contador): El cliente (GT/TH) pagó vía transferencia electrónica al contador.
  3. `collected` (💵 Recibida del Contador): El dinero físico/efectivo fue recibido, descontando la comisión configurada e ingresando automáticamente el **neto** a Caja Chica.
- **Estatus de Complemento de Pago SAT:** Control de emisión y envío del complemento de pago (`pending` / `issued` / `na`).
- **Antigüedad de Saldos y Alertas:** Notificación automática de facturas próximas a vencer o vencidas.

### 1.4 Módulo de Caja Chica y Efectivo
- Widget **💼 Por Recibir del Contador** en el Panel Principal: Muestra facturas cobradas por el cliente pero aún no entregadas por el contador, desglosando la comisión y el neto exacto a recibir.
- Registro automático de ingresos al marcar facturas como "Recibidas del Contador".
- Control de egresos y gastos operativos menores.

### 1.5 Módulo de Compras a Fabricante
- Registro de kilos pedidos vs kilos recibidos del proveedor (Andrés / Fabricante).
- Control de cuentas por pagar y abonos a proveedores.

### 1.6 Módulo de Configuración Financiera
- **Comisión Editable en Porcentaje (%):** Permite configurar la comisión del contador en porcentaje (ej: 6.9%), convirtiendo de forma transparente a decimal.
- Configuración de IVA, días de crédito y precio base de venta/costo por kilo.
- Botón de **Recálculo Masivo de Órdenes Abiertas** para actualizar montos si cambian las reglas comerciales.

### 1.7 Respaldo Offline y Seguridad
- **Exportación HTML Offline (`bridge.ts`):** Generación de archivo `.html` ejecutable sin internet con todos los datos integrados (facturas, OCs, contrarecibos, caja y comisiones).
- Respaldo en Excel (`.xlsx`) y JSON estructurado.

## 2. Tecnologías y Seguridad

- **Frontend:** React 18, TypeScript, Vite. Progressive Web App (PWA) instalable en escritorio (Windows/Mac) y Móviles (iOS/Android) con soporte Offline nativo.
- **Backend:** Firebase Authentication, Firestore Database, Firebase Storage, Cloud Functions (Node.js 22).
- **Hosting:** Firebase Hosting (`https://control-de-bolsas-69.web.app/`).

## 3. Reglas de Negocio Clave
- **Flujo de Dinero:** Cliente paga por transferencia al Contador -> Contador entrega en efectivo (menos comisión) -> Entra como neto a Caja Chica.
- **Contrarecibo vs Factura:** GT/TH son identificadores de Contrarecibo; cada factura tiene su Folio numérico.

