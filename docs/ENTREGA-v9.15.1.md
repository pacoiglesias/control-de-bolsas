# Entrega v9.15.1

Incluye la conciliación y operación guiada documentadas en ENTREGA-v9.15.0.md.

La carga de facturas, desde el inspector y el flujo automático, registra la factura y su espejo de cobranza en una misma transacción. Lee el expediente actual para conservar facturas y abonos concurrentes, rechaza duplicados por folio o UUID y bloquea órdenes retiradas. Una factura fiscal no crea una remisión ni aumenta los kilos físicamente entregados.

La conciliación conserva los registros históricos sin expediente activo como referencias retiradas, con su preimagen y motivo de revisión. No elimina documentos originales ni transforma referencias de contrarrecibo en ventas adicionales.

Los disparadores de saneamiento de órdenes y saldo de caja se exportan una sola vez. Se retiran sus copias heredadas del servidor para impedir recalcular con código anterior o procesar un mismo movimiento desde dos funciones.

Los listados recibidos son parciales. Los datos fiscales faltantes, las partidas de órdenes sin original y la comprobación física de caja siguen pendientes de evidencia; la interfaz debe mostrarlos como pendientes.
