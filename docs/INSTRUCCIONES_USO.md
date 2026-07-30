# Manual de Uso Maestro: ERP Control de Bolsas (v5.7.0)

> **Cambios de la v5.7.0 que conviene conocer**
> - **Tamaño máximo de archivo: 5 MB.** Es el límite real que alcanza a leer la IA. Si un PDF pesa más, el sistema lo deja en «Revisión manual» explicando el motivo, en vez de descartarlo en silencio como hacía antes.
> - **Altas de usuario:** al dar de alta a un empleado se le envía un correo de verificación. **Tiene que abrirlo antes de poder entrar.** Es un requisito de las reglas de seguridad y no se puede saltar.
> - **Catálogo:** la pantalla ya carga. Se alimenta sola con las partidas de los expedientes que vas guardando.


Bienvenido a tu sistema automatizado de Control de Bolsas. Este manual detalla de la "A a la Z" todos los flujos operativos, las automatizaciones de inteligencia artificial, y cómo el sistema conecta tus ventas con tus deudas y gastos sin que tengas que capturar las cosas dos veces.

---

## 1. Órdenes de Venta: El Inicio de Todo

### A. Subir pedidos automáticamente (Con Inteligencia Artificial)
1. Ve al menú **"Subir Órdenes"**.
2. Arrastra los PDFs de las Órdenes de Compra (OC) que te mandaron los clientes.
3. El sistema mandará llamar a **Gemini (Inteligencia Artificial)**, el cual va a leer y extraer: Folio, Cliente, Kilos Totales y una **tabla con el detalle exacto de artículos, cantidades y precios**.
4. Un indicador sonoro te avisará cuando termine. El expediente se habrá creado solo.

### B. Crear un pedido manualmente (Sin PDF)
Si te pasaron un pedido por teléfono o WhatsApp:
1. Ve a **"Órdenes / Ventas"**.
2. Arriba a la derecha dale clic en **"+ Nuevo Pedido"**.
3. Se abrirá el expediente en blanco para que tú mismo llenes el Cliente, Folio y agregues los artículos a la tabla.

---

## 2. El Expediente Perfecto (Fijar Utilidades Inmutables)

Una vez creado el expediente (ya sea por IA o a mano), dale clic en "Órdenes / Ventas" para abrirlo. 

### A. Confirmar el Costo y la Comisión
1. En la primera pestaña (**Resumen**), verifica que los artículos estén correctos.
2. **¡PASO CRÍTICO!** Escribe a cómo le vas a comprar la mercancía a tu fabricante en el campo **Costo de Compra (Andrés)**.
3. El campo **Comisión (%)** ya vendrá pre-cargado desde tu pantalla de Configuración. Si para este cliente en particular acordaste una comisión distinta, cámbiala ahí mismo.
4. **Dale clic a Guardar**. Al hacerlo, el sistema le tomará una "fotografía" (Snapshot) a estos números. Si en el futuro la comisión general o tus costos suben, **este expediente jamás alterará su rentabilidad histórica**.

---

## 3. Entregas, Facturación y Contrarecibos

Cuando vayas avanzando con el pedido, entra al expediente:
- **Entregas:** Pestaña para ir sumando cuántos kilos le mandas físicamente al cliente. El sistema te dice el remanente. Aquí puedes descargar un "PDF de Remisión" para que te lo firmen.
- **Facturas:** Pestaña donde subes los XML o PDFs de tus facturas y metes su importe total neto. **El sistema usa la Regla de Oro del IVA:** La utilidad final de tu factura asume que el IVA cobrado se queda contigo como ganancia líquida `(Utilidad = Total Facturado - Costos - Comisión)`.
- **Contrarecibos (Cobranza):** Si el cliente te agrupa varias facturas bajo un número de Contrarecibo (ej. GT-123), se lo asignas en la pestaña de Cobranza del expediente.

---

## 4. Pago a Fabricantes (Deudas y Automatización)

No tienes que capturar tus deudas. El sistema lo hace por ti.

1. **La Deuda Automática:** En el momento exacto en que guardaste una Venta con Kilos Facturados y tu "Costo de Compra", el sistema se fue calladito a la pantalla de **"Compras"** y sumó esa deuda a Andrés.
2. **Consultar y Pagar:** Ve a **"Compras"** en el menú izquierdo. Verás tu deuda global.
3. Dale clic a la operación que le vas a abonar a Andrés.
4. En el modal, anota en **Pagado (Anticipo)** el dinero que le vas a transferir o dar en efectivo.
5. **Dale a Guardar**.

---

## 5. Caja Chica (Gastos Automatizados)

El sistema vigila tu flujo de efectivo en la pantalla de **Caja Chica**. 
1. **Egreso Automático:** Cuando le diste "Guardar" al pago de Andrés en el paso anterior, ¡Pum! El sistema registró solito un gasto en la Caja Chica llamado "Pago a proveedor Andrés". 
2. **Ingreso Automático:** Cuando cobres una factura (ver siguiente punto) y el dinero esté en tus manos, se inyectará como un ingreso en esta misma caja.
3. **Gastos Manuales:** Obviamente, aquí también puedes agregar tus propios gastos operativos (gasolina, viáticos, sueldos) manualmente.

