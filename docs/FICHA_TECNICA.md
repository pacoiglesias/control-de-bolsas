# Ficha Técnica y Reporte de Funciones: Control Bolsas ERP (v6.4)

Este documento detalla exhaustivamente todas las capacidades funcionales, operativas y técnicas del sistema al día de hoy.

## 1. Módulos Operativos

### 1.1 Módulo de Inteligencia Artificial (Lectura de Documentos)
- **Extracción de Órdenes de Compra (PDF):** La IA (Gemini 2.0 Flash) es capaz de leer PDFs de órdenes de compra, extrayendo el Folio, Cliente, Kilos Totales y una tabla detallada de artículos (Cantidad, Unidad, Descripción, Precio Unitario, Importe).
- **Extracción de Facturas de Venta (PDF):** La IA detecta cuando un documento es una Factura, extrae la referencia de la orden de compra original, valida el UUID y anexa la factura al expediente correspondiente de manera automática.
- **Procesamiento de Complementos de Pago (XML):** Lector nativo en la nube que analiza los nodos `pago20:DoctoRelacionado` de un CFDI de pago, extrae los UUIDs y busca instantáneamente (O(1)) las facturas pagadas en la base de datos para emitir un aviso.

### 1.2 Módulo de Ventas (Órdenes / Expedientes)
- Creación manual y/o mediante IA.
- Control multi-entregas: Registro de entregas parciales por fecha y notas de remisión.
- Generación nativa de **Remisiones en PDF** listas para imprimir.
- Semáforo de estatus en tiempo real: *Pedido*, *Revisión Manual*, *Facturado*, *Por Cobrar*, *Vencida*, *Cobrada*.

### 1.3 Módulo de Cobranza Ágil
- Tabla de "Antigüedad de Saldos" agrupada por Cliente (Al corriente, 30 días, 60 días, 90+ días).
- Botón **💰 Marcar Cobrada** (Acción rápida a 1-clic).
- **Agrupación por Lotes:** Permite agrupar múltiples facturas bajo el mismo número de Contrarecibo y liquidarlas juntas con un solo botón ("Pagar Lote").
- **Alertas Visuales:** Sistema de advertencia automático (globos rojos) indicando exactamente cuántos días de atraso lleva una factura vencida.
- Manejo de Estatus de Complemento de Pago (REP: Pendiente/Emitido).

### 1.4 Módulo de Compras a Fabricante
- Registro manual de kilos pedidos vs kilos recibidos del proveedor.
- Control de cuentas por pagar al proveedor (Deuda pendiente).

### 1.5 Módulo de Caja Chica / Flujo
- Panel para registrar egresos menores y gastos operativos.
- Impacto directo en el cálculo de la liquidez real.

### 1.6 Dashboard Gerencial
- Gráficas de Rentabilidad (Venta, Costo, Utilidad).
- Tarjetas de KPIs: Kilos Pedidos vs Entregados, Cuentas por Cobrar, Deuda Vencida.

### 1.7 Respaldo de Seguridad
- Exportación total de la base de datos a **Excel (.xlsx)** estructurado por pestañas.

## 2. Tecnologías y Seguridad

- **Frontend:** React, TypeScript, Vite. Progressive Web App (PWA) instalable en escritorio (Windows/Mac) y Móviles (iOS/Android) con soporte Offline Parcial.
- **Backend:** Firebase Authentication, Firestore Database, Firebase Storage, Cloud Functions (Node.js).
- **Seguridad (Zero-Trust):** 
  - Reglas de Firestore y Storage limitadas por dominios aprobados.
  - Exigencia estricta de `email_verified == true`.
  - Archivos protegidos mediante el SDK de Administración en el servidor.
- **Infraestructura Local:** Orquestación total (Inicio, Pruebas, Despliegue) mediante `CONTROL_MAESTRO.bat`. Privacidad de GitHub administrada por `PROTEGER_CODIGO.bat`.

## 3. Limitaciones / Reglas de Negocio
- La comisión estándar y parámetros globales se calculan en base a configuraciones que quedan inmutables una vez la factura ha sido creada.
- El sistema no maneja inventario físico de bodega, asumiendo un flujo directo *"Compra a proveedor -> Entrega a cliente"*.
