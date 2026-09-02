# 📘 DOSSIER TÉCNICO & COMERCIAL MAESTRO
## BOLSAS ELEMENTAL ERP (ENTERPRISE EDITION v9.1.0)
### *Sistema Integral de Control de Cadena de Suministro, Báscula Industrial, Conciliación Tripartita (3-Way Match) y Flujo Financiero de Proveedores de Grandes Cadenas*

---

## Executive Summary (Resumen Ejecutivo)

**Bolsas Elemental ERP** es una plataforma tecnológica de grado industrial diseñada para resolver el problema más crítico y costoso de los fabricantes, maquiladores y proveedores que surten a grandes corporativos textiles y comerciales (como Grupo Textil Providencia, Liverpool, Walmart o Palacio de Hierro): **el descontrol entre lo que se fabrica, lo que pesa la báscula de patio, lo que se factura y lo que realmente pagan los contrarecibos**.

El sistema elimina el error humano, las mermas fantasmas, los desfases de centavos en el IVA y las facturas extraviadas en los portales corporativos, sustituyendo hojas de cálculo desarticuladas por una **arquitectura en la nube en tiempo real con latencia cero percibida, motor háptico sensorial y precisión matemática pura**.

---

## 💎 Propuesta de Valor Comercial (Para Venta / Licenciamiento)

1. **Recuperación Inmediata de Cartera (Cero Facturas Perdidas):**
   * Automatiza la extracción de contrarecibos desde portales corporativos de proveedores.
   * Evita que facturas entregadas se queden sin tramitar o venzan sin seguimiento.
2. **Conciliación Tripartita Blindada (3-Way Match Universal):**
   * Cruza en tiempo real: **Orden de Compra (OC) ⟷ Remisión de Báscula ⟷ Factura Fiscal (CFDI 4.0) ⟷ Contrarecibo Oficial**.
   * Bloquea matemáticamente cualquier intento de facturar kilos de más o registrar mermas injustificadas.
3. **Flujo de Caja y Rentabilidad Transparente en Tiempo Real:**
   * Desglosa en cada kilo entregado: **Costo de Maquila ($38.00/kg) + Comisión del Contador (8%) + Margen Libre en Caja ($8.44/kg)**.
   * El director o dueño conoce su utilidad líquida segundo a segundo.
4. **Operación Multi-Dispositivo (Desktop, Tablet y Celular en Patio):**
   * Los operadores de báscula pesan y capturan remisiones desde cualquier teléfono inteligente, con vibración háptica de confirmación táctil y funcionamiento 100% resiliente a fallas de internet (PWA Offline).

---

## 🏗️ Arquitectura Técnica y Stack de Alto Rendimiento

El sistema está construido bajo los estándares más altos de la industria moderna (equivalente al stack de **Vercel, Linear y Stripe**):

| Capa Tecnológica | Especificación | Ventaja Competitiva |
| :--- | :--- | :--- |
| **Frontend Core** | **React 18 + TypeScript 5 Estricto** | Código 100% tipado, libre de `any`, modular y desacoplado. |
| **Empaquetado & Bundling** | **Vite 5.4** | Carga ultra veloz (<1 segundo), HMR instantáneo y PWA precacheada. |
| **Base de Datos & Tiempo Real** | **Google Firebase Cloud Firestore** | Sincronización bidireccional en milisegundos con listeners reactivos. |
| **Backend & Microservicios** | **Cloud Functions para Firebase (Node.js 22)** | Lógica sensible ejecutada en servidor aislado con seguridad IAM. |
| **Seguridad & Permisos** | **Firebase Auth + RBAC** | Roles jerárquicos estrictos (`admin`, `manager`, `viewer`, `maquilador`). |
| **Efectos Sensoriales** | **Web Audio API + Web Haptics API** | Sonidos sintetizados en tiempo real (cero archivos MP3) y 7 firmas de vibración háptica en móviles. |
| **Generación de Reportes** | **PDFKit / jsPDF + ExcelJS** | Generación de Estados de Cuenta ejecutivos, prefacturas y libros maestros `.xlsx` multi-hoja en el navegador. |
| **Integridad & Testing** | **Vitest (139 Pruebas Unitarias)** | Validación matemática de punto flotante, límites de OC y deduplicación. |

---

## 🔄 El Ciclo Operativo de 5 Estaciones (Pipeline Financiero)

El corazón operativo del ERP modela con exactitud el ciclo de vida del dinero:

```
[ PASO 1 ] 🏭 EN PRODUCCIÓN (ANDRÉS / TALLER)
            └── Kilos autorizados en la OC pendientes de manufactura física.
                   │
[ PASO 2 ] 🚚 ALMACÉN & BÁSCULA (PATIO CLIENTE)
            └── Kilos pesados y recibidos físicamente pendientes de facturar.
                   │
[ PASO 3 ] 🧾 FACTURADO SIN CONTRARECIBO (EN REVISIÓN)
            └── CFDIs emitidos subidos a revisión en el portal de Providencia.
                   │
[ PASO 4 ] 🗂️ CRÉDITO CON CONTRARECIBO (CARTERA ACTIVA)
            └── Contrarecibo oficial emitido con fecha límite de pago (30 días).
                   │
[ PASO 5 ] 💵 EN CAJA CHICA (LIQUIDEZ EN MANO)
            └── Contrarecibo pagado por Providencia, cobrado y neto en caja.
```

---

## 🧭 Catálogo Módulo por Módulo y Funcionalidad Detallada

### 1. MÓDULO DASHBOARD EJECUTIVO MAESTRO (`/`)
* **Hero Suite de 4 Pilares:** Monitoreo en vivo de *Por Cobrar*, *Saldo en Caja*, *Cuenta Corriente del Maquilador* y *Kilos Totales*.
* **Asistente Matutino de 3 Tareas:**
  1. Recordatorio 1-clic por WhatsApp del contrarecibo más próximo a vencer.
  2. Alerta y asignador atómico de facturas en revisión sin contrarecibo.
  3. Estado de entregas del maquilador y saldo consolidado a favor.
* **Simulador Semanal de Flujo de Efectivo:** Proyecta semana por semana los depósitos de cobranza esperados, la retención bancaria del contador y las toneladas de bolsa que la empresa puede comprar con esa liquidez.
* **Separador Departamental Atómico (TH vs GT):** Filtro instantáneo para auditar por separado **Textil Hogar** (`TH-`, Nava) y **Grupo Textil Providencia** (`GT-`, Evelia / Planta 4).

### 2. MÓDULO EXPEDIENTES Y ÓRDENES DE COMPRA (`/ordenes`)
* **Gestión Documental Completa:** Registro y visualización de OCs con partidas, tolerancias, precios de compra y venta.
* **Tablero Kanban Interactivo:** Arrastre táctil de pedidos entre fases operativas con sonido háptico de confirmación.
* **Cierre Corto de OC (`isClosedShort`):** Permite cerrar formalmente una OC que no surtirá más kilos, congelando su saldo sin generar faltantes ficticios.

### 3. MÓDULO SEGUIMIENTO POR OC (`/oc`)
* **Trazabilidad Forense:** Kilos Pedidos vs Kilos Entregados en Báscula vs Kilos Facturados vs Kilos Cobrados.
* **Barras de Combustible (`KilosFuelBar`):** Visualización gráfica por producto de la merma o remanente por entregar.
* **Vouchers de Remisión PDF:** Emisión de comprobantes de remisión listos para imprimir o enviar al chofer.

### 4. MÓDULO BÁSCULA & ENTREGAS RÁPIDAS (`/captura-rapida`)
* **Captura de Patio Industrial:** Diseñado para pantalla táctil en caseta de vigilancia o báscula de camiones.
* **Cálculo Automático de Tara y Kilos Netos:** Registro por partida con selector inteligente de catálogo de SKUs.
* **Resguardo de Excedentes:** Si una entrega supera los kilos de la OC, el sistema los coloca en resguardo en patio para asignación a la siguiente orden.

### 5. MÓDULO COBRANZA & CONTRARECIBOS (`/cobranza`)
* **Padrón Oficial Canónico:** Control de los contrarecibos vigentes con alertas de vencimiento por semáforo cromático.
* **Calendario Interactivo de Cobro:** Vista de calendario mensual para visualizar qué día exacto cae cada pago.
* **Monitor Fiscal REP:** Generador automático de solicitudes por WhatsApp para que el contador emita el Complemento de Recepción de Pagos (CFDI de Pago) al liquidarse un contrarecibo.
* **Auto-Conciliador de Portales:** Permite copiar la tabla del portal web de Providencia y pegarla directamente; el ERP extrae los números de contrarecibo, montos y fechas de vencimiento sin teclear nada.