---

## 6. Cobranza Inteligente (Flujo de 3 Estados)

Ve al menú **"Cobranza"**. Aquí ves el dinero que te deben tus clientes. El sistema usa 3 estados con colores:
* 🔴 **Por Cobrar:** La factura la tiene el cliente.
* 🟡 **Con el Contador:** El cliente ya depositó, pero el dinero cayó en la cuenta del contador y no te lo ha dado.
* 🟢 **Cobrada:** El dinero físico ya lo recibiste y está en tu cuenta.

### Cobro Rápido y Rentabilidad Líquida
- Si agrupaste facturas con un **Contrarecibo (GT-xxx)**, verás un bloque amarillo hermoso con una **"Rentabilidad Líquida Real"** que te dice exactamente en porcentaje y pesos cuánto te quedó libre quitando a Andrés y al Contador.
- Puedes darle clic al botón "💰 Cobrar Todo el Contrarecibo" y el sistema liquidará todas sus facturas de un solo golpe.

---

## 7. Catálogo (Semáforo Predictivo)

Ve al menú **"Catálogo"**.
El sistema lleva una bitácora del precio al que has vendido cada uno de tus productos.
- 🟢 **Verde:** ¡Felicidades! Lograste subirle el precio de venta a este producto frente a su promedio histórico.
- 🟡 **Amarillo:** Lo estás vendiendo exactamente al mismo precio de siempre.
- 🔴 **Rojo:** ¡Cuidado! Le bajaste el precio a este producto comparado con el pasado.

---

## 8. Funciones Clave de Master Admin

* **Monitoreo Live de Bitácora:** Ve a `Logs`. Verás una consola en tiempo real (Live) donde aparecerá cada movimiento que haga cualquier usuario en otra computadora al instante.
* **Búsqueda Global:** Presiona `Ctrl + K` en cualquier lugar para buscar a la velocidad de la luz cualquier folio o cliente.
* **PWA (App):** Instálalo como aplicación desde tu navegador Chrome/Safari.
* **Respaldo Offline:** Ve a `Respaldo`. Descarga tu HTML portátil. Podrás revisar tus expedientes en un avión sin internet y calculará las utilidades respetando tus configuraciones de comisiones inmutables y reglas de IVA.

---

## 9. Casos Prácticos de la Vida Real (Ejemplos)

Para que todo quede 100% claro, aquí tienes 3 ejemplos comunes de tu día a día:

### Caso 1: Una Venta Común (El Flujo del Dinero)
* **La Acción:** Le vendes 1,000 kilos a "Bolsas Juanito" a $75.00 el kilo. Tu costo con Andrés es de $42.00, y le pagas al Contador un 6% de comisión. El sistema calcula que cobraste $75,000 + IVA = **$87,000 totales**.
* **Lo que hace el sistema por detrás:**
  1. Congela el costo de $42 y el 6% para este pedido (así si mañana subes el precio a Andrés a $45, la venta de Juanito no se descuadra).
  2. Genera una deuda en la pestaña **Compras** por **$42,000** (1,000 kg x $42) a favor de Andrés.
  3. Calcula tu Utilidad Líquida usando la Regla de Oro: `$87,000 (Facturado) - $42,000 (Andrés) - $5,220 (Contador) = $39,780 libres para ti`.

### Caso 2: El Contador retiene el dinero
* **La Acción:** El cliente "Bolsas Juanito" te avisa que ya transfirió los $87,000, pero los mandó a la cuenta de tu Contador. 
* **Lo que tú haces:** Vas a "Cobranza", buscas la factura de Juanito y la pasas al estado 🟡 **"Con el Contador"**.
* **Lo que hace el sistema:** Mueve ese dinero a tu widget del Dashboard que dice *"Dinero con el Contador"*. Tú sabes que ese dinero existe, pero aún no te lo puedes gastar porque no lo tienes físicamente.
* **El desenlace:** Tres días después, el Contador te hace la transferencia descontando su comisión. Vuelves a la factura y la pasas a estado 🟢 **"Cobrada"**. En ese instante, el dinero líquido entra oficialmente a tu **Caja Chica**.

### Caso 3: Liquidando deudas con Andrés
* **La Acción:** Hoy es viernes de pagos. Ves en tu pantalla de **Compras** que a Andrés le debes $100,000 de tres pedidos distintos. Le haces una transferencia de $50,000 como abono general.
* **Lo que tú haces:** Le das clic a cualquiera de esos pedidos en la tabla y en "Pagado (Anticipo)" le pones los $50,000.
* **Lo que hace el sistema:** 
  1. Reduce tu deuda global con el Fabricante a $50,000.
  2. Va solito a la **Caja Chica** y anota: *"Egreso por $50,000 - Pago a Proveedor Andrés"*. No tuviste que registrar el gasto a mano, el sistema te cuidó la espalda para que tu saldo en el banco coincida con la Caja Chica.
