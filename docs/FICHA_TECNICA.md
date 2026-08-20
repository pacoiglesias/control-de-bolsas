# Ficha Técnica y Reporte de Funciones: Control Bolsas ERP (v8.9.4)

## Resumen del Sistema y Arquitectura

- **Producción URL:** `https://control-de-bolsas-69.web.app/`
- **Proyecto Firebase:** `control-de-bolsas-89c88`
- **Versión Actual:** `v8.9.4`

### Reglas del Dominio Operativo
1. **Diferenciación GT / TH vs Folio:**
   - **GT-xxx / TH-xxx** son números de **Contrarecibo (CR)**.
   - Cada factura individual tiene su **Folio numérico de Factura** (ej: `#6084`, `#6054`).
2. **Flujo Financiero y Cobranza:**
   - El cliente (GT/TH) paga vía transferencia electrónica al contador. Factura en estado `paid` (🟡 Con el Contador).
   - El contador entrega el dinero físico/efectivo menos su comisión del **8% sobre el subtotal**.
   - Se marca como `collected` (💵 Recibida del Contador), ingresando automáticamente el **monto neto** a Caja Chica.
3. **Módulo de Órdenes de Compra (`/oc`):**
   - Rastreo de kilos contratados por OC vs kilos facturados/surtidos.
4. **Respaldo HTML Offline:**
   - Permite descargar la base de datos completa encapsulada en un archivo `.html` funcional sin servidor.

## 2. Fórmulas Financieras Clave (¡NUNCA OLVIDAR!)
Para evitar confusiones futuras, el negocio opera bajo la siguiente lógica matemática estricta:
- **El IVA cobrado ES PARTE DE LA UTILIDAD INTERNA**, ya que el manejo de impuestos se hace por fuera del sistema.
- **Ingreso Total Facturado:** `(Kilos Totales × Precio de Venta [$43.00/kg]) + 16% IVA`
- **Costo de Compra (Andrés):** `Kilos Totales × Precio de Compra [$42.00/kg]`
- **Comisión Contabilidad:** `Subtotal Facturado × 8%` (configuración por defecto: sobre subtotal, no sobre el total con IVA).
- **UTILIDAD LÍQUIDA REAL (Lo que queda libre):** `Ingreso Total Facturado − Costo de Compra − Comisión`, repartida 50% Paco / 50% Socio.
  *(Ejemplo: 43 Venta + IVA = 49.88 Ingreso por kilo. Utilidad = 49.88 − 42 Costo − Comisión).*
- **Saldo con el maquilador (Andrés):** `Total Pagado − Costo de Material Recibido + Ajuste Histórico configurado en Ajustes`. Fuente única: `src/hooks/useAndresStats.ts`, usado por `/compras`.

## 3. Módulos Operativos

### 1.1 Módulo de Inteligencia Artificial (Lectura de Documentos)
- **Extracción de Órdenes de Compra (PDF):** la IA (Gemini) lee PDFs de órdenes de compra, extrayendo Folio, Cliente, Kilos Totales y tabla detallada de artículos.
- **Extracción de Facturas de Venta (PDF):** detecta cuando un documento es una Factura, extrae la referencia de la OC original, valida el UUID y anexa la factura al expediente correspondiente.
- **Procesamiento de Complementos de Pago (XML):** analiza los nodos `pago20:DoctoRelacionado` de un CFDI de pago, extrae los UUIDs y busca las facturas pagadas.
- **Autorización:** requiere correo verificado y rol `admin` o `manager` — no basta con estar autenticado.

### 1.2 Módulo de Ventas (Órdenes / Expedientes)
- Creación manual y/o mediante IA.
- Control multi-entregas: registro de entregas parciales por fecha y notas de remisión.
- Generación nativa de **Remisiones en PDF**.
- Kanban con drag & drop y confirmación explícita al saltar varios pasos de golpe (ej. de "Pendiente de Facturar" directo a "Cobrado").

### 1.3 Módulo de Cobranza Ágil
- Tabla de "Antigüedad de Saldos" agrupada por Cliente.
- Botón **💰 Marcar Cobrada** (acción a 1 clic).
- **Agrupación por Lotes:** múltiples facturas bajo el mismo Contrarecibo, liquidables juntas.
- **Alertas Visuales:** el banner de "recién vencidas" y la tarjeta de "vencido acumulado" muestran números distintos a propósito y ahora lo explican en el propio texto.

### 1.4 Módulo de Compras a Fabricante (Andrés)
- Registro de kilos pedidos vs kilos recibidos, con Libro Mayor cronológico y ajuste histórico configurable.
- Portal Maquilador propio (`/portal-maquilador`), con PIN validado en el servidor y bloqueo tras 5 intentos fallidos.

### 1.5 Módulo de Caja Chica / Flujo
- Panel para registrar egresos e ingresos operativos.
- Impacto directo en el cálculo de la liquidez real.

### 1.6 Dashboard Gerencial
- KPIs: Efectivo en Caja, Ventas, Dinero en la Calle, Urgencias (vencido).
- Kilos Entregados con barra de progreso y filtro TH/GT.
- Bitácora de Versiones integrada (qué cambió y cuándo, visible dentro de la app).

### 1.7 Respaldo de Seguridad
- Exportación total de la base de datos a **Excel (.xlsx)** por pestañas.
- Respaldo automático programado (Cloud Function a medianoche) + respaldo local con `backup.ps1`.

## 2. Tecnologías y Seguridad

- **Frontend:** React 18.3, TypeScript, Vite. PWA instalable en escritorio y móvil con soporte offline parcial.
- **Backend:** Firebase Authentication, Firestore, Storage, Cloud Functions (Node.js 22).
- **Seguridad (Zero-Trust):**
  - Reglas de Firestore y Storage por rol (`admin`/`manager`/`viewer`), nunca por `request.auth != null` a secas.
  - Exigencia estricta de `email_verified == true`.
  - PIN del Portal Maquilador con límite de intentos y bloqueo temporal.
  - Ver `SECURITY.md` para el detalle completo.
- **Infraestructura Local:** `INSTALAR_BUILD_DEPLOY.bat` (instalar, typecheck, pruebas, lint, build, deploy) y `SUBIR_CAMBIOS.bat` (commit + push a GitHub con mensaje automático).

## 4. Limitaciones / Reglas de Negocio
- La comisión estándar y parámetros globales quedan inmutables una vez que la factura fue creada (snapshot por expediente).
- El sistema no maneja inventario físico de bodega, asumiendo el flujo directo *"Compra a proveedor → Entrega a cliente"*.

## 5. Auditoría y Automejora Continua

Ver `PROMPT_SISTEMA.md` para el prompt maestro de contexto y `AUDIT_NOTEBOOK.md` para el historial de hallazgos y correcciones ya aplicadas — antes de proponer una auditoría nueva, revisa ese historial para no repetir trabajo ya hecho.
