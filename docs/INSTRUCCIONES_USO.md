# Manual de Uso: Control Bolsas ERP (v6.0)

Bienvenido al sistema de Control Bolsas. Este manual rápido te explicará los flujos operativos principales.

## 1. Subir Órdenes de Compra (Proceso Inteligente)
1. Ve a **Subir Órdenes** en el menú.
2. Arrastra los PDFs de las órdenes de compra que te enviaron los clientes.
3. El sistema utilizará Inteligencia Artificial para extraer:
   - Folio
   - Cliente
   - Kilos Totales
   - **(NUEVO v6)**: Partidas detalladas de artículos (Cantidad, Unidad, Descripción, P.U., Importe).
4. Un indicador sonoro y visual te avisará cuando el proceso termine.
5. Los expedientes se irán a "Órdenes / Ventas".

## 2. Gestión de Expedientes y Detalle de Artículos
1. Ve a **Órdenes / Ventas**. Aquí verás el semáforo (Pedido, Con CR, Vencidas, etc).
2. Haz clic en el Folio para abrir el Expediente.
3. En la pestaña **Resumen**, verás la nueva tabla **Detalle de Artículos**.
4. Puedes agregar, borrar o corregir los artículos a mano (por si la IA se confundió en algo borroso o si hiciste la venta manual).
5. Observa el **Estado Global** para ver si la venta total coincide con los cobros.

## 3. Entregas y Facturación
- **Entregas:** Ve a la pestaña "Entregas" dentro del expediente. Agrega las notas de remisión. El sistema comparará los Kilos Pedidos vs Entregados.
- **Facturas:** Ve a la pestaña "Facturas". Sube el XML de la factura. El sistema calculará vencimientos y programará la cobranza.

## 4. Cobranza Ágil
1. Ve a **Cobranza**. Aquí verás todas las facturas pendientes.
2. Si un cliente ya te pagó, simplemente haz clic en el botón **"💰 Marcar Cobrada"**. 
3. El sistema registrará el pago automáticamente por el total de la factura con la fecha de hoy, ahorrándote 5 clics.
4. Si necesitas hacer un pago parcial, usa el botón "Pagar" tradicional para ingresar el monto exacto.

## 5. Búsqueda Global Rápida
- ¡Nuevo! Presiona **`Ctrl + K`** en tu teclado en cualquier pantalla.
- Escribe el folio, nombre del cliente o archivo y dale Enter. El sistema te llevará directo a buscarlo.

## 6. Sistema Seguro y Modo Oscuro
- **Modo Oscuro:** Haz clic en el botón ◐ en la esquina superior derecha o inferior izquierda para descansar la vista.
- **Estado del Sistema:** En la parte superior verás un indicador verde (`Sistema OK`) que garantiza que estás conectado y que el servidor está respondiendo.
- **Respaldo Local:** Ve a "Respaldo Local" para descargar toda tu base de datos a un archivo Excel por seguridad.
