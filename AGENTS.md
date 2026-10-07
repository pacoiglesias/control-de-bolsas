# 🤖 ANTIGRAVITY — CONTROL DE BOLSAS ERP ENGINE INSTRUCTIONS

**Sistema:** Control de Bolsas ERP — Master Track  
**Versión Base:** v9.10.x Enterprise  
**Empresa Emisora:** Elemental Denim S.A. de C.V. (RFC: EDE1902136T2)  
**Firebase Project:** `control-de-bolsas-89c88` (PROD)  

---

## 🏢 1. Contexto de Negocio y Reglas Financieras

Este sistema administra la operación industrial, logística de báscula, maquila y cobranza de bolsas de polietileno para **Grupo Textil Providencia**:

1. **Precios y Tarifas Oficiales:**
   * **Precio de Venta Oficial:** `$43.00 MXN / kg` + 16% IVA = `$49.88 MXN / kg`.
   * **Tarifas Flotantes de Maquila (Andrés):** No son estáticas ni fijas. Fluctúan por lote, tipo de resina y negociación (ej. `$34` maquila pura, `$37` recuperado económico, `$38` estándar de referencia, `$42` virgen cristal, `$43` pigmentado). Los simuladores deben soportar selección dinámica por presets y lectura desde configuración (`useConfig`).
   * **Comisión de Cobranza (Contador):** `8.0% del SUBTOTAL` (antes de IVA, sobre facturación Providencia).
   * **Convención de Saldos de Andrés (`historicalDebtAndres`):**
     * Positivo (`+`): Saldo a favor de Andrés (anticipos otorgados).
     * Negativo (`-`): Deuda pendiente de la empresa con Andrés.

2. **Órdenes de Compra (OCs) Activas Oficiales:**
   * **GT (Grupo Textil Providencia — Lic. Evelia Castillo / Almacén P4):**
     * **OC Oficial:** `12026439784` (Folio: `43/9784` · Meta: `5,100.00 kg`).
   * **TH (Textil Hogar — Ing. José Nava Flores / Almacén 1):**
     * **OC Oficial:** `120267114302` (Folio: `71/14302` · Meta: `8,000.00 kg`).

---

## ⚡ 2. Directivas de Automatización Extrema para Antigravity

El agente debe operar con máxima autonomía y proactividad:

1. **Ingesta Inteligente de Documentos (OCR / Visión / Archivos):**
   * **Órdenes de Entrega / Remisiones Físicas:**
     * Detectar automáticamente el título `"ORDEN DE ENTREGA"` o remisión sellada.
     * Identificar el folio de remisión (ej. `6439784`), fecha y OC amparada (ej. `12026439784`).
     * **SUMAR TODAS LAS PARTIDAS:** Sumar todas las cantidades de las partidas (ej. 500 kg + 500 kg + 1,000 kg = 2,000 kg), nunca quedarse solo con el primer renglón.
     * Registrar el evento directamente en `deliveries` de la OC con estatus `invoiced: false` ("Entregado pendiente de facturar").
     * Actualizar la fecha programada para la siguiente entrega (`estimatedDeliveryDate` / `nextDeliveryDate`) y los kilos faltantes.
   * **Facturas Timbradas (XML CFDI 4.0 / PDF SAT):**
     * Vincular a la OC correspondiente por número de OC, folios de remisión o montos coincidentes.
     * Marcar las entregas asociadas como `invoiced: true`.
   * **Contrarecibos Oficiales (CR TH / GT):**
     * Extraer folios de factura amparados y actualizar el estado de cobranza a `revisión` o `programado`.
   * **Complementos de Pago SAT (REP / TR):**
     * Conciliar de inmediato la factura como `cobrada` / `pagada` y reflejar el flujo en caja.

2. **Reflejo en Vivo de Métricas:**
   * En todo momento el sistema debe calcular con precisión:
     * `kilosPedidos`: Total pactado en la OC.
     * `kilosEntregados`: Kilos acumulados en báscula (`deliveries`).
     * `kilosFaltantes`: Kilos pendientes de maquilar y enviar (`kilosPedidos - kilosEntregados`).
     * `kilosPendientesFacturar`: Kilos entregados físicamente en planta que aún no tienen factura CFDI timbrada (`kilosEntregados - kilosFacturados`).
     * `proximaEntrega`: Fecha calendarizada para el siguiente envío con los kilos faltantes.

3. **Verificación y Calidad de Código:**
   * Antes de reportar tareas completadas:
     * Ejecutar `npm run build` o `npx tsc --noEmit` para verificar tipos de TypeScript.
     * Ejecutar pruebas unitarias (`npx vitest run`) asegurando que ningún balance financiero se desvíe.
   * Mantener siempre actualizado el changelog en `src/lib/systemChangelog.ts` ante cambios relevantes.
