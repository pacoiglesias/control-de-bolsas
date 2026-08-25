# Guías y Reglas del Proyecto (Antigravity Config)

Este archivo configura las reglas de operación, compilación, pruebas y despliegue del sistema para el agente Antigravity.

---

## 🛠️ Comandos de Operación del Sistema

### 1. Compilación (Build)
*   **Comando:** `npm run build`
*   **Qué hace:** Compila tanto la interfaz del cliente (Vite + TSX) como las Cloud Functions en TypeScript. Debe ejecutarse obligatoriamente antes de cualquier despliegue.

### 2. Pruebas Unitarias
*   **Comando:** `npx vitest run src/lib/__tests__` o `npm test`
*   **Qué hace:** Ejecuta los 75 tests unitarios de validación matemática de cuentas por cobrar, comisiones y conciliación contable.

### 3. Despliegue (Deploy)
*   **Comando:** `npx firebase deploy` o usar la herramienta MCP `firebase_deploy`.
*   **Frecuencia:** Cada vez que se compila una versión estable con cambios en producción.

---

## 📊 Reglas de Conciliación Financiera y Cuentas de Andrés

### 1. Convención de Signos para Andrés (`historicalDebtAndres`)
*   **Valores Positivos (+):** Representan un saldo a favor de Andrés (anticipos de la empresa a Andrés por entregas futuras).
*   **Valores Negativos (-):** Representan una deuda de la empresa hacia Andrés (pasivo).

### 2. Asistente de Calibración Automática
*   Cuando el saldo de Andrés esté desfasado, no hagas cálculos manuales complejos. Dirígete o instruye usar la herramienta `🔧 Calibrar Saldo` en la página de [Compras](file:///c:/pacoputo/src/pages/Compras.tsx), la cual calcula la diferencia contra Firestore de forma automática.

### 3. Sincronización y Salvaguarda de Datos
*   **Nunca sobreescribir** el campo `historicalDebtAndres` en Firestore si ya existe un valor personalizado por el usuario. El sincronizador oficial debe respetar el saldo histórico ya configurado.
*   **Protección de Purga:** La herramienta de purga de expedientes obsoletos en [Configuración](file:///c:/pacoputo/src/pages/Settings.tsx) debe proteger siempre:
    1.  Las órdenes en estatus `pedido` (entregas en curso de Andrés).
    2.  Las facturas en revisión listadas en `OFFICIAL_IN_REVIEW` (las facturas `6198` y `6193` pendientes de contrarecibo).

### 4. Regla Inviolable de Kilos de Andrés y Facturación
*   **Topes de Entrega:** Andrés **NUNCA** puede entregar kilos de más de lo indicado en la Orden de Compra (OC). Siempre entrega lo que indica la OC o menos kilos (entregas parciales).
*   **Facturación a Providencia:** A Providencia no se le pueden facturar kilos de más de una OC emitida.
*   **Cero Mermas:** No hay mermas de parte de Andrés. Todo kilo entregado y recibido ampara exactamente su valor de costo sin deducción de merma.

### 5. Parámetros de Precios y Márgenes Actuales
*   **Costo de Compra a Andrés:** **$38.00 / kg** (actualizado desde $42.00/kg).
*   **Precio de Venta a Providencia:** **$43.00 / kg** (+ 16% IVA = $49.88 con IVA).
*   **Margen Bruto de Operación:** **$5.00 / kg**.
*   **Comisión del Contador:** 8% sobre subtotal de facturación.

### 6. Separación Estricta de Departamentos de Providencia y Prefijos de Contrarecibos
*   **Textil Hogar (TH / NAVA):**
    *   **Nombre de Cliente:** `TEXTIL HOGAR (TH - NAVA)` / `GRUPO TEXTIL PROVIDENCIA (TH)`
    *   **Departamento:** `TH-ALMACEN-1`
    *   **Solicitó:** `JOSÉ NAVA FLORES`
    *   **Autorizó:** `JOSÉ ANTONIO TORRE LAMUÑO`
    *   **Prefijo Oficial de Contrarecibos:** **`TH-`** (ej. `TH-946`, `TH-1024`)
*   **Grupo Textil Providencia / Planta P4 (GT / EVELIA):**
    *   **Nombre de Cliente:** `GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)`
    *   **Departamento:** `P4-ALM`
    *   **Solicitó / Contacto:** `EVELIA`
    *   **Prefijo Oficial de Contrarecibos:** **`GT-`** (ej. `GT-570`, `GT-890`)
*   **Regla de Enrutamiento Automático:**
    1. Si un contrarecibo o documento empieza con prefijo `TH-` o proviene de José Nava Flores / Torre Lamuño, se asigna forzosamente a **TH (Textil Hogar)**.
    2. Si empieza con prefijo `GT-` o proviene de Evelia / P4, se asigna forzosamente a **GT (Grupo Textil)**.
    3. Nunca combinar entregas, facturas o contrarecibos entre ambos expedientes.

### 7. Regla de Oro de Integridad de Datos y No-Regresión en Contextos y Modales
*   **Fusión No-Destructiva en OrdersContext:** Al inyectar o calibrar órdenes canónicas (TH y GT), **NUNCA** reemplazar el arreglo `deliveries` o `invoices` con una lista estática cerrada (`best.deliveries = [...]`). Siempre fusionar respetando cualquier nuevo registro creado en Firestore por el usuario (`[...baseDeliveries, ...firestoreDeliveries]`).
*   **Visibilidad de Facturación en Expedientes:** La pestaña `🧾 Facturas & Cobros` debe existir siempre en la barra principal de pestañas de `OrderModal` (`TABS`).
*   **Disponibilidad en Facturación Rápida:** El modal `QuickInvoiceModal` debe listar siempre todas las órdenes activas del ERP para permitir tanto facturar entregas de báscula como prefacturar OCs abiertas.



