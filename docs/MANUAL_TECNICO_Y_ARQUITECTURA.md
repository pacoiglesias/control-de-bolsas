# 📘 MANUAL TÉCNICO, ARQUITECTURA Y FLUJOS DEL SISTEMA
## ERP Control Providencia · v8.3.4 Enterprise Multi-Concept & Mobile PWA Supercharged Edition

Este documento describe la arquitectura técnica integral, los flujos operativos reales del negocio, las fórmulas matemáticas de cálculo, el catálogo de funciones de software y las estructuras de datos de la plataforma.

---

## 🏢 1. Modelo Operativo del Negocio (Realidad del Negocio)

El sistema está diseñado exclusivamente para el modelo de intermediación y maquila de bolsas plásticas entre tres actores principales:

```
                                  [ TALLER DE MAQUILA: ANDRÉS ]
                                     • Fabrica bolsas por Kilo ($42.00/kg)
                                     • Entrega en bultos/rollos (pesados en báscula)
                                                │
                                                ▼  (Entrega de Kilos)
[ GRUPO TEXTIL PROVIDENCIA ] ◄────────────────────────────────────────
  • Emite Órdenes de Compra (OC) por Kilo
  • Paga $43.00/kg + 16% IVA = $49.88/kg
  • Emite Contrarecibo (CR) al recibir factura
                │
                ▼  (Pago de Contrarecibo)
[ EQUIPO CONTABLE / DESPACHO ] ──(Deduce 8% comisión)──► [ CAJA EFECTIVO (PACO) ]
                                                            • Paga material a Andrés ($42/kg)
                                                            • Reparto 50/50 entre Paco y Socio
```

### Reglas Clave Inviolables:
1. **Unidad Universal de Control:** Todo el negocio (compras, ventas, inventario, facturación y entregas) se controla en **KILOS (kg)**.
2. **Precios y Márgenes Estándar:**
   - Costo de Maquila (Andrés): **$42.00 / kg**.
   - Venta a Providencia: **$43.00 / kg** + 16% IVA.
   - Comisión del Contador: **8.0%** sobre el total facturado con IVA al momento del cobro.
   - Reparto de Utilidades Netas: **50% Paco Iglesias / 50% Socio**.
3. **Control de Contrarecibos:** Ninguna factura se considera en cobro formal sin un número de Contrarecibo (CR) emitido por Providencia.
4. **Liquidación a Andrés:** Se audita mediante un Libro Mayor donde cada kilo entregado genera un cargo ($42/kg) y cada entrega de efectivo genera un abono. Los anticipos se amortizan automáticamente.

---

## 📐 2. Fórmulas Matemáticas y Algoritmos Financieros

Todas las operaciones de cálculo monetario y pesaje se ejecutan con redondeo financiero estándar a 2 decimales (`src/lib/finance.ts` y `src/lib/math.ts`).

### 1. Facturación a Providencia:
$$\text{Subtotal} = \text{Kilos Facturados} \times \$43.00$$
$$\text{IVA (16\%)} = \text{Subtotal} \times 0.16$$
$$\text{Total Factura} = \text{Subtotal} + \text{IVA} = \text{Kilos Facturados} \times \$49.88$$

### 2. Comisión del Contador y Cobranza Neta:
$$\text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.08$$
$$\text{Neto a Entrar en Caja} = \text{Total Factura} - \text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.92$$

### 3. Costo de Maquila y Utilidad Neta Real:
$$\text{Costo Andrés} = \text{Kilos Entregados} \times \$42.00$$
$$\text{Utilidad Neta Real} = \text{Neto a Entrar en Caja} - \text{Costo Andrés} - \text{Gastos Operativos Directos}$$

