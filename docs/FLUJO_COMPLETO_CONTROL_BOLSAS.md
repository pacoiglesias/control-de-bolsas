# Flujo Completo — Control Bolsas ERP
### Revisión exhaustiva contra el negocio real (Actualizado a v8.9.4)

> El flujo operativo y las fórmulas descritas abajo siguen vigentes tal cual desde v8.5.0. Los cambios posteriores fueron de seguridad, consistencia visual y corrección de un cálculo duplicado ("Saldo con Andrés") — ver `CHANGELOG.md` para el detalle versión por versión.

Este documento describe, paso por paso, el flujo operativo y financiero exacto del negocio, detallando cómo el ERP lo modela de principio a fin, incluyendo las herramientas de automatización, generación de reportes PDF oficiales y el Cockpit Modular del Dashboard.

---

## 0. El Negocio en una Frase

Andrés fabrica y te vende bolsas y película de polietileno a costo base (**$42.00/kg**). Tú se las revendes a Grupo Textil Providencia SA de CV (departamentos **TH** y **GT**) a precio pactado (**$43.00/kg + 16% IVA**). La ganancia neta líquida resulta de la diferencia entre venta y costo de maquila, deduciendo el **8% de comisión contable sobre subtotal** y gastos de flete/caja chica, para distribuirse al **50% Paco / 50% Socio**.

```text
OC Providencia ➔ Pedido Andrés ($42/kg) ➔ Entrega en Báscula ➔ Factura SAT ($43/kg + IVA)
    ➔ Contrarecibo (CR) ➔ Cobro Providencia ➔ Comisión Contador (8%)
    ➔ Ingreso Neto a Caja Chica (TR_xxxx) ➔ Reporte P&L & Reparto 50/50
```

---

## 1. Llega la Orden de Compra (OC) de Providencia

**Proceso Real:** Recibes una Orden de Compra de Providencia por correo, PDF o WhatsApp, con partidas, especificaciones, claves y kilos nominales.

**✅ Lo que hace el ERP:**
- **`[➕ Nuevo Expediente]`** o **Pegado Mágico (`Ctrl+P`)**: extrae y procesa los datos crudos en segundos.
- Asigna folio único (`OC-XXXX`) y calcula los kilos y montos proyectados.
- Nace el **Stepper de 6 Etapas** dentro de la orden (`OC Recibida ➔ Pedido Andrés ➔ Entrega Directa ➔ Factura SAT ➔ Contrarecibo ➔ Cobrado en Caja`).

---

## 2. Pedido de Fabricación a Andrés ($42.00/kg)

**Proceso Real:** Le envías las especificaciones a Andrés para extrusión y corte de polietileno.

**✅ Lo que hace el ERP:**
- En la pestaña **"Pedido a Andrés"**, genera la orden de maquila calculando los kilos necesarios.
- Botón **`[💬 WhatsApp]`**: genera la ficha técnica en un mensaje formateado listo para enviar a Andrés.
- En el Dashboard, el monto se contabiliza en la estación **"1. En Taller de Andrés"** del Pipeline de Flujo de Dinero.

---

## 3. Anticipos y Cuenta Corriente con Andrés

**Proceso Real:** Pagos y anticipos para material o liquidación de entregas.

**✅ Lo que hace el ERP:**
- En **Compras (`/compras`)** o **Caja Chica (`/caja-chica`)**, se registran egresos directos a Andrés.
- **Libro Mayor de Andrés:** Aplica automáticamente las amortizaciones de kilos entregados (`kilos * $42`) contra los anticipos y la deuda histórica, manteniendo el saldo al centavo.

---

## 4. Andrés Entrega en Báscula de Providencia

**Proceso Real:** El chofer descarga en el almacén de Providencia y recibe la remisión pesada y sellada.

**✅ Lo que hace el ERP:**
- **Pestaña "Entregas":** Registras la remisión con fecha y kilos netos de báscula.
- **Cierre Rápido por Menos Kilos:** Si Andrés entregó menos kilos del pedido original y no habrá más surtido, el botón **`[🔒 Concluir Pedido]`** ajusta el expediente eliminando alertas de kilos faltantes.
- En el Dashboard, los kilos entregados pasan inmediatamente a la estación **"2. En Almacén Providencia (Por Facturar)"**.

---

## 5. Facturación SAT (CFDI 4.0) a Precio de Venta ($43.00/kg + IVA)

**Proceso Real:** Emisión de la factura electrónica por los kilos entregados.

**✅ Lo que hace el ERP:**
- **Facturación Rápida Multi-Partida (`F` o `[⚡ Facturar]`):** Permite seleccionar exactamente qué partidas y cuántos kilos ampara la factura.
- Validador anti-duplicados (impide capturar 2 veces el mismo folio).
- Genera la **Prefactura PDF SAT** oficial para cotejo contable previo.

---

## 6. Radicación de Contrarecibo (CR) y Crédito

**Proceso Real:** Providencia valida la factura y entrega el Contrarecibo físico con fecha de pago programada.

**✅ Lo que hace el ERP:**
- **Asignador Multi-Factura de Contrarecibos:** Casillas de verificación para asociar 2 o más facturas al mismo contrarecibo y asignar presets rápidos de vencimiento (`+8 días`, `+15 días`, `+30 días`).
- **Timeline y Semáforo de Cobranza:** Clasifica las facturas en **Vigentes** y **Vencidas** con alertas de vencimiento para seguimiento oportuno.
- **Estado de Cuenta Oficial Providencia (PDF):** En `/cobranza`, botón **`[📄 Descargar Estado de Cuenta (PDF)]`** con membrete fiscal, detalle de facturas y libro mayor de depósitos.

---

## 7. Cobro, Comisión Contable (8%) y Depósito a Caja Chica

**Proceso Real:** Providencia transfiere los fondos; el contador descuenta el 8% de comisión contable sobre subtotal y deposita el neto en efectivo.

**✅ Lo que hace el ERP:**
- Al registrar el cobro (vía botón **`[💵 Recibir]`** o modal de cobranza), el sistema calcula:
  $$\text{Neto a Caja} = \text{Total Factura} - (\text{Subtotal} \times 0.08)$$
- Inyecta automáticamente el asiento de ingreso en **Caja Chica** con folio de transferencia `TR_xxxx`.
- Actualiza el **Reporte Ejecutivo de Utilidad Neta & P&L (PDF)** con el reparto **50% Paco / 50% Socio**.

---

## ✅ Conclusión y Auditoría del Sistema (v8.9.4)

El sistema garantiza trazabilidad matemática total, inmutabilidad de precios históricos, exportaciones a Excel/JSON y generación de documentos PDF ejecutivos y fiscales con un solo clic.



