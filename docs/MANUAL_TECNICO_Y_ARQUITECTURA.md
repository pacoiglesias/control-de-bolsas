# 📘 MANUAL TÉCNICO, ARQUITECTURA Y FLUJOS DEL SISTEMA
## ERP Control Providencia · v8.4.0 Enterprise Interactive Cockpit & Immutable Price Edition

Este documento describe la arquitectura técnica integral, los flujos operativos reales del negocio, las fórmulas matemáticas de cálculo, el catálogo de funciones de software, la política de inmutabilidad de precios históricos y las estructuras de datos de la plataforma.

---

## 🏢 1. Modelo Operativo del Negocio (Realidad del Negocio)

El sistema está diseñado exclusivamente para el modelo de intermediación y maquila de bolsas plásticas entre tres actores principales:

```
                                  [ TALLER DE MAQUILA: ANDRÉS ]
                                     • Fabrica bolsas por Kilo ($42.00/kg)
                                     • Entrega en bultos/rollos (pesados en báscula)
                                                │
                                                ▼  (Entrega de Kilos en Báscula)
[ GRUPO TEXTIL PROVIDENCIA ] ◄────────────────────────────────────────
  • Emite Órdenes de Compra (OC) por Kilo
  • Paga $43.00/kg (o precio pactado) + 16% IVA
  • Emite Contrarecibo (CR) al recibir factura
                │
                ▼  (Pago de Contrarecibo)
[ EQUIPO CONTABLE / DESPACHO ] ──(Deduce 8% comisión)──► [ CAJA EFECTIVO (PACO) ]
                                                            • Paga material a Andrés ($42/kg) con Recibo Firmado
                                                            • Reparto 50/50 entre Paco y Socio
```

### Reglas Clave Inviolables:
1. **Unidad Universal de Control:** Todo el negocio (compras, ventas, inventario, facturación y entregas) se controla en **KILOS (kg)**.
2. **Precios y Márgenes Estándar e Inmutabilidad Histórica:**
   - Costo de Maquila (Andrés): **$42.00 / kg** (o costo pactado por OC).
   - Venta a Providencia: **$43.00 / kg** + 16% IVA (o precio pactado por OC).
   - Comisión del Contador: **8.0%** sobre el total facturado con IVA al momento del cobro.
   - Reparto de Utilidades Netas: **50% Paco Iglesias / 50% Socio**.
   - **Congelación de Precios:** Cada OC y Factura retiene su propio precio snapshot, blindando el historial contable ante futuros cambios de precios en la configuración global.
3. **Control de Contrarecibos:** Ninguna factura se considera en cobro formal sin un número de Contrarecibo (CR) emitido por Providencia.
4. **Liquidación a Andrés con Recibos y Firmas:** Se audita mediante un Libro Mayor donde cada kilo entregado genera un cargo ($42/kg) y cada entrega de efectivo genera un abono con **Recibo Oficial Impreso para Firma de Andrés**. Los anticipos se amortizan automáticamente.

---

## 📐 2. Fórmulas Matemáticas y Algoritmos Financieros

Todas las operaciones de cálculo monetario y pesaje se ejecutan con redondeo financiero estándar a 2 decimales (`src/lib/finance.ts` y `src/lib/math.ts`).

### 1. Facturación a Providencia:
$$\text{Subtotal} = \text{Kilos Facturados} \times \text{Precio Venta Unitario (ej. } \$43.00\text{)}$$
$$\text{IVA (16\%)} = \text{Subtotal} \times 0.16$$
$$\text{Total Factura} = \text{Subtotal} + \text{IVA} = \text{Kilos Facturados} \times \$49.88$$

### 2. Comisión del Contador y Cobranza Neta:
$$\text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.08$$
$$\text{Neto a Entrar en Caja} = \text{Total Factura} - \text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.92$$

### 3. Costo de Maquila y Utilidad Neta Real:
$$\text{Costo Andrés} = \text{Kilos Entregados} \times \text{Costo Unitario Andrés (ej. } \$42.00\text{)}$$
$$\text{Utilidad Neta Real} = \text{Neto a Entrar en Caja} - \text{Costo Andrés} - \text{Gastos Operativos Directos}$$

