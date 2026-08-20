# 📘 MANUAL TÉCNICO, ARQUITECTURA Y FLUJOS DEL SISTEMA
## ERP Control Universal · v8.9.4

Este documento describe la arquitectura técnica integral, los flujos operativos del negocio, las fórmulas matemáticas deterministas, el catálogo de funciones de software, la política de inmutabilidad de precios históricos, la parametrización universal (multi-empresa / multi-taller) y la suite de experiencia (Spotlight, Quick-Peek, Floating Hub y Motor Háptico).

> **Actualizado a v8.9.4.** Desde la v8.7.0 (título original de este manual) se agregaron, entre otras cosas: íconos reales en vez de emojis en Dashboard y Portal Maquilador, confirmación obligatoria al saltar varios pasos en el Kanban, bloqueo del PIN del Portal Maquilador tras 5 intentos fallidos, cierre de 4 huecos de seguridad (ver `SECURITY.md`), y la corrección del cálculo de "Saldo con Andrés" para que todas las pantallas lean el mismo dato (ver fórmula 5 abajo y `AUDIT_NOTEBOOK.md`). El detalle versión por versión vive en `CHANGELOG.md`.

---

## 🏢 1. Modelo Operativo del Negocio (Realidad del Negocio)

El sistema está diseñado para el modelo de intermediación, comercialización y maquila de bolsas plásticas parametrizable para **cualquier empresa, cliente principal y taller maquilador**:

```
                                  [ TALLER MAQUILADOR: {providerName} ]
                                     • Fabrica bolsas por Kilo ($42.00/kg configurable)
                                     • Entrega en bultos/rollos (pesados en báscula)
                                                │
                                                ▼  (Entrega de Kilos en Báscula)
[ CLIENTE PRINCIPAL: {clientName} ] ◄────────────────────────────────────────
  • Emite Órdenes de Compra (OC) por Kilo
  • Paga $43.00/kg (o precio pactado) + 16% IVA
  • Emite Contrarecibo (CR) al recibir factura
                │
                ▼  (Pago de Contrarecibo)
[ EQUIPO CONTABLE / DESPACHO ] ──(Deduce 8% comisión)──► [ CAJA EFECTIVO ]
                                                            • Paga material a {providerName} con Recibo Firmado
                                                            • Reparto 50/50 entre Socios
```

### Reglas Clave Inviolables:
1. **Unidad Universal de Control:** Todo el negocio (compras, ventas, inventario, facturación y entregas) se controla en **KILOS (kg)**.
2. **Precios y Márgenes Estándar e Inmutabilidad Histórica:**
   - Costo de Maquila ({providerName}): **$42.00 / kg** (o costo pactado por OC).
   - Venta a Cliente Principal ({clientName}): **$43.00 / kg** + 16% IVA (o precio pactado por OC).
   - Comisión del Contador: **8.0%** sobre el total facturado con IVA al momento del cobro.
   - Reparto de Utilidades Netas: **50% Socio Administrador / 50% Socio Inversionista**.
   - **Congelación de Precios:** Cada OC y Factura retiene su propio precio snapshot, blindando el historial contable ante futuros cambios de precios en la configuración global.
3. **Control de Contrarecibos:** Ninguna factura se considera en cobro formal sin un número de Contrarecibo (CR) emitido por el cliente.
4. **Liquidación a Maquilador con Recibos y Firmas:** Se audita mediante un Libro Mayor donde cada kilo entregado genera un cargo ($42/kg) y cada entrega de efectivo genera un abono con **Recibo Oficial Impreso para Firma**. Los anticipos se amortizan automáticamente.
5. **Aislamiento Hermético por Departamento:** Los expedientes y contrarecibos se clasifican mediante inferencia jerárquica determinista (`inferDepartment` en `src/lib/finance.ts`), asegurando que $Área_1 + Área_2 = Consolidado$.

---

## 📐 2. Fórmulas Matemáticas y Algoritmos Financieros

Todas las operaciones de cálculo monetario y pesaje se ejecutan con redondeo financiero determinista a 2 decimales (`src/lib/finance.ts` y `src/lib/math.ts`).

### 1. Facturación al Cliente:
$$\text{Subtotal} = \text{Kilos Facturados} \times \text{Precio Venta Unitario (ej. } \$43.00\text{)}$$
$$\text{IVA (16\%)} = \text{Subtotal} \times 0.16$$
$$\text{Total Factura} = \text{Subtotal} + \text{IVA} = \text{Kilos Facturados} \times \$49.88$$

### 2. Comisión del Contador y Cobranza Neta:
$$\text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.08$$
$$\text{Neto a Entrar en Caja} = \text{Total Factura} - \text{Comisión Contador (8\%)} = \text{Total Factura} \times 0.92$$

### 3. Costo de Maquila y Utilidad Neta Real:
$$\text{Costo Proveedor} = \text{Kilos Entregados} \times \text{Costo Unitario Proveedor (ej. } \$42.00\text{)}$$
$$\text{Utilidad Neta Real} = \text{Neto a Entrar en Caja} - \text{Costo Proveedor} - \text{Gastos Operativos Directos}$$

