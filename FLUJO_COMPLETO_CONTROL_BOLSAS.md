# Flujo Completo — Control Bolsas ERP
### Revisión exhaustiva contra el negocio real (v6.14.0)

Este documento describe, paso por paso, tu flujo real de negocio tal como lo explicaste, y para cada paso te digo: **si el sistema ya lo hace, cómo lo hace, y qué encontré que falta o está a medias.**

Léelo con calma. Al final hay una tabla resumen y las sugerencias concretas.

---

## 0. El negocio, en una frase

Andrés te vende bolsas de polietileno. Tú se las revendes a Grupo Textil Providencia (departamentos **TH** y **GT**). Ganas la diferencia entre lo que le pagas a Andrés y lo que le cobras a Providencia, menos la comisión que te cobra el contador por gestionar el cobro.

```
Providencia pide (OC) → tú le pides a Andrés → Andrés entrega (1 o varias veces)
    → facturas lo entregado → Providencia paga → sale el contrarecibo
    → contabilidad te entrega el dinero (menos su comisión) → entra a tu caja
```

---

## 1. Llega el pedido (OC) de Providencia

**Cómo lo describiste:** te llega una Orden de Compra de Providencia (TH o GT), con los artículos, cantidades y precios pactados.

**✅ Lo que ya hace el sistema:**
- `Subir Órdenes` (`/subir`) — puedes pegar el texto del PDF de la OC y el sistema extrae folio, cliente, renglones (código, descripción, cantidad, precio) automáticamente.
- También puedes capturar la OC a mano en `Expedientes` → **Nuevo Pedido**.
- Desde el 31 de julio: **Cliente y Proveedor tienen autocompletado** — ya no hace falta escribir "GRUPO TEXTIL PROVIDENCIA" letra por letra cada vez, ni arriesgarte a que quede escrito distinto entre un expediente y otro.
- **Ya no se puede guardar un expediente sin Cliente o sin Proveedor** — antes sí se podía, por accidente.
- Si el folio ya existe en otro expediente, el sistema te avisa antes de guardar (para no capturar la misma OC dos veces sin darte cuenta).

**Nada pendiente en este paso.**

---

## 2. Se lo mandas a Andrés, empieza a producir, te da fecha de entrega

**Cómo lo describiste:** le pasas la OC a Andrés, él la produce, y te da una fecha estimada de entrega.

**✅ Lo que ya hace el sistema:**
- Campo **"Fecha de Entrega Estimada"** en el expediente (`estimatedDeliveryDate`).
- El expediente nace en estatus **`pedido`**, que es justo "está en producción, todavía no hay nada que facturar" — y desde el Ciclo 25 tiene su propia tarjeta en el Panel Principal: **"📝 Pendiente de Facturar"**.

**Nada pendiente en este paso.**

---

## 3. Andrés puede o no venir por un anticipo, en cualquier momento

**Cómo lo describiste:** mientras produce, Andrés a veces pide un anticipo. No siempre. No depende de que exista todavía una compra formal registrada.

**✅ Lo que ya hace el sistema:**
- **Caja Chica** te deja registrar un egreso con **Proveedor: Andrés** en cualquier momento, exista o no todavía un registro de compra ligado a una OC específica.
- **Estado de Cuenta de Proveedor** (en `Compras`) recoge ese anticipo automáticamente en el saldo — se ve como "a tu favor" (🟢) hasta que llegue mercancía que lo consuma.
- Confirmado con tus datos reales: el anticipo de 145,000 del 21 de julio se refleja correcto en el saldo.

**Nada pendiente en este paso** — pero mira el punto 4, porque ahí es donde el anticipo se "gasta" y encontré algo que revisar.

---

## 4. Andrés entrega — una o varias veces, hasta completar la OC

**Cómo lo describiste:** cuando Andrés tiene lista una entrega, te manda las cantidades de los productos que va a entregar de la OC. Una OC puede tener **una o varias entregas** hasta completarse, y es importante poder darle seguimiento.

**✅ Corregido en v6.14.0 — ya no es un acumulado, es una bitácora real:**

Cada vez que Andrés te avisa, capturas **un evento** en la pestaña Entregas: fecha + cuánto llegó de cada producto. Ya no hay dos sistemas desconectados — la pestaña "Entregas" y el campo "entregado" de Productos ahora son la misma cosa; Productos solo muestra el resultado, de solo lectura.

Cada entrega queda con su propia etiqueta: **📝 Pendiente de facturar** o **✅ Facturada**. Tienes el historial completo de qué llegó y cuándo, no solo un número que vas actualizando.

**Nada pendiente en este paso.**

---

## 5. Con esas cantidades, se hace la factura

**Cómo lo describiste:** con las cantidades que Andrés entrega, elaboras la factura para esa entrega y le das seguimiento al flujo.

**✅ Corregido en v6.14.0 — factura por entrega, no por acumulado:**

El botón **"🧾 Facturar esta entrega"** vive dentro de cada evento de la pestaña Entregas, y factura **solo esa entrega específica** — nunca el total acumulado de la OC. Siguiendo el mismo ejemplo de antes:

