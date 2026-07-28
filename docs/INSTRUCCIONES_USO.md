# Manual de Uso: Control Bolsas ERP (v6.4)

Bienvenido al sistema de Control Bolsas. Este manual rápido te explicará los flujos operativos principales.

## 1. Subir Órdenes de Compra (Proceso Inteligente)
1. Ve a **Subir Órdenes** en el menú.
2. Arrastra los PDFs de las órdenes de compra que te enviaron los clientes.
3. El sistema utilizará Inteligencia Artificial para extraer:
   - Folio
   - Cliente
   - Kilos Totales
   - **(NUEVO v6)**: Partidas detalladas de artículos (Cantidad, Unidad, Descripción, P.U., Importe).
4. **Instalación como App (PWA):** En Google Chrome o Safari, puedes hacer clic en el ícono de instalar en la barra de direcciones para tener el sistema como una aplicación de escritorio o móvil independiente.
5. Un indicador sonoro y visual te avisará cuando el proceso de la IA termine.
5. Los expedientes se irán a "Órdenes / Ventas".

## 2. Gestión de Expedientes y Detalle de Artículos
1. Ve a **Órdenes / Ventas**. Aquí verás el semáforo (Pedido, Con CR, Vencidas, etc).
2. Haz clic en el Folio para abrir el Expediente.
3. En la pestaña **Resumen**, verás la nueva tabla **Detalle de Artículos**.
4. Puedes agregar, borrar o corregir los artículos a mano (por si la IA se confundió en algo borroso o si hiciste la venta manual).
5. Observa el **Estado Global** para ver si la venta total coincide con los cobros.

## 3. Entregas y Facturación
- **Entregas:** Ve a la pestaña "Entregas" dentro del expediente. Agrega las notas de remisión. El sistema comparará los Kilos Pedidos vs Entregados.
- **Facturas:** Ve a la pestaña "Facturas". Sube el PDF o el **XML (Complemento de Pago)**. Si es un XML, el sistema leerá los UUIDs y buscará inmediatamente qué facturas fueron pagadas.
- **Remisiones:** Puedes generar un PDF de remisión de entrega haciendo clic en el botón "Generar Remisión" dentro del expediente.

## 4. Cobranza Ágil
1. Ve a **Cobranza**. Aquí verás todas las facturas pendientes.
2. Si un cliente ya te pagó, simplemente haz clic en el botón **"💰 Marcar Cobrada"**. 
3. El sistema registrará el pago automáticamente por el total de la factura con la fecha de hoy, ahorrándote 5 clics.
4. Si necesitas hacer un pago parcial, usa el botón "Pagar" tradicional para ingresar el monto exacto.
5. **Alertas de Atraso:** Las facturas vencidas se marcan en rojo y muestran explícitamente los días de atraso (ej. "⚠️ 3 días de atraso") para que sepas a quién cobrar primero.

## 5. Búsqueda Global Rápida
- ¡Nuevo! Presiona **`Ctrl + K`** en tu teclado en cualquier pantalla.
- Escribe el folio, nombre del cliente o archivo y dale Enter. El sistema te llevará directo a buscarlo.

## 6. Sistema Seguro y Modo Oscuro
- **Modo Oscuro:** Haz clic en el botón ◐ en la esquina superior derecha o inferior izquierda para descansar la vista.
- **Estado del Sistema:** En la parte superior verás un indicador verde (`Sistema OK`) que garantiza que estás conectado y que el servidor está respondiendo.
- **Respaldo Local:** Ve a "Respaldo Local" para descargar toda tu base de datos a un archivo Excel por seguridad.
