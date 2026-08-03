# Flujo Completo — Control Bolsas ERP
### Revisión exhaustiva contra el negocio real (Actualizado a v6.36.0)

Este documento describe, paso por paso, tu flujo operativo y cómo el ERP lo resuelve de manera exacta, incluyendo las últimas implementaciones de automatización y UI Premium (Kanban Drag & Drop).

---

## 0. El negocio, en una frase

Andrés te vende bolsas de polietileno. Tú se las revendes a Grupo Textil Providencia (departamentos **TH** y **GT**). Ganas la diferencia entre lo que le pagas a Andrés y lo que le cobras a Providencia, menos la comisión que te cobra el contador por gestionar el cobro.

```
Providencia pide (OC) → tú le pides a Andrés → Andrés entrega (Notifica en su Portal)
    → facturas lo entregado → Providencia paga → sale el contrarecibo
    → contabilidad te entrega el dinero (menos su comisión) → entra a tu caja
```

---

## 1. Llega el pedido (OC) de Providencia

**Tu proceso:** Te llega una Orden de Compra de Providencia (TH o GT), con los artículos, cantidades y precios pactados.

**✅ Lo que hace el sistema:**
- `Subir Órdenes` (`/subir`) — pegas el texto del PDF y el sistema extrae folio, cliente y renglones automáticamente.
- `Captura Rápida` (`/captura-rapida`) — permite procesar datos crudos.
- Si el folio ya existe, el sistema te avisa. Cliente y proveedor se autocompletan.

---

## 2. Se lo mandas a Andrés, empieza a producir

**Tu proceso:** Le pasas la OC a Andrés, él la produce, y te da una fecha estimada de entrega.

**✅ Lo que hace el sistema:**
- El expediente nace en estatus **`pedido`** y aparece en la tarjeta **"📝 Pendiente de Facturar"** del Dashboard.
- En la vista **Compras** (`/compras`) puedes ver qué pedidos están pendientes de surtirse por el fabricante.

---

## 3. Anticipos a Andrés (Opcional)

**Tu proceso:** Andrés a veces pide un anticipo antes de entregar.

**✅ Lo que hace el sistema:**
- En **Caja Chica** (`/caja-chica`) registras un egreso a proveedor "Andrés".
- El **Estado de Cuenta con Andrés** automáticamente suma este saldo a tu favor, para descontarlo cuando lleguen las entregas. Todo cuadrando matemáticamente sin intervención manual adicional.

---

## 4. Andrés entrega la mercancía

**Tu proceso:** Andrés entrega la mercancía (una o varias veces por OC).

**✅ Lo que hace el sistema:**
- **Portal Maquilador (`/portal-maquilador`):** Andrés ingresa su PIN, selecciona la orden y reporta los kilos entregados.
- **Notificación en Vivo:** El sistema muestra una notificación en la `BandejaMaquilaWidget` directo en tu Dashboard. Tú solo haces clic en "Ver" y validas.
- Cada entrega es un **evento separado**.

---

## 5. Facturas lo entregado

**Tu proceso:** Facturas exclusivamente las cantidades que Andrés ya te entregó.

**✅ Lo que hace el sistema:**
- Botón **"🧾 Facturar esta entrega"** — factura solo lo recibido, sin sobreescribir totales ni promediar.
- Protecciones estructurales: no puedes refacturar la misma entrega dos veces.

---

## 6. Revisión y Contrarecibo (TR / GT / TH)

**Tu proceso:** Envías facturas a Providencia, las revisan y emiten un contrarecibo que ampara una o varias facturas.

**✅ Lo que hace el sistema:**
- **Tablero Kanban Drag & Drop (`/cobranza`):** Arrastras la factura de la columna "En Revisión" a "Por Cobrar".
- Al soltarla, el sistema te pide el número de Contrarecibo (ej. TH-836).
- Agrupación visual automática: las facturas con el mismo contrarecibo viajan juntas.

---

## 7. Cobro y depósito en Caja Chica

**Tu proceso:** Providencia paga, el contador descuenta su 8% de comisión y te deposita el restante en tu caja real.

**✅ Lo que hace el sistema:**
- En el tablero Kanban, arrastras la tarjeta hacia la columna amarilla **"🟡 Con el Contador"** (Providencia pagó) y finalmente a la columna verde **"✅ En Caja Chica"**.
- **Magia de Sincronización:** Al soltar en la columna verde, el sistema descuenta matemáticamente el 8% de comisión e **inyecta el ingreso líquido directamente a la CAJA CHICA**.
- Tu saldo de caja cuadra al centavo. Si te equivocas y mueves la tarjeta de regreso, el sistema genera automáticamente un egreso de reversión.

---

## ✅ Conclusión del Flujo (v6.36.0)

Todas las etapas están cubiertas con automatización, sincronización atómica de bases de datos y una interfaz moderna. El flujo de dinero está garantizado sin necesidad de doble captura.


