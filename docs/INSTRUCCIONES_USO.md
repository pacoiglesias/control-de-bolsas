# Manual de Uso Maestro: ERP Control Universal (v8.9.4)

> **Actualizado a v8.9.4.** Desde v8.7.0 (novedades listadas abajo) se agregaron: íconos reales en vez de emojis (Dashboard y Portal Maquilador), confirmación al saltar varios pasos en el Kanban de expedientes, bloqueo del PIN del Portal Maquilador tras 5 intentos fallidos, y la corrección de que "Saldo con Andrés" ahora muestra el mismo número en el Dashboard y en Compras. Detalle completo en `CHANGELOG.md`.

> **Novedades Clave de la Versión v8.7.0**
> - **⚡ Spotlight Universal (`Ctrl + K` / `⌘ + K`):** Buscador inteligente con navegación por flechas `↑` `↓` y `Enter` para buscar órdenes, contrarecibos, compras o ejecutar acciones directas.
> - **🔍 Smart Quick-Peek Drawer:** Panel lateral que se abre en 0.1 segundos para ver avance de kilos y estatus sin abrir modales pesados.
> - **🕶️ Atajo Global de Privacidad (`Ctrl + H`):** Oculta/muestra todas las cifras y utilidades en 1 segundo con cristal esmerilado para trabajar en público.
> - **🔘 Floating Quick Hub (`⚡`):** Botón flotante en esquina inferior derecha para acceso inmediato a todas las funciones clave.
> - **⚙️ Parametrización Total Multi-Empresa:** Configura tu razón social, taller maquilador, cliente y departamentos desde Configuración.
> - **🧹 Purga Segura de Pruebas:** Archiva en la Papelera los registros de desarrollo y conserva exactos los 10 CRs oficiales ($1,019,956.34) y la Factura 6167 ($81,780.00).

---

## 1. Acceso Rápido y Navegación Inteligente

### A. Spotlight Universal (`Ctrl + K`)
1. Presiona `Ctrl + K` (o `⌘ + K` en Mac) en cualquier pantalla del ERP.
2. Escribe el número de Contrarecibo (ej. `TH-912`), folio de OC, nombre de cliente o una acción (ej. *"Privacidad"*, *"Calculadora"*, *"Balanza"*).
3. Usa las flechas `↑` y `↓` para moverte entre los resultados y presiona `Enter` para abrirlo.

### B. Modo Privacidad (`Ctrl + H`)
- Si estás con choferes, proveedores o clientes y no quieres que vean tus montos de facturación ni márgenes de ganancia, presiona `Ctrl + H`.
- Todas las cifras monetarias se difuminarán de inmediato. Presiona `Ctrl + H` de nuevo para restaurarlas.

### C. Botón Flotante de Acciones (`⚡`)
- En la esquina inferior derecha encontrarás el botón flotante. Al pulsarlo se desplegará el menú rápido con accesos directos al Spotlight, Modo Privacidad, Calculadora de Kilos y Balanza.

---

## 2. Gestión de Órdenes y Expedientes

### A. Vista Rápida de Expedientes (Quick Peek)
- En la tabla de Contrarecibos o Facturas en Revisión del Dashboard, haz clic en el menú contextual (⋮) y selecciona **"🔍 Vista Rápida"**.
- Se abrirá un panel lateral derecho mostrando:
  - Kilos pedidos vs kilos entregados en báscula y avance en porcentaje.
  - Facturas timbradas y su estatus.
  - Botón directo para **Cobrar en 1 Toque**, **Enviar WhatsApp** o **Abrir Expediente Completo**.

### B. Subir pedidos con Inteligencia Artificial
1. Ve al menú **"Subir Órdenes"** o **"Captura Rápida"**.
2. Arrastra los PDFs de las Órdenes de Compra (OC).
3. Gemini extraerá automáticamente el folio, cliente, kilos totales y la tabla de artículos con sus precios congelados.

---

## 3. Cobranza y Contrarecibos

### A. Aislamiento Hermético TH / GT
- En el Dashboard principal puedes alternar entre **🔵 TH** y **🟢 GT** usando los botones superiores con el nombre de sus responsables (ej. *Lic. Nava* / *Lic. Evelia*).
- Cada pestaña muestra únicamente los expedientes de su departamento, y la suma de ambas coincide exactamente al centavo con el consolidado general.