### 4. Reparto de Socios (50/50):
$$\text{Parte Administrador (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$
$$\text{Parte Socio (50\%)} = \frac{\text{Utilidad Neta Real}}{2}$$

### 5. Estado de Cuenta del Proveedor (Amortización de Anticipos y Entregas):
$$\text{Deuda de Material} = \sum (\text{Kilos Recibidos en Báscula} \times \text{Costo Unitario})$$
$$\text{Total Pagado} = \sum (\text{Egresos a Proveedor}) - \sum (\text{Ingresos de Proveedor})$$
$$\text{Saldo Proveedor} = \text{Total Pagado} - \text{Deuda de Material} + \text{Ajuste Histórico}$$

> **Fuente única de verdad:** esta fórmula vive en `src/hooks/useAndresStats.ts` (usado por `/compras`), leyendo `config.historicalDebtAndres` directamente de Ajustes. Cualquier otra pantalla que muestre "Saldo con Andrés" debe leer del mismo campo — una copia local de la configuración que se olvide de incluirlo produce un número distinto y equivocado. Bug real de este tipo encontrado y corregido en v8.9.4 (el Dashboard mostraba un saldo $1,330,509.62 distinto al de Compras).

---

## 🛠️ 3. Catálogo de Módulos y Bibliotecas del Sistema

### 1. `src/lib/hapticEngine.ts` (Motor Háptico & Web Audio API Universal)
- **Funciones:** `triggerHaptic(type)`, `playCashSound()`, `playSuccessSound()`, `playSoftClick()`
- **Descripción:** Síntesis sonora en tiempo real (monedas de caja registradora, campana de éxito, pop táctil) mediante Web Audio API 100% offline, con patrones de vibración para pantallas táctiles.

### 2. `src/components/CommandPalette.tsx` (Spotlight Universal Raycast-Style)
- **Atajo:** `Ctrl + K` / `⌘ + K`
- **Descripción:** Buscador universal con navegación completa por flechas (`↑`, `↓`, `Enter`, `ESC`), acciones ejecutables en 1 toque (Modo Privacidad, Calculadora de Kilos, Balanza de Comprobación, Purga de Pruebas) y búsqueda multi-criterio.

### 3. `src/components/Dashboard/QuickPeekDrawer.tsx` (Smart Quick-Peek Drawer)
- **Descripción:** Panel lateral glassmorphic que se abre en 0.1 segundos para inspeccionar avance de kilos entregados en báscula vs facturados, desglose de facturas y cobro 1-toque sin abrir modales pesados.

### 4. `src/components/FloatingQuickHub.tsx` (Speed-Dial Flotante)
- **Descripción:** Botón flotante `⚡` en esquina inferior con micro-animaciones para disparar Spotlight, Privacidad, Calculadora $/kg, Nueva Orden y Balanza.

### 5. `src/context/PrivacyContext.tsx` (Modo Privacidad Instantáneo con Atajo Global)
- **Atajo:** `Ctrl + H` / `⌘ + H`
- **Descripción:** Alterna al instante el desenfoque esmerilado de todas las cifras monetarias en pantalla con feedback háptico y sonoro.

### 6. `src/hooks/useSystemSettings.ts` (Parametrización Universal)
- **Variables Globales:** `companyName`, `clientName`, `clientShortName`, `providerName`, `providerTitle`, `deptCodeTH`, `deptCodeGT`, `deptNameTH`, `deptNameGT`, `managerTH`, `managerGT`.

### 7. `src/lib/andresReceiptPdf.ts` & `src/lib/andresStatementPdf.ts` (Recibos y Estados de Cuenta Auditados)
- Generación de comprobantes oficiales con firmas autógrafas para el fabricante/maquilador.

---

## 🧩 4. Mapa de Componentes y Vistas Principales

| Ruta / Componente | Propósito Operativo |
|---|---|
| **`/` (`Dashboard.tsx`)** | Cockpit Ejecutivo con Pipeline de 5 Estaciones, Tabla de Contrarecibos con Menús Kebab (⋮) y Quick-Peek, Semáforo Operativo, Panel Black Titanium y Balanza de Comprobación. |
| **`/ordenes` (`Orders.tsx`)** | Expedientes de compra, desglose de partidas, remisiones de entrega, facturación multi-concepto, botón `[🔒 Concluir Pedido]` y prefacturas PDF. |
| **`/cobranza` (`Cobranza.tsx`)** | Tablero Kanban y lista de facturas clasificadas por estatus de Contrarecibo, vencimientos y dinero con el contador. |
| **`/compras` (`Compras.tsx`)** | Control de maquila y libro mayor del fabricante, botón `[📄 PDF Auditado]` con entregas surtidas y generador de recibos para firma. |
| **`/oc` (`OcTracking.tsx`)** | Tablero Kanban de logística de entregas con manifiesto de entrega y firmas logísticas. |
| **`/caja-chica` (`CajaChica.tsx`)** | Flujo de efectivo en 4 pilares: Efectivo en Caja, Por Recibir del Contador (desglose 8%), Cuenta con Proveedor y Reparto a Socios. |
| **`/portal-maquilador` (`MaquiladorPortal.tsx`)** | Portal PIN para celular del taller con semáforo de producción, registro de pesadas y comprobantes de entrega en PDF. |
| **`/centro-control` (`Settings.tsx`)** | Configuración de empresa, proveedor, cliente, departamentos y **Purga Segura de Expedientes de Prueba**. |

---

## 🔒 5. Seguridad, Auditoría y Respaldo de Datos
* **Reglas de Seguridad Firestore (`firestore.rules`):** Control estricto de roles (`admin`, `manager`, `viewer`) y bloqueo de borrado no autorizado. Ninguna regla acepta una sesión autenticada cualquiera (`request.auth != null` a secas) para datos sensibles — ver `SECURITY.md` para el detalle de los 4 huecos cerrados en la auditoría v8.9.2.
* **Bitácora en Vivo (`system_logs` / `LiveLogsModal`):** Registro de cada borrado, creación de facturas y pagos con usuario y timestamp.
* **Respaldos Automáticos:**
  * Respaldos en la nube Firestore con historial de snapshots.
  * Respaldo Total a Excel (`.xlsx`) en 1 clic con 4 pestañas de auditoría.
  * Respaldo Offline HTML de emergencia.