### 6. MÓDULO COMPRAS & MAQUILADOR ANDRÉS (`/compras`)
* **Libro Mayor de Maquila:** Registro de anticipos otorgados, kilos recibidos en báscula y liquidación de costos a $38.00/kg.
* **Comprobantes Oficiales de Abono:** Generación en PDF del recibo formal de transferencia bancaria y botón directo para notificar al maquilador por WhatsApp.
* **Cero Mermas de Taller:** Todo kilo entregado se computa íntegro a favor del maquilador.

### 7. MÓDULO CAJA CHICA & EFECTIVO (`/caja-chica`)
* **Arqueo y Libro de Entradas/Salidas:** Control de gastos menores, fletes, maniobras y retiros de utilidades con balance matemático en tiempo real.

### 8. MÓDULO AUDITORÍA & CENTINELA CRIPTOGRÁFICO (`/audit`)
* **Centinela Silencioso (Zero-Noise Health Engine):** Ejecuta 5 capas de auto-diagnóstico en segundo plano; si todo está al 100% permanece invisible, y solo alerta si surge una anomalía real.
* **Auditoría de Integridad SHA-256:** Sella cada movimiento con firma hash criptográfica para evitar alteraciones fraudulentas en la base de datos.
* **Herramienta de Auto-Sanación de Base de Datos:** Detecta y purga expedientes huérfanos o duplicados con 1 solo clic.

### 9. MÓDULO MINERÍA & BUSINESS INTELLIGENCE (`/mining`)
* **Análisis Predictivo de Demanda:** Tendencias de consumo mensual de polietileno, historial de pedidos por cliente y temporadas altas.

### 10. MÓDULO PORTAL DEL MAQUILADOR (`/portal-maquilador`)
* **Acceso Seguro para el Taller:** Portal web ligero y responsive para que el taller consulte desde su teléfono móvil las órdenes abiertas, partidas pendientes por surtir y entregas validadas.

---

## ⚡ El Botón Flotante Global (`GlobalSpeedFab`)

Ubicado en la esquina inferior derecha (con elevación táctil inteligente que respeta la barra inferior en teléfonos móviles), permite disparar las **6 operaciones clave del negocio sin cambiar de pantalla**:

1. **➕ Nueva Orden (OC):** Registro inmediato de pedidos.
2. **⚖️ Báscula & Entregas:** Acceso directo a pesaje de patio.
3. **📄 Pegar XML / Contrarecibo:** Modal de ingesta universal de documentos.
4. **💬 Centro WhatsApp:** Lanzador de plantillas oficiales para Contadores, Providencia y Andrés.
5. **🧮 Calculadora $/kg:** Simulador dinámico de márgenes y comisiones.
6. **📊 Descargar Excel Maestro:** Exportación completa de la base de datos en un libro `.xlsx` con hojas de trabajo interconectadas.

---

## 🔒 Candados de Negocio Inviolables (Patentables)

1. **Topes de Entrega de Maquila:** Es físicamente imposible registrar entregas que superen los kilos de la OC; cualquier exceso queda en resguardo.
2. **Cero Mermas:** El proveedor cobra exactamente lo que pesa la báscula de entrada.
3. **Separación Departamental Estricta:** Textil Hogar (`TH-`) y Grupo Textil Providencia (`GT-`) tienen expedientes, almacenes, autorizadores y contrarecibos 100% aislados.
4. **Centinela Anti-Duplicados en Memoria:** Conjuntos de control `seenCrs` y `seenSinCrInvoices` que garantizan que ninguna factura o contrarecibo se contabilice dos veces.

---

## 💼 Perfil Comercial y Casos de Éxito de Venta

* **A quién venderle este ERP:**
  * Maquiladores y fabricantes de bolsa de polietileno, cartón, tarimas o empaque industrial.
  * Proveedores medianos de grandes tiendas de autoservicio y departamentales que batallan con el cobro de contrarecibos a crédito (30, 60 y 90 días).
  * Despachos contables que gestionan la facturación y cobranza de empresas de manufactura.
* **Modelo de Negocio Recomendado:**
  * **SaaS (Software as a Service):** Suscripción mensual de $2,500 a $6,000 MXN / mes por empresa.
  * **Licencia Perpetua / Enterprise:** Venta de instancia privada instalada en el Firebase del cliente ($80,000 a $150,000 MXN).

---

*© 2026 Bolsas Elemental ERP. Todos los derechos reservados. Arquitectura de Alta Disponibilidad para la Industria Textil y de Manufactura.*