### B. Menú Kebab (⋮) de Cobranza
- Cada fila cuenta con un menú contextual (⋮) con 6 opciones directas:
  - 🔍 **Vista Rápida (Quick Peek)**
  - 📋 **Abrir Expediente Completo**
  - ✏️ **Editar Cobranza (Drawer Lateral)**
  - 💵 **Marcar Pagado (1 Toque)** (con sonido de caja registradora)
  - ✉️ **Borrador de Correo Institucional**
  - 💬 **Recordatorio por WhatsApp**

---

## 4. Control de Maquila y Fabricante

1. Ve a **"Compras"** para consultar el Libro Mayor cronológico con el taller maquilador.
2. Cada entrega en báscula genera un cargo y cada abono genera un **Recibo Oficial Impreso para Firma**.
3. Puedes generar el **PDF Auditado** con el balance vivo y desglose de pedidos surtidos.

---

## 5. Parámetros del Sistema y Mantenimiento

1. Ve a **"Configuración"** (`/centro-control`).
2. Configura los datos de tu empresa, cliente principal, taller maquilador, códigos y nombres de departamentos.
3. Si deseas limpiar registros de prueba antiguos, usa la tarjeta **"🧹 Auditoría de Datos: Purga de Expedientes de Prueba"**. Conserverá intactos tus 10 Contrarecibos Oficiales y la Factura 6167.

---

## 9. Casos Prácticos de la Vida Real (Ejemplos)

Para que todo quede 100% claro, aquí tienes 3 ejemplos comunes de tu día a día:

### Caso 1: Una Venta Común (El Flujo del Dinero)
* **La Acción:** Le vendes 1,000 kilos a "Bolsas Juanito" a $75.00 el kilo. Tu costo con Andrés es de $42.00, y le pagas al Contador un 6% de comisión. El sistema calcula que cobraste $75,000 + IVA = **$87,000 totales**.
* **Lo que hace el sistema por detrás:**
  1. Congela el costo de $42 y el 6% para este pedido (así si mañana subes el precio a Andrés a $45, la venta de Juanito no se descuadra).
  2. Genera una deuda en la pestaña **Compras** por **$42,000** (1,000 kg x $42) a favor de Andrés.
  3. Calcula tu Utilidad Líquida usando la Regla de Oro: `$87,000 (Facturado) - $42,000 (Andrés) - $5,220 (Contador) = $39,780 libres para ti`.

### Caso 2: El Contador retiene el dinero
* **La Acción:** El cliente "Bolsas Juanito" te avisa que ya transfirió los $87,000, pero los mandó a la cuenta de tu Contador. 
* **Lo que tú haces:** Vas a "Cobranza", buscas la factura de Juanito y la pasas al estado 🟡 **"Con el Contador"**.
* **Lo que hace el sistema:** Mueve ese dinero a tu widget del Dashboard que dice *"Dinero con el Contador"*. Tú sabes que ese dinero existe, pero aún no te lo puedes gastar porque no lo tienes físicamente.
* **El desenlace:** Tres días después, el Contador te hace la transferencia descontando su comisión. Vuelves a la factura y la pasas a estado 🟢 **"Cobrada"**. En ese instante, el dinero líquido entra oficialmente a tu **Caja Chica**.

### Caso 3: Liquidando deudas con Andrés
* **La Acción:** Hoy es viernes de pagos. Ves en tu pantalla de **Compras** que a Andrés le debes $100,000 de tres pedidos distintos. Le haces una transferencia de $50,000 como abono general.
* **Lo que tú haces:** Le das clic a cualquiera de esos pedidos en la tabla y en "Pagado (Anticipo)" le pones los $50,000.
* **Lo que hace el sistema:** 
  1. Reduce tu deuda global con el Fabricante a $50,000.
  2. Va solito a la **Caja Chica** y anota: *"Egreso por $50,000 - Pago a Proveedor Andrés"*. No tuviste que registrar el gasto a mano, el sistema te cuidó la espalda para que tu saldo en el banco coincida con la Caja Chica.