### 4. Reparto de Socios (50/50):
$$\text{Parte Paco (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$
$$\text{Parte Socio (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$

### 5. Estado de Cuenta de Andrés (Amortización de Anticipos):
$$\text{Deuda de Material} = \sum (\text{Kilos Recibidos} \times \$42.00)$$
$$\text{Total Pagado} = \sum (\text{Egresos a Andrés}) - \sum (\text{Ingresos de Andrés})$$
$$\text{Saldo Proveedor} = \text{Total Pagado} - \text{Deuda de Material} + \text{Ajuste Histórico}$$
* Si $\text{Saldo Proveedor} < 0$: Deuda por pagar a Andrés (Andrés entregó más material del pagado).
* Si $\text{Saldo Proveedor} > 0$: **Anticipo a favor de Paco** (Paco pagó por adelantado; se descuenta con futuras entregas).

---

## 🛠️ 3. Catálogo de Módulos y Bibliotecas del Sistema

### 1. `src/components/Dashboard/ActionRadar.tsx` (Radar Proactivo de Decisiones de Hoy)
- **Propósito:** Escaneo en tiempo real de toda la base de datos de órdenes, entregas y contrarecibos. Detecta:
  1. Kilos entregados por Andrés pendientes de facturar con botón `[⚡ Facturar Ahora]`.
  2. Contrarecibos vencidos con cálculo de días de atraso y botón `[💬 Cobrar por WhatsApp]`.
  3. Dinero cobrado por el contador listo para recibir en caja descontando la comisión del 8% con botón `[💰 Recibir en Caja]`.
  4. Retrasos de fabricación de Andrés con botón `[📞 Preguntar a Andrés]`.

### 2. `src/components/Orders/KanbanBoard.tsx` (Kanban Interactivo de 7 Columnas)
- **Propósito:** Tablero Kanban con HTML5 Drag & Drop (`draggable`), resaltado visual de destino (`border: 2px dashed`), botones de avance rápido `[➔ Siguiente Fase]`, selector desplegable `[Mover a...]` para móviles y confirmación auditiva (`sound.playChaChing()` / `sound.playSwoosh()`).

### 3. `src/lib/prefacturaGenerator.ts` (Generador de Prefacturas PDF)
- **Función:** `generatePrefacturaPdf(order, invoice)`
- **Descripción:** Toma los datos de la OC de Providencia y genera una prefactura lista para timbrado en formato PDF A4 con clave SAT `24111500`, unidad `KGM`, desglose de IVA y cantidad con letra en pesos mexicanos.

### 4. `src/lib/andresStatementPdf.ts` (Estado de Cuenta Auditado de Andrés)
- **Función:** `generateAndresAuditStatementPdf(data)`
- **Descripción:** Genera un PDF formal con la liquidación histórica de maquila, costo de $42/kg, abonos, anticipos amortizados, balance final y recuadros de firmas de conformidad.

### 5. `src/lib/export.ts` (Exportador Maestro de Auditoría y Respaldo)
- **Función:** `exportTotalBusinessBackupExcel()`
- **Descripción:** Genera un archivo `.xlsx` con 4 pestañas: `1_Ordenes_y_Kilos`, `2_Facturas_y_Contrarecibos`, `3_Compras_Andres` y `4_Flujo_Caja_y_Socios`.

### 6. `src/lib/whatsappReminder.ts` (Generador de Mensajes Formales WhatsApp)
- **Función:** `generateCollectionNotice(data)` y `openWhatsAppMessage(text)`
- **Descripción:** Redacta y abre avisos de cobranza con folio, contrarecibo, importe e hipervínculo directo a WhatsApp Web / App.

---

## 🧩 4. Mapa de Componentes y Vistas Principales

| Ruta / Componente | Propósito Operativo |
|---|---|
| **`/` (`Dashboard.tsx`)** | Centro de comando con el **Radar de Decisiones Inmediatas**, Semáforo Operativo, Pipeline del Flujo del Dinero, Tacómetro de Kilos, Timeline de Contrarecibos, Tarjeta de Socios 50/50 y Cobranza Semanal. |
| **`/ordenes` (`Orders.tsx`)** | Selector de 3 Modos: **`⚡ Acciones Hoy`** (Inbox Zero), **`◫ Tablero`** (Kanban Drag & Drop) y **`☰ Lista`** (Tabla Excel). |
| **`/cobranza` (`Cobranza.tsx`)** | Tablero Kanban y lista de facturas clasificadas por estatus de Contrarecibo, vencimientos y dinero con el contador. |
| **`/compras` (`Compras.tsx`)** | Tablero Kanban de 4 fases de compra y Control de maquila de Andrés con el Libro Mayor, botón `[📄 PDF Auditado]` y amortización de anticipos. |
| **`/seguimiento-oc` (`OcTracking.tsx`)** | Tablero Kanban de logística de entregas (Pedido ➔ En Camino ➔ Entregado sin Facturar ➔ Facturado por Cobrar ➔ Cobrado). |
| **`/caja-chica` (`CajaChica.tsx`)** | Flujo de efectivo en 4 pilares: Efectivo en Caja, Por Recibir del Contador (desglose 8%), Cuenta con Andrés y Reparto a Socios. |
| **`/portal-maquilador` (`MaquiladorPortal.tsx`)** | Portal para celular de Andrés con semáforo de producción (`¡Taller al Día!` vs `Kilos Pendientes`), registro de pesadas y calculadora de bultos. |
| **`FloatingKiloCalculator.tsx`** | Calculadora rápida flotante (Kilos $\times$ $43, $42, IVA, 8% contador y ganancia 50/50). |
| **`MagicPasteModal.tsx`** | Pegado mágico de mensajes de WhatsApp que extrae kilos, bultos y folio en 1 clic. |

---

## 🔄 5. Flujo de Vida de una Orden de Compra (State Machine)

```
[ NUEVA OC PROVIDENCIA ] (Captura de Folio, Kilos y Precio $43/kg)
         │
         ▼
[ EN PRODUCCIÓN / ANDRÉS ] (Andrés fabrica bolsas a $42/kg)
         │
         ▼  (Registro de Remisión / Pesada en Báscula)
[ 100% ENTREGADA EN ALMACÉN ] (Se valida contra báscula Providencia)
         │
         ▼  (Generación de Prefactura PDF)
[ FACTURADA / EN ESPERA DE CR ] (Factura entregada a Cuentas por Pagar)
         │
         ▼  (Captura de Número de Contrarecibo: ej. TH-842)
[ CON CONTADOR / POR COBRAR ] (Crédito activo a fecha de vencimiento)
         │
         ▼  (Providencia paga factura)
[ DINERO EN TRÁNSITO CON CONTADOR ] (Deducción automática 8% comisión)
         │
         ▼  (Contador entrega efectivo limpio a Paco)
[ EN CAJA EFECTIVO ] ──► [ PAGO A ANDRÉS ($42/kg) ] + [ REPARTO SOCIOS 50/50 ]
```

---

## 🔒 6. Seguridad y Respaldo de Datos
* **Reglas de Seguridad Firestore (`firestore.rules`):** Control estricto de roles (`admin`, `operator`, `viewer`) y bloqueo de borrado no autorizado.
* **Respaldos Automáticos:**
  * Respaldos en la nube Firestore con historial de snapshots.
  * Respaldo Total a Excel (`.xlsx`) en 1 clic con 4 pestañas de auditoría.
  * Respaldo Offline HTML de emergencia.