### 4. Reparto de Socios (50/50):
$$\text{Parte Paco (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$
$$\text{Parte Socio (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$

### 5. Estado de Cuenta de Andrés (Amortización de Anticipos y Entregas):
$$\text{Deuda de Material} = \sum (\text{Kilos Recibidos en Báscula} \times \text{Costo Andrés})$$
$$\text{Total Pagado} = \sum (\text{Egresos a Andrés}) - \sum (\text{Ingresos de Andrés})$$
$$\text{Saldo Proveedor} = \text{Total Pagado} - \text{Deuda de Material} + \text{Ajuste Histórico}$$
* Si $\text{Saldo Proveedor} < 0$: Deuda por pagar a Andrés (Andrés entregó más material del pagado).
* Si $\text{Saldo Proveedor} > 0$: **Anticipo a favor de Paco** (Paco pagó por adelantado; se descuenta con futuras entregas).

---

## 🛠️ 3. Catálogo de Módulos y Bibliotecas del Sistema

### 1. `src/components/Dashboard/MoneyFlowPipeline.tsx` (Cockpit Interactivo de 5 Estaciones)
- **Propósito:** Visualización cronológica del dinero desde la materia prima hasta la caja chica:
  1. `1. En Producción (Andrés)` (Kilos en fabricación $\times$ Costo $42).
  2. `2. Almacén Providencia` (Kilos pesados en báscula listos para facturar $\times$ Venta + IVA).
  3. `3. Facturado (Sin CR)` (Facturas emitidas en revisión en Providencia).
  4. `4. Con Contrarecibo` (Cuentas por cobrar en crédito 30-60 días).
  5. `5. En Caja Chica` (Efectivo real en mano disponible).
- **Interacción Bidireccional:** Al hacer clic en cualquier estación, filtra al instante la tabla de órdenes inferior.

### 2. `src/lib/andresReceiptPdf.ts` (Generador de Recibos Oficiales para Firma de Andrés)
- **Funciones:** `generateAndresReceiptPdf(data)` y `printAndresReceipt(data)`
- **Descripción:** Genera e imprime comprobantes de pago formal con folio único, fecha extendida, importe en número y letra en pesos mexicanos, estado de cuenta conciliado, cláusula de conformidad y cuadro de firmas autógrafas para Andrés y la Administración.

### 3. `src/lib/andresStatementPdf.ts` (Estado de Cuenta y Liquidación de Entregas de Andrés)
- **Función:** `generateAndresAuditStatementPdf(data)`
- **Descripción:** Genera un PDF formal con la liquidación histórica de maquila, desglose de órdenes surtidas por Andrés (kilos pedidos vs entregados, avance % y costo), historial de abonos y balance vivo con firmas.

### 4. `src/lib/prefacturaGenerator.ts` (Generador de Prefacturas PDF)
- **Función:** `generatePrefacturaPdf(order, invoice)`
- **Descripción:** Genera una prefactura para timbrado fiscal en formato PDF Carta con clave SAT `24111500`, unidad `KGM`, desglose de IVA y cantidad con letra en pesos mexicanos.

### 5. `src/context/PrivacyContext.tsx` (Modo Privacidad Instantáneo)
- **Propósito:** Permite alternar con 1 toque en la cabecera (`👁️`) el difuminado con cristal esmerilado de todas las cifras monetarias para operar en público y almacén sin exponer datos financieros.

### 6. `src/lib/export.ts` (Exportador Maestro de Auditoría y Respaldo)
- **Función:** `exportTotalBusinessBackupExcel()`
- **Descripción:** Genera un archivo `.xlsx` con 4 pestañas: `1_Ordenes_y_Kilos`, `2_Facturas_y_Contrarecibos`, `3_Compras_Andres` y `4_Flujo_Caja_y_Socios`.

### 7. `src/lib/whatsappReminder.ts` (Generador de Mensajes Formales WhatsApp)
- **Función:** `generateCollectionNotice(data)` y `openWhatsAppMessage(text)`
- **Descripción:** Redacta y abre avisos de cobranza y comprobantes de abono con folio, contrarecibo, importe e hipervínculo directo a WhatsApp Web / App.

---

## 🧩 4. Mapa de Componentes y Vistas Principales

| Ruta / Componente | Propósito Operativo |
|---|---|
| **`/` (`Dashboard.tsx`)** | Cockpit Ejecutivo con **Pipeline de 5 Estaciones Interactivo**, Tabla de Seguimiento de Pedidos, Semáforo Operativo, Panel Ejecutivo Black Titanium (Reparto 50/50), Modo Privacidad y Asistente Proactivo. |
| **`/ordenes` (`Orders.tsx`)** | Expedientes de compra, desglose de partidas, remisiones de entrega, facturación multi-concepto, botón `[🔒 Concluir Pedido]` y prefacturas PDF. |
| **`/cobranza` (`Cobranza.tsx`)** | Tablero Kanban y lista de facturas clasificadas por estatus de Contrarecibo, vencimientos y dinero con el contador. Asignador Multi-Factura de CRs. |
| **`/compras` (`Compras.tsx`)** | Control de maquila de Andrés con el Libro Mayor, botón `[📄 PDF Auditado]` con desglose de pedidos surtidos, botón `[🖨️ Recibo]` y generador de comprobantes para firma. |
| **`/seguimiento-oc` (`OcTracking.tsx`)** | Tablero Kanban de logística de entregas con desglose de kilos pedidos vs kilos pesados en báscula. |
| **`/caja-chica` (`CajaChica.tsx`)** | Flujo de efectivo en 4 pilares: Efectivo en Caja, Por Recibir del Contador (desglose 8%), Cuenta con Andrés y Reparto a Socios con fechas completas y día de la semana. |
| **`/portal-maquilador` (`MaquiladorPortal.tsx`)** | Portal PIN para celular de Andrés con semáforo de producción (`¡Taller al Día!` vs `Kilos Pendientes`), registro de pesadas y calculadora de bultos (sin acceso a precios ni márgenes). |
| **`FloatingKiloCalculator.tsx`** | Calculadora rápida flotante (Kilos $\times$ $43, $42, IVA, 8% contador y ganancia 50/50). |
| **`MagicPasteModal.tsx`** | Pegado mágico de mensajes de WhatsApp que extrae kilos, bultos y folio en 1 clic. |

---

## 🔄 5. Flujo de Vida de una Orden de Compra (State Machine)

```
[ NUEVA OC PROVIDENCIA ] (Captura de Folio, Kilos Pedidos y Precios Congelados)
         │
         ▼
[ 1. EN PRODUCCIÓN / ANDRÉS ] (Andrés fabrica bolsas a $42/kg o costo pactado)
         │
         ▼  (Registro de Remisión / Pesada en Báscula en Providencia)
[ 2. ALMACÉN PROVIDENCIA (POR FACTURAR) ] (Kilos entregados sin factura fiscal)
         │
         ▼  (Generación de Prefactura PDF / Factura Fiscal)
[ 3. FACTURADO (SIN CR) ] (Factura entregada a Cuentas por Pagar en revisión)
         │
         ▼  (Captura de Número de Contrarecibo: ej. TH-842)
[ 4. CON CONTRARECIBO (EN CRÉDITO) ] (Crédito activo a 30-60 días de vencimiento)
         │
         ▼  (Providencia liquida factura al Contador)
[ DINERO CON CONTADOR ] (Deducción automática 8% comisión del despacho)
         │
         ▼  (Contador entrega efectivo limpio a Paco)
[ 5. EN CAJA CHICA ] ──► [ PAGO A ANDRÉS CON RECIBO FIRMADO ] + [ REPARTO SOCIOS 50/50 ]
```

---

## 🔒 6. Seguridad, Auditoría y Respaldo de Datos
* **Reglas de Seguridad Firestore (`firestore.rules`):** Control estricto de roles (`admin`, `operator`, `viewer`) y bloqueo de borrado no autorizado.
* **Bitácora en Vivo (`system_logs` / `LiveLogsModal`):** Registro de cada borrado, creación de facturas y pagos a Andrés con usuario y timestamp.
* **Advertencias Críticas en Borrados:** Diálogos modales con advertencias contextuales antes de eliminar facturas con contrarecibo, remisiones facturadas o movimientos de caja.
* **Respaldos Automáticos:**
  * Respaldos en la nube Firestore con historial de snapshots.
  * Respaldo Total a Excel (`.xlsx`) en 1 clic con 4 pestañas de auditoría.
  * Respaldo Offline HTML de emergencia.
