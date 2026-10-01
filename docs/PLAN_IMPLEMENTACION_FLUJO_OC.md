# 📋 PLAN MAESTRO: FLUJO INTEGRAL DE OC, PRECIOS FLUCTUANTES Y OPTIMIZACIÓN DEL SISTEMA

Este plan aborda la solicitud completa:
1. **Detección y gestión ágil de precios fluctuantes** (costo de compra $37/$38/$43 y precio de venta variable).
2. **Flujo integral de punta a punta de la OC** (captura -> pedido a Andrés -> entrega báscula -> remisión/factura -> revisión -> contrarecibo -> cobranza -> finiquito).
3. **Manejo de variantes y contingencias del camino** (mermas tolerables, excedentes, recortes de Providencia, facturas rechazadas).
4. **Implementación de las mejoras técnicas de la auditoría** (Centinela en vivo, optimización de bundles y lazy loading).

---

## 🧭 Fases de Implementación

### Fase 1: Detección y Gestión de Precios Fluctuantes en OC
- [ ] **1.1 Detector y Confirmador de Precios en `OCPreviewModal` y `applyParsedOC`:**
  - Extraer y destacar el Precio Unitario de Venta detectado en la OC (ej. $43.00, $37.00, $44.50).
  - Incluir selector interactivo inmediato de Precio de Compra / Costo pactado con Andrés (botones rápidos `$37.00`, `$38.00`, `$43.00` + campo personalizado).
  - Previsualización en tiempo real del Margen Bruto ($/kg) y Utilidad Neta Proyectada antes de aplicar al expediente.
  - Asegurar que al aplicar la OC, `customSellPrice` y `customCostPrice` se guarden automáticamente en el expediente.
- [ ] **1.2 Selector Rápido de Precios en `TabResumen` y `OrderModal`:**
  - Indicador visual tipo píldora en la cabecera del expediente: *"Venta: $43.00 | Costo: $38.00 | Margen: +$5.00/kg (11.6%)"*.
  - Edición rápida en 1 clic de ambos precios con recalculo instantáneo de la deuda con Andrés y proyección de cobranza.

### Fase 2: Pipeline Visual del Ciclo de Vida de la OC (`OCLifecycleTracker`)
- [ ] **2.1 Stepper Operativo de 8 Pasos en el Expediente:**
  1. 📄 **OC Recibida & Precios Fijados** (Venta & Costo confirmados).
  2. 🏭 **Pedido a Andrés** (Botón para enviar orden de maquila por WhatsApp / PDF).
  3. ⚖️ **Entregas en Báscula** (Kilos acumulados vs pedidos, semáforo de merma <2%).
  4. 📑 **Remisión / Prefactura** (Kilos reales recibidos listos para timbrar).
  5. 🔍 **Factura en Revisión Providencia** (Control interno y fecha promesa).
  6. 🎟️ **Contrarecibo Obtenido** (Fecha de pago programada confirmada).
  7. 💰 **Cobranza Recibida** (Liquidación de factura en banco/caja).
  8. 🏁 **Cierre & Finiquito** (Conciliación final con Andrés y archivo).
- [ ] **2.2 Botón de 1 Toque "📲 Pedir a Andrés" (`WhatsAppOrderModal` / PDF de Maquila):**
  - Genera el texto listo para copiar o enviar a WhatsApp con los kilos pactados, medidas, fecha límite y precio acordado ($/kg).

### Fase 3: Variantes Operativas y Contingencias en el Camino
- [ ] **3.1 Asistente de Cierre Rápido por Merma Tolerable (<2%):**
  - Si la orden lleva ≥98% entregado y faltan <150 kg, ofrecer cierre formal automático con acta de finiquito para que no quede como orden zombie.
- [ ] **3.2 Manejo de Sobre-Entrega / Excedente:**
  - Si Andrés entrega más de los kilos pedidos, avisar si se factura el excedente a Providencia o si se queda como crédito.
- [ ] **3.3 Manejo de Facturas Rechazadas en Revisión:**
  - Botón para reasignar folio de factura y actualizar notas de revisión sin perder el historial de entregas.

### Fase 4: Implementación de las Mejoras Técnicas de la Auditoría
- [ ] **4.1 Semáforo Centinela en Vivo (Health Pill):**
  - Indicador de salud de datos en la barra superior del Dashboard / SpeedFab que ejecuta `runContinuousAutoAudit` y avisa si hay descuadres.
- [ ] **4.2 Optimización de Rendimiento Frontend (Lazy Loading de PDFs y OCR):**
  - Cargar bajo demanda `html2pdf.js` y utilidades pesadas de generación documental para acelerar la carga en móviles y planta.
- [ ] **4.3 Script de Versionado Unificado:**
  - Script `npm run version:bump` para mantener sincronizado `package.json` y `functions/package.json`.

---

## 🧪 Criterios de Aceptación y Pruebas
1. Detección y cambio ágil de precios de compra ($37, $38, $43) y venta reflejados en todo el sistema sin fallos.
2. Suite de pruebas unitarias al 100% (212/212 o superior con nuevos tests).
3. Cero errores de TypeScript y cero advertencias de ESLint.
4. `scripts/audit.sh` aprobado con 7/7 checks en verde.