- **Entrega 1** (983 kg) → "Facturar esta entrega" → Factura #1 por 983 kg. Queda marcada ✅ Facturada.
- **Entrega 2** (1,000 kg nuevos) → "Facturar esta entrega" → Factura #2 por **1,000 kg** — solo lo nuevo, no los 1,983 kg acumulados.

**La protección es estructural, no depende de la memoria de nadie:** una entrega ya facturada pierde el botón. No hay forma de volver a facturarla dos veces por accidente, ni tuya ni de quien esté usando el sistema contigo.

Si por algún motivo borras una factura, la entrega que la generó vuelve a quedar disponible para facturarse — para que no se quede bloqueada para siempre sin una factura real detrás.

**Nada pendiente en este paso.**

---

## 6. Las facturas entran a revisión, y llega el contrarecibo

**Cómo lo describiste:** las facturas que mandas entran a revisión de Providencia, y después te dan el contrarecibo. Un contrarecibo puede acompañar a varias facturas.

**✅ Lo que ya hace el sistema — y esto sí está verificado contra tus datos reales:**
- El estatus `pending` de una factura es justo "enviada, en espera de que generen el contrarecibo".
- **Cobranza** agrupa automáticamente por número de contrarecibo — confirmado con tu caso real: TR_3583 agrupando las facturas 5927 (92,292.55) y 5928 (89,958.00) = 182,250.55, exacto.
- El panel separa "Te deben" en **facturado-sin-contrarecibo** (136,300 en tu ejemplo real) de **contrarecibo-ya-generado** (1,298,970.48) — la misma distinción que tú llevas en tu propia hoja.

**Nada pendiente en este paso.**

---

## 7. Providencia paga, te descuentan la comisión, vas por el dinero a tu caja

**Cómo lo describiste:** cuando Providencia paga, te cobran una comisión y tienes que ir por el dinero para que entre a tu caja (que le dices "caja chica" pero es tu caja real).

**✅ Lo que ya hace el sistema — verificado al centavo contra tres cobros reales tuyos:**
- Comisión: **8% del subtotal (sin IVA)**. Fórmula confirmada exacta contra el cobro de 153,381.00 → 132,225.00 subtotal × 8% = 10,578.00 de comisión, 142,803.00 depositado — coincide al centavo.
- Al marcar un contrarecibo como **cobrado**, Caja Chica recibe el **depósito real** (factura menos comisión), no la utilidad — corregido específicamente porque antes restaba también el costo del material dos veces.
- Puedes capturar la **referencia de la transferencia** (ej. "TR_3583") por separado del número de contrarecibo (ej. "GT-570"), para conciliar contra tu banco.
- **"↩️ Deshacer Recolección"** si te equivocas al marcar un cobro.

**Nada pendiente en este paso.**

---

## 8. Tu caja real ("Caja Chica")

**Cómo lo describiste:** ahí es donde termina entrando el dinero, y es tu caja de verdad, no una caja chica en el sentido contable estricto.

**✅ Lo que ya hace el sistema:**
- Registra saldo inicial y movimientos con concepto libre.
- Verificado contra tus cuatro movimientos reales: saldo inicial −819.44, +144,945.00, −145,000.00 (adelanto a Andrés), +76,140.00 → saldo final **75,265.56**, exacto.

**Nada pendiente en este paso.**

---

## 📋 Tabla resumen

| # | Etapa | Estado |
|---|---|---|
| 1 | Llega la OC de Providencia | ✅ Completo |
| 2 | Se manda a Andrés, fecha de entrega | ✅ Completo |
| 3 | Anticipo a Andrés (opcional, cualquier momento) | ✅ Completo |
| 4 | Andrés entrega (una o varias veces) | ✅ Completo — corregido en v6.14.0 |
| 5 | Se factura lo entregado | ✅ Completo — corregido en v6.14.0 |
| 6 | Revisión y contrarecibo (puede cubrir varias facturas) | ✅ Completo, verificado con datos reales |
| 7 | Providencia paga, comisión, cobro | ✅ Completo, verificado al centavo |
| 8 | Entra a tu caja real | ✅ Completo, verificado con datos reales |

---

## ✅ Estado al 31 de julio, v6.14.0

Las 8 etapas de tu flujo real están cubiertas y verificadas. Los dos huecos que encontró esta revisión (entregas sin seguimiento por evento, y el riesgo de doble factura en OC con más de una entrega) quedaron corregidos con el mismo diseño que se te presentó y aprobaste: cada entrega es ahora un evento con fecha y productos, y una entrega facturada no puede volver a facturarse — la protección es estructural.

**Antes de confiar en esto con dinero real:** prueba con una OC de verdad que tenga más de una entrega, revisa que las dos facturas salgan correctas y que no se repita ningún kilo. Si algo no se ve como esperas, dímelo con el caso concreto (folios, cantidades) y lo reviso contra tus datos reales, igual que hicimos con la comisión y el saldo de Andrés.

Si en el futuro cambia algo de tu flujo real —un paso nuevo, una regla distinta con Providencia o con Andrés— dímelo y actualizamos este documento junto con el sistema, para que los dos sigan diciendo lo mismo.

