# v9.15.3 — Conciliación documental y facturación en medios kilos

La orden de compra establece partidas, precios y cantidades contratadas; la remisión acredita el peso físico; el estado del proveedor conserva sus cargos y pagos reportados. Las referencias equivocadas se corrigen únicamente con una remisión fechada y compatible que identifica una sola orden. El dato original y las diferencias se conservan en auditoría.

Las equivalencias de medidas aprobadas se guardan por producto en configuración, con procedencia, y se incorporan a las nuevas OCs. Una descripción desconocida o una asociación ambigua requiere revisión.

La política de Providencia admite enteros o medios kilos por partida. Cada partida se corta hacia abajo al múltiplo de 0.5; el sobrante es merma. El peso físico y el costo completo del proveedor se conservan. Al facturar todos los kilos permitidos no queda la merma como pendiente de facturar.

El lector de estados preserva las columnas del PDF y valida cada saldo intermedio y el cierre. Los acumulados impresos se muestran separados de los movimientos del periodo. Los pagos reportados no generan movimientos retroactivos de caja. Si existen movimientos adicionales incompatibles, el original se archiva y la aplicación del saldo se detiene.

Las fotos de remisión con OCR incompleto utilizan el lector visual autenticado existente. Se validan tipo documental, OC, fecha, todas las partidas, multiplicaciones, subtotal e IVA antes de registrar. El lector no crea facturas a partir de una remisión.

Las operaciones guardan originales, huellas y registros anteriores. La captura de una entrega usa transacción y rechaza folios repetidos. Las facturas nuevas conservan el costo documentado, incluida la merma, y mantienen sin utilidad confirmada los costos que requieren comprobación.

Validación: pruebas de conciliación de saldos, pagos duplicados, referencias erróneas, asociación ambigua, equivalencias aprobadas, medios kilos por partida y costo íntegro; comprobación adicional contra los originales privados. Los documentos y respaldos de datos comerciales se mantienen fuera de Git.
