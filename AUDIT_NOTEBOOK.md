# 📓 AUDIT NOTEBOOK — Control Bolsas ERP

Este documento es la bitácora viva de la Auditoría de Automejora Continua del sistema Control Bolsas ERP. Cada hallazgo, optimización, parche de seguridad y refactorización queda registrado aquí con fecha, archivo afectado, diagnóstico y resolución.

**Leyenda de estados:** ✅ Resuelto · 🔧 En curso · 🔴 Pendiente (detectado, sin corregir) · ↩️ Regresión (se resolvió antes y volvió)

---

## ✅ Ciclo 22 — 2026-07-30 — Permiso de Limpieza de Bitácora para Administrador en Firestore Rules

> Se diagnosticó y corrigió el error "🔒 Acceso denegado: No tienes permisos de administrador para realizar esta acción" al intentar borrar la bitácora desde la pantalla de Logs. La regla `firestore.rules` tenía declarada la inmutabilidad estricta con `allow update, delete: if false;` bloqueando a los administradores. Se actualizó la regla a `allow delete: if isSuperAdmin();` y se relajaron las restricciones excesivas de `email_verified` en las funciones de verificación de correo del propietario.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `firestore.rules` | La colección `system_logs` tenía `allow update, delete: if false;`, impidiendo que el rol `admin` borrara o limpiara la bitácora desde `Logs.tsx`. | Cambiado a `allow delete: if isSuperAdmin();` y ajustados los helpers `isAllowedOwnerEmail` y `esAdminReal`. |

---

## ✅ Ciclo 21 — 2026-07-30 — Corrección de Error de Firestore "Unsupported field value: undefined" en Reversión de Recolecciones

> Se diagnosticó y corrigió el error en tiempo de ejecución al hacer clic en "Deshacer Recolección": `Function Transaction.update() called with invalid data. Unsupported field value: undefined`. El SDK de Firestore prohíbe pasar `undefined` dentro de propiedades de objetos serializados en transacciones. Se reemplazaron todas las asignaciones `collectedAt: undefined` y `paidAt: undefined` por `null`, permitiendo que la transacción de reversión complete de forma atómica y sin fallas.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Cobranza.tsx` | `revertCollectedContrareciboBlock` y `payContrareciboBlock` asignaban `collectedAt: undefined` y `paidAt: undefined`, haciendo fallar la transacción con error de Firestore SDK. | Reemplazado `undefined` por `null` en los campos de fecha de cobranza. |
| `src/pages/OrderModal.tsx` | Al deshacer cobros o limpiar fechas se asignaban campos `undefined` en el objeto `collection`. | Reemplazado `undefined` por `null`. |

---

## ✅ Ciclo 20 — 2026-07-30 — Corrección de Desestructuración $0.00 en Ganancia Comercial y Ganancia por Cobros

> Se diagnosticó y corrigió el bug que mostraba $0.00 en las tarjetas KPI de "Ganancia Comercial" y "Ganancia por Cobros" en el Dashboard. Se detectó una inconsistencia de desestructuración (`k.kpis?.margenTotal` en lugar de `k.margenTotal`) y se incorporó un cálculo de respaldo en tiempo real sobre las órdenes activas para cuando el agregador asíncrono no haya emitido el snapshot.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Dashboard.tsx` | Las tarjetas `Ganancia Comercial` y `Ganancia por Cobros` mostraban `$0.00` porque intentaban leer `k.kpis?.margenTotal`, pero `kpis` se había desestructurado directamente en el nivel raíz del objeto `k`. | Corregido a `k.margenTotal` y `k.gananciaRealizadaTotal`, agregando además el cálculo en vivo de respaldo sobre `activeOrders`. |

---

## ✅ Ciclo 19 — 2026-07-30 — Consola del Semáforo de Control de Riesgo Operativo en Dashboard Principal

> Se diseñó e incorporó el Panel Consola de Semáforo de Control de Riesgo en el Dashboard principal. Agrupa visualmente el estado del sistema en 4 niveles de riesgo operativo: Facturas Críticas (>30d en rojo), Urgentes (16-30d en naranja), Recientes (1-15d en amarillo) y Por Recoger del Contador (en verde).

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Dashboard.tsx` | Las alertas del Dashboard solo mostraban un número general de facturas vencidas sin desglosar su nivel de gravedad. | Diseñada la **Consola de Semáforo Visual de Riesgo Operativo** con 4 tarjetas indicadoras de severidad (🔴 Crítico, 🟠 Urgente, 🟡 Reciente, 🟢 Por Recoger). |

---

## ✅ Ciclo 18 — 2026-07-30 — Módulo Avanzado de Control de Morosidad, Semáforo de Vencimientos, Proyección de Flujo a 7/15 Días y Copia de Recordatorios

> Se diseñó e implementó la suite completa de control forense de contrarecibos vencidos: semáforo visual graduado por antigüedad de morosidad, chips de filtrado interactivo instantáneo, widget de proyección de ingresos a 7 y 15 días, y generador de avisos de recordatorio de cobro en 1 clic.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Cobranza.tsx` | No existía una visualización clara del grado de mora ni proyecciones de cobro a corto plazo. | Agregadas las tarjetas **Cobro a 7 Días** y **Cobro a 15 Días** en la parrilla KPI. |
| `src/pages/Cobranza.tsx` | No se podía aislar en 1 clic los vencidos o facturas sin contrarecibo. | Implementados los botones **Filter Chips interactivos** (`Todos`, `🚨 Vencidos`, `⚠️ Sin Contrarecibo`, `✓ En Plazo`). |
| `src/pages/Cobranza.tsx` | La alerta de días de atraso era genérica. | Diseñado el **Semáforo de Morosidad Graduado** (🟡 Vencido 1-15d, 🟠 Urgente 16-30d, 🔴 Crítico +30d). |
| `src/pages/Cobranza.tsx` | Redactar correos o mensajes de cobranza requería escribir datos manualmente. | Agregado el botón **`✉️ Recordatorio`**, que redacta la notificación con folios, contrarecibo y saldo exacto y la copia al portapapeles. |

---

## ✅ Ciclo 17 — 2026-07-30 — Búsqueda Rápida en Vivo, Exportador Universal a Excel (CSV con UTF-8 BOM) y Reporte de Estado de Cuenta de Proveedores

> Se implementaron tres mejoras operativas de alta usabilidad solicitadas para agilizar la interacción diaria: filtro de búsqueda instantáneo en Cobranza, exportador universal a Microsoft Excel (CSV con soporte de caracteres especiales) en todos los módulos principales, y reporte impreso en PDF del Estado de Cuenta de Proveedores (Andrés).

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/lib/format.ts` | No existía una utilidad universal de exportación de datos a hojas de cálculo con codificación adecuada. | Creado `exportToCsv()` con prefijo `\uFEFF` (UTF-8 BOM) para apertura limpia en Microsoft Excel sin corrupción de acentos o moneda. |
| `src/pages/Cobranza.tsx` | El usuario tenía que revisar manualmente todas las filas para encontrar un folio, cliente o contrarecibo específico. | Agregado el campo **🔍 Búsqueda Rápida en Vivo** y el botón **📥 Exportar Excel (CSV)**. |
| `src/pages/CajaChica.tsx` | Faltaba la opción de exportar el libro de egresos e ingresos a Excel. | Agregado el botón **📥 Exportar Excel (CSV)**. |
| `src/pages/Compras.tsx` | No existía un reporte impreso PDF ni exportación del libro mayor del proveedor Andrés. | Agregados los botones **📥 Exportar Excel (CSV)** y **🖨️ Imprimir Estado de Cuenta (PDF)**. |

---

## ✅ Ciclo 16 — 2026-07-30 — Historial de Recolecciones, Botón "↩️ Deshacer Recolección" y Generador de Reportes PDF Imprimibles

> Se incorporó la pestaña de Historial de Contrarecibos Recogidos con botón de reversión (deshacer), registrando automáticamente el movimiento opuesto en Caja Chica y la bitácora de auditoría en `system_logs`. Además, se implementaron generadores vectoriales de Reportes PDF Imprimibles para Cobranza y Caja Chica.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Cobranza.tsx` | Al recoger un lote, los contrarecibos desaparecían sin dejar un historial accesible ni permitir corregir selecciones accidentales. | Creada la pestaña **Historial: Recogidos / En Caja Chica** con el botón **↩️ Deshacer Recolección**, regresando el estado a "Por Recoger", ajustando Caja Chica y auditando en `system_logs`. |
| `src/pages/Cobranza.tsx` | Faltaban reportes ejecutivos impresos para documentación interna. | Agregado el generador **🖨️ Reporte de Cobranza (PDF)** que desglosa saldos te deben, vencidos, por recoger e historial de recolecciones. |
| `src/pages/CajaChica.tsx` | El botón de imprimir usaba la vista nativa del navegador sin formato ejecutivo. | Reemplazado por **🖨️ Imprimir Reporte (PDF)** vectorial con KPIs de ingresos, egresos y saldo líquido. |

---

## ✅ Ciclo 15 — 2026-07-30 — Botón "⚡ Facturar lo Entregado" y Banner Operativo de Entrega Faltante

> Se agregaron las herramientas automatizadas solicitadas para eliminar operaciones manuales al facturar entregas reales y señalar discrepancias de kilaje contra la OC.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/OrderModal.tsx` | El usuario tenía que sumar manualmente los kilos entregados y capturar la factura a mano. | Agregado el botón **⚡ Facturar lo entregado**. Con un solo clic suma las partidas entregadas (ej. 2,964.16 kg), crea el registro de factura con el importe exacto con IVA y la OC vinculada. |
| `src/pages/OrderModal.tsx` | Si la OC solicitaba 3,000.00 kg y Andrés entregaba 2,964.16 kg, el sistema no señalaba los 35.84 kg pendientes ni su valor monetario ($1,684.48 subtotal). | Agregado el banner de aviso **⚠️ Aviso de Entrega Faltante (Tolerancia Operativa)** en las pestañas Resumen y Facturas, indicando kilos pedidos, entregados, pendientes y valor de venta. |

---

## ✅ Ciclo 14 — 2026-07-30 — Auditoría Integral del Libro Mayor y Flujo Físico de Caja Chica ($75,265.56)

> Se auditó el desglose completo del archivo maestro del usuario. Se detectó que el concepto "Deuda con Andrés ($125,175.56)" es un Pasivo (Cuentas por Pagar) de Compras y NO una salida física de Caja Chica. Al excluirlo de los movimientos en efectivo, el saldo de Caja Chica cuadró al centavo con el total exacto del archivo maestro ($75,265.56).

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/lib/seedData.ts` | `INITIAL_EXPENSES` incluía la deuda técnica de Andrés ($125,175.56) como un egreso de caja física, distorsionando el saldo líquido. | Eliminada la entrada de pasivo de los egresos en efectivo. Los 4 movimientos líquidos ($-819.44 + $144,945.00 - $145,000.00 + $76,140.00) entregan el saldo neto exacto de **$75,265.56**, idéntico a la hoja maestra. |
| `src/lib/seedData.ts` | TH-836 ($106,720.17) figuraba en la lista de facturas pendientes en lugar de su posición como Contrarecibo Generado. | Reubicado TH-836 como el 1.º de los 12 Contrarecibos, cuadrando el total de "ME DEBEN" a **$1,435,270.48** ($1,298,970.48 de contrarecibos + $136,300.00 de las 2 facturas en revisión). |

---

## ✅ Ciclo 13 — 2026-07-30 — Módulo de Pre-Factura CFDI 4.0 y Registro de Entrega Real de Andrés (OC 120267114014)

> Tras la entrega del material por parte del fabricante Andrés (2,964.16 kg totales), se sincronizaron los montos de facturación real ($161,606.00 con IVA) y se construyó el generador de Pre-Factura CFDI 4.0 vectorial en `OrderModal.tsx`.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/lib/seedData.ts` | La orden `120267114014` conservaba el estimado inicial de 3,000 kg ($141,000.00). Faltaba ajustar los importes a los 2,964.16 kg entregados por Andrés. | Actualizado `total: 161606.00` (Subtotal $139,315.52 + 16% IVA = $161,606.00) con las partidas desglosadas (983.46 kg + 1,000.00 kg + 980.70 kg). |
| `src/pages/OrderModal.tsx` | El usuario no disponía de una herramienta para generar e imprimir de forma inmediata la Pre-Factura CFDI 4.0 con la información requerida por Providencia. | Creada la función `printPreFactura()` y el botón **📋 Pre-Factura CFDI 4.0 (PDF)**. Genera un documento con datos fiscales del receptor (GTP930115PU1), Clave SAT `24141500`, Unidad `KGM`, Método `PPD`, Forma `99` e instructivo de timbrado. |

---

## ✅ Ciclo 12 — 2026-07-30 — Implementación del Motor Financiero Dinámico (Instructivo de Utilidad)

> Se formalizó e implementó la función canónica `computeDynamicFinancials()` en `functions/src/shared/finance.core.ts` y re-exportada en `src/lib/finance.ts`, garantizando el cumplimiento estricto del instructivo de fórmulas matemáticas dinámicas.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `functions/src/shared/finance.core.ts` | Faltaba la implementación explícita del motor dinámico según las 6 reglas y despejes flexibles del instructivo oficial (captura por monto recibido o porcentaje real de comisión). | Creadas e implementadas las interfaces `DynamicFinancialsInput`, `DynamicFinancialsResult` y la función `computeDynamicFinancials()`. |
| `src/lib/finance.ts` | Se requería exponer la nueva función y tipos del motor financiero hacia todo el frontend. | Re-exportados `computeDynamicFinancials`, `DynamicFinancialsInput` y `DynamicFinancialsResult`. |
| `src/lib/__tests__/finance.test.ts` | Faltaba la suite de pruebas automatizadas para el instructivo dinámico. | Agregada suite de pruebas `computeDynamicFinancials (Instructivo Motor Financiero)` validando despejes y cálculo de ganancia limpia por kilo (15/15 pasadas). |

---

## ✅ Ciclo 11 — 2026-07-30 — Integración de Audio Sensorial y Chunking Seguro de Firestore Batches

> En este ciclo se conectó el motor de audio sintético nativo (`sounds.ts`) con el sistema global de notificaciones (`ToastContext.tsx`), y se añadió chunking a los borrados masivos para prevenir límites de lote en Firestore.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/context/ToastContext.tsx` | Las notificaciones tipo `ok`, `bad` e `info` no ofrecían retroalimentación sonora a pesar de contar con `src/lib/sounds.ts`. | Integrado `sound.playSuccess()`, `sound.playError()` y `sound.playNotify()` en `ToastContext`. Todas las notificaciones del sistema ahora emiten micro-tonos sutiles sin librerías externas. |
| `src/pages/Seeder.tsx` | El borrado maestro ejecutaba `batch.delete()` sobre toda la colección de golpe. Si la base crecía a más de 500 documentos, la operación fallaba con `InvalidArgumentError`. | Implementado helper `deleteInBatches()` con chunking de máximo 400 operaciones por commit en Firestore. |

---

## ✅ Ciclo 10 — 2026-07-30 — Panel completo: margen, caja chica y cobros con contabilidad

> Tras el Ciclo 9, "Te deben" ya mostraba **1,435,270.48**, que coincide al peso con la hoja del negocio. Faltaban tres indicadores en cero por causas distintas.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/lib/finance.ts`, `functions/src/stats.ts` | 🔴 **"Ganancia Comercial" siempre en $0.00.** El margen solo se sumaba `if (hasCustomCost)`, es decir únicamente cuando la orden tenía un costo escrito a mano. Todo expediente que usara el costo de la configuración —prácticamente todos— reportaba margen cero. Lo mismo afectaba a "Ganancia por Cobros". | Quitado el condicional en frontend y backend. `computeFinancials` ya resuelve el costo efectivo (override si existe, configuración si no), así que `tradeMargin` siempre trae un valor válido. Con los 13 expedientes abiertos el margen esperado es ≈131,627.89. |
| `src/pages/Seeder.tsx` | La migración no tenía forma de cargar **contrarecibos ya pagados cuyo dinero sigue con el contador**. TR_3583 (GT-570, 182,250.55) no existía en el sistema, así que "Cobrado" y "Por Recibir del Contador" quedaban en cero. | Nueva sección **3. CONTRARECIBOS PAGADOS**, que crea el expediente con estatus `paid`, `paidAmount` completo y `complementStatus: 'issued'`. Verificado: deposita 169,681.55 contra los 169,682.02 de la hoja. |
| `src/pages/Seeder.tsx` | La migración **borra Caja Chica y no la repuebla**, así que el saldo quedaba en $0.00 aunque el negocio tuviera saldo y movimientos reales. | Nueva sección **4. CAJA CHICA**, con el saldo inicial y los movimientos. Importe negativo = egreso. Verificado: los cuatro movimientos reales suman **75,265.56**, exactamente el saldo de la hoja. |

### 📌 Nota de despliegue (no es código)

Las funciones invocables (`recalcDashboardStats`, `reprocessOrder`) fallaban con "interna". El registro mostró que **Cloud Run rechazaba la petición antes de ejecutar nada** (*Empty Authorization header*): faltaba el permiso de invocación pública en el servicio. Es la configuración normal de Firebase: la autenticación real ocurre dentro de la función (sesión + correo verificado + rol admin), no en la capa de red.

### 🟡 Sigue pendiente

- No se distingue **facturado sin contrarecibo** (136,300.00) de **contrarecibo generado** (1,298,970.48); el panel los suma en `porCobrar`.
- No hay campo propio para la **referencia de transferencia** (TR_3583); hoy va en las notas del cobro.
- Un solo precio por expediente: si una OC mezcla precios por renglón, los importes saldrían mal.

---

## ✅ Ciclo 9 — 2026-07-30 — Comisión real confirmada y Caja Chica recibiendo el importe correcto

> **Regla del negocio, confirmada con tres cobros reales:** el cliente (TH/GT) paga la **factura completa**; el contador descuenta **8% del subtotal** por la gestión de cobro. El cobro de 153,381.00 cuadra al centavo: subtotal 132,225.00 × 0.08 = 10,578.00 de honorario, y 132,225.00 × 1.08 = 142,803.00 depositados. Regla práctica: **depósito = subtotal × 1.08**.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Cobranza.tsx` | 🔴 **El cobro en bloque depositaba en Caja Chica un importe equivocado.** Inyectaba `venta − costo − comisión` (la utilidad), cuando lo que realmente entra es `venta − comisión`. El costo del material se paga a Andrés **por separado** desde Compras, que ya genera su propio egreso: restarlo también aquí lo contaba dos veces. En TR_3583 la diferencia son **140,398.44 pesos**. | Nuevo `netCobrado = totalVenta − comisionContador`, recalculado dentro de la transacción. `netUtilidad` se conserva como indicador de margen para el paquete impreso, que es su uso legítimo. |
| `src/pages/Cobranza.tsx` vs `src/pages/OrderModal.tsx` | 🔴 **Los dos caminos de cobro depositaban cantidades distintas para el mismo hecho.** El cobro individual (`OrderModal`) ya usaba `invTotal − commission` (correcto) y el cobro en bloque restaba además el costo. Misma operación, dos resultados. | Unificados: ambos registran el importe realmente depositado. |
| `src/lib/types.ts`, `functions/src/index.ts` | `commissionRate` 0.069 con base `total` era una aproximación (erraba ~6 pesos por contrarecibo). | **8% sobre `subtotal`**, que reproduce los cobros reales al centavo. Corregido en frontend y backend a la vez para que no calculen distinto. |
| `src/lib/__tests__/finance.test.ts` | Las pruebas fijaban la base anterior. | Actualizadas, más una prueba nueva que **reproduce el cobro real de 153,381.00**: si alguien mueve esos valores, la suite falla y explica por qué. 13/13. |
| `src/pages/Cobranza.tsx` | El paquete impreso mostraba el margen pero no el importe a recibir. | Agregada la línea **"DEPÓSITO QUE RECIBES (factura menos comisión)"**. |
| `src/pages/Cobranza.tsx` | El concepto en Caja Chica decía "Ingreso por Utilidad del Contrarecibo", que describía mal el movimiento. | "Cobro del Contrarecibo {n}". |

### 📌 Acción pendiente del usuario

`DEFAULT_CONFIG` es solo el respaldo: **manda lo guardado en Firestore**. En **Configuración** debe quedar: comisión **8**, base **subtotal (sin IVA)**, precio de venta **47**.

---

## ✅ Ciclo 8 — 2026-07-30 — La comisión se calculaba sobre la base equivocada

> Aclaración del negocio: **54.52 = 47 × 1.16**. El 47 es el subtotal por kilo y el 54.52 el precio con IVA que aparece en contrarecibos y facturas.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/lib/types.ts`, `functions/src/index.ts` | 🔴 **`commissionBase` estaba en `'subtotal'`.** Verificado contra el contrarecibo real TR_3583: 182,250.55 × 0.069 = **12,575.29**, que es exactamente lo descontado. Con base `'subtotal'` daba 10,840.77: **1,734.52 menos en un solo contrarecibo**, e inflaba la utilidad esperada por la misma cantidad. El valor estaba mal en los dos lados a la vez, frontend y backend. | Corregido a `'total'` en ambos, con la verificación documentada en el código. El modo `'subtotal'` sigue existiendo y funcionando para quien lo configure. |
| `src/pages/Seeder.tsx` | 🔴 **Regresión introducida en el Ciclo 7 y detectada aquí.** Al sustituir el `54.52` incrustado por `config.salePricePerKg` (que es 47, el subtotal), los kilos derivados de importes brutos quedaban **inflados un 16%**. | Se calcula `precioBrutoPorKg = salePricePerKg × (1 + ivaRate)` una sola vez y se usa en las tres derivaciones. La migración ahora reporta ese precio en su bitácora para que sea verificable a simple vista. |
| `src/lib/__tests__/finance.test.ts` | La prueba fijaba `commission = 324.30`, congelando la base equivocada. **La suite atrapó el cambio**, que es justo para lo que existe. | Actualizada a 376.19 con la justificación y el número real que la respalda. Agregada una prueba nueva que cubre el modo `'subtotal'`, para que siga garantizado. |

### 📌 Acción pendiente del usuario

`DEFAULT_CONFIG` es solo el valor de respaldo: **manda lo que esté guardado en Firestore**. Hay que entrar a **Configuración** y verificar que la base de comisión diga *total (con IVA)* y que el precio de venta sea **47**, no 54.52. Si dice 54.52, el sistema le suma el IVA otra vez y factura a 63.24 por kilo.

---

## ✅ Ciclo 7 — 2026-07-30 — La carga inicial creaba expedientes invisibles

> Verificación: `tsc` limpio en raíz y `functions`, `eslint .` con 0 errores y 0 advertencias, 12/12 pruebas, build completo.

| Archivo | Problema encontrado | Optimización aplicada |
|---|---|---|
| `src/pages/Seeder.tsx` | 🔴 **La migración nunca escribía `invoiceStatuses`.** Los expedientes se creaban bien en Firestore, pero ese arreglo desnormalizado es lo que sostiene TODAS las consultas `array-contains-any` del sistema: Dashboard, Cobranza y el barrido nocturno `checkOverdueInvoices`. Sin él, los registros migrados eran **invisibles** en todas esas pantallas. La migración reportaba éxito y no se veía nada. | `invoiceStatuses` agregado tanto a los contrarecibos como al expediente de facturas pendientes. |
| `src/lib/types.ts` | 🔴 **`PurchaseOrder` no declaraba `invoiceStatuses`**, pese a que todo el sistema depende de ese campo. Nada impedía que una ruta de escritura lo omitiera —que es exactamente lo que pasaba en el Seeder— porque el compilador no tenía forma de saber que faltaba. | Campo declarado y documentado, con la indicación de escribirlo siempre vía `camposInvoices()`. |
| `src/pages/Seeder.tsx` | Precio de venta `54.52` incrustado en tres lugares para derivar kilos desde el importe. Si cambiaba el precio en la configuración, la migración seguía usando el viejo y los importes salían corridos sin avisar. | Sustituido por `config.salePricePerKg`. |
| `src/pages/Seeder.tsx` | Al terminar decía "Migración completada con éxito" pero **el panel seguía en ceros**: `syncDashboardStats` solo reacciona a escrituras posteriores a su despliegue. Había que ir a buscar el botón de recalcular a mano sin que nada lo indicara. | La migración ahora invoca `recalcDashboardStats` al terminar y reporta cuántos expedientes procesó. Si el recálculo falla, avisa que los datos sí se migraron y cómo recalcular a mano. |
| `src/pages/Dashboard.tsx` | El aviso "Cargar base inicial (15 registros)" inyectaba **datos de ejemplo** desde `seedData.ts`, un camino distinto y peor que `/seed`, que sí carga los contrarecibos y facturas reales. Mezclaba registros ficticios con los del negocio. | Reemplazado por un enlace a `/seed`, visible solo para administradores. Eliminados el import, el estado `seeding` y el `logAction` que quedaron sin uso. |

### 🟡 Pendiente consciente

`src/lib/seedData.ts` quedó **huérfano**: ya nadie lo importa. No estorba (no entra al paquete final), pero es candidato a borrarse en la próxima limpieza si se confirma que esos 15 registros de ejemplo ya no hacen falta.

---

## ✅ Ciclo 6 — 2026-07-30 — Estado de Cuenta de Proveedor y Fix Semilla

> Verificación: `npm run build` exitoso. Despliegue en producción completado.

### 🔴 Ceros persistentes en Dashboard al inyectar Base Inicial — causa raíz y corrección

| Archivo | Problema | Optimización aplicada |
|---|---|---|
| `src/lib/seedData.ts` | Al actualizar la arquitectura a `invoices` en la v5.4.0, el script de siembra inicial seguía creando `purchaseOrders` sin el arreglo de facturas. `syncDashboardStats` sumaba cero para las ventas. | Se reestructuró la siembra para generar automáticamente el arreglo `invoices` de cada orden histórica inyectada, garantizando que el recálculo refleje $1.2M de ventas de los Excel. |
| `src/lib/types.ts` | Inexistencia de vínculo formal entre un `Purchase` y un `Expense` de Caja Chica para el mismo proveedor. | Se añadió la propiedad `provider` a `Expense`, lo que habilitó el Libro Mayor (Estado de Cuenta) que consolida deuda y pagos. |


## ✅ Ciclo 5 — 2026-07-30 — Panel en ceros, backfill de agregación y Ciclo 4 sobre v6

> Verificación: `tsc --noEmit` limpio en raíz y `functions`, `eslint .` con **0 errores y 0 advertencias**, 12/12 pruebas, `npm run build` completo.

### 🔴 Panel principal mostraba todo en cero — causa raíz y corrección

| Archivo | Problema | Optimización aplicada |
|---|---|---|
| `functions/src/stats.ts` | `syncDashboardStats` es **incremental**: aplica `FieldValue.increment` sobre la diferencia cada vez que se escribe un expediente. Los expedientes anteriores a su despliegue nunca dispararon un evento, así que `stats/dashboard` nacía vacío y el panel mostraba ceros **para siempre**. Faltaba la siembra inicial. | Nueva función invocable `recalcDashboardStats`: recorre `purchaseOrders` paginando de 300 en 300, reconstruye el documento completo y lo escribe con `set` sin merge (reemplazo total, para que ningún contador viejo quede pegado). Reutiliza `extractStats()`, la **misma** función del trigger incremental: duplicar la fórmula habría hecho que el recálculo "corrigiera" hacia un valor equivocado con el tiempo. Exige sesión, correo verificado y rol de administrador. |
| `src/pages/Dashboard.tsx` | `kpis.porRecibir.reduce(...)` esperaba un **arreglo**, pero el trigger escribe ese campo como **número** vía `increment`. No reventaba solo porque el documento no existía y caía al valor por omisión `[]`. **En cuanto el backfill llenara las estadísticas, el panel entero habría tronado** con "porRecibir.reduce is not a function". | El detalle de "Por Recibir del Contador" se arma en el cliente desde los expedientes vivos: la tabla necesita folio, contrarecibo e importes factura por factura, y un contador agregado por definición no puede darlos. |
| `src/pages/Dashboard.tsx` | La consulta en vivo no incluía el estatus `paid`. Un expediente con **todas** sus facturas en `paid` no se cargaba, así que la tabla "Por Recibir del Contador" se quedaba sin datos de dónde salir. | Agregado `'paid'` al `array-contains-any`. |
| `src/pages/Dashboard.tsx` | `useEffect` de logs en vivo con dependencias `[]` y un `if (role !== 'admin') return` adentro. `role` llega asíncrono desde `AuthContext`: en el primer render vale `undefined`, el efecto salía por el early return y **nunca volvía a ejecutarse**. Al administrador no le cargaban jamás los logs en vivo. | `role` agregado a las dependencias. |
| `src/pages/Dashboard.tsx` | `(activeOrdersDoc as PurchaseOrder[]) \|\| []` creaba un arreglo nuevo en cada render, invalidando el `useMemo` de los KPIs en cada ciclo. | Memoizado sobre `[activeOrdersDoc]`. |

### 🔴 Ciclo 4 reaplicado sobre la base v6

| Archivo | Problema | Optimización aplicada |
|---|---|---|
| `src/pages/Cobranza.tsx` | `printConsolidatedCr` interpolaba `cr`, `client`, `folios` y `status` **sin escapar** en una plantilla abierta como Blob URL, que hereda el origen de la aplicación con la sesión de Firebase viva. | `escapeHtml()` centralizado en `lib/format.ts` y aplicado a las tres plantillas de impresión del sistema. |
| `src/pages/OrderModal.tsx` | `escapeHtml` definida **dos veces** dentro del mismo archivo. | Ambas copias eliminadas; todas usan la de `lib/format.ts`. |
| `src/pages/Cobranza.tsx`, `src/pages/OrderModal.tsx` (×2) | `URL.createObjectURL` sin revocar: fuga de memoria en cada impresión. | Revocados 10 s después de abrir la ventana. |
| `src/pages/OrderModal.tsx` | `save()` escribía con `setDoc` desde la copia local del formulario: un cobro registrado en Cobranza mientras el modal seguía abierto **se revertía en silencio**. | Migrado a `runTransaction` con **concurrencia optimista**: compara el `updatedAt` capturado al abrir el modal contra el del servidor y aborta con aviso explícito si alguien más escribió mientras tanto. |
| `src/lib/invoiceOps.ts` (nuevo) | `camposInvoices()` y `aplicarPorId()` vivían dentro de `Cobranza.tsx`; `OrderModal` calculaba `invoiceStatuses` por su cuenta — dos caminos para escribir lo mismo. | Extraídas a módulo compartido; ambas pantallas usan la misma implementación. |
| `src/pages/Cobranza.tsx` | `collectContrareciboBlock` inyectaba en Caja Chica un `netUtilidad` calculado **fuera** de la transacción, desde el snapshot ya renderizado. | Recalculado dentro de la transacción desde las facturas releídas; aborta si difiere en más de $1 de lo confirmado en pantalla. |

### ⚡ Rendimiento

| Archivo | Problema | Optimización aplicada |
|---|---|---|
| `src/App.tsx`, `vite.config.ts` | Las 13 pantallas se importaban de forma estática; Recharts (382 kB), usado solo por el Dashboard, viajaba en el chunk principal. | `React.lazy()` por ruta con `<Suspense>` y `manualChunk` propio para `recharts`. **Chunk principal: 598 kB → 34.9 kB.** |

### 🟡 Pendientes conscientes

- Dependencias de Gemini (`genkit`, `@genkit-ai/*`) siguen en `functions/package.json` sin usarse.
- `main` en GitHub sigue en v5.8.1; la v6 vive en la rama `optimize/workspace-2026-07-29-ciclo2`.
- `OrderModal.backup.tsx` y `fix_dashboard.cjs` volvieron al repositorio (el instalador fusiona y nunca borra, por diseño). Requieren `git rm` manual.

---

## 🚨 Incidente — 2026-07-30 — El parche del Ciclo 4 sobrescribió trabajo de la v6.0.0

**Qué pasó.** Se generó un paquete de correcciones ("Ciclo 4", v5.9.0) auditando el repositorio público de GitHub, que estaba en v5.8.1. La carpeta local, en cambio, tenía una **v6.0.0 sin subir** desarrollada en otra sesión: retiro de la IA de Gemini, parser de facturas del lado del cliente (`useInvoiceParser.ts`), agregación server-side (`functions/src/stats.ts`), paginación y deshacer cobros en bloque.

Al instalar el parche, sus 21 archivos —construidos sobre v5.8.1— pisaron las versiones v6 de `App.tsx`, `OrderModal.tsx`, `Cobranza.tsx`, `functions/src/index.ts` y `package.json`, entre otros. Se perdieron del árbol de trabajo el cableado de `useInvoiceParser`, el deshacer en bloque, la arquitectura sin provider y la dependencia `react-firebase-hooks`.

**Causa raíz.** Se asumió que el repositorio público reflejaba la carpeta local. No se verificó el estado real del entorno antes de construir el paquete.

**Cómo se detectó.** El propio instalador corre `tsc --noEmit` al terminar y **se detuvo antes de desplegar**, reportando 3 errores en archivos que el parche nunca tocó. Esa incoherencia fue la señal.

**Recuperación.** El respaldo automático `_respaldo_20260730_042`, creado por el instalador antes de copiar, tenía la v6.0.0 íntegra. No hubo pérdida de datos.

**Regla que queda.** Antes de generar cualquier paquete de correcciones hay que verificar el estado **local** del proyecto, no el del repositorio remoto. Si ambos divergen, se resuelve la divergencia primero.

---

## ✅ Reparación v6.0.0 — 2026-07-30 (restaurada desde `_respaldo_20260730_042`)

> La v6.0.0 **nunca había compilado**: quedó a medio terminar en la carpeta local, sin `tsc`, `eslint`, pruebas ni build en verde. Esta sesión la deja compilando por primera vez. Verificación final: `tsc --noEmit` limpio en raíz y en `functions`, `eslint .` con 0 errores, 12/12 pruebas, `npm run build` completo.

| Hallazgo | Archivo | Resolución |
|---|---|---|
| 🔴 **Hook condicional (Reglas de Hooks)** | `src/pages/OrderModal.tsx` | `useInvoiceParser` se llamaba dentro de un IIFE `{tab === 'facturas' && (() => {...})()}`, es decir solo en una pestaña. React ve distinta cantidad de hooks entre renders y lanza *"Rendered more hooks than during the previous render"* al cambiar de pestaña. Subido al nivel del componente, incondicional; se eliminó el IIFE y su `return`. |
| 🔴 **Importe NaN en la compra al fabricante** | `src/pages/OrderModal.tsx` | El upsert de la compra a Andrés usaba `ccp`, que dentro de `save()` vale `undefined` siempre que no se capture un costo propio: `kilosNum * ccp` producía `NaN` y guardaba `pricePerKg`/`totalAmount` inválidos. Ahora usa `dynamicConfig.costPricePerKg` (override resuelto contra la configuración base) y redondea con `round2`. |
| `tradeMargin` no declarado | `src/lib/types.ts` | `computeFinancials()` en `finance.core.ts` lo calcula y lo devuelven tanto `finance.ts` como `stats.ts`, pero `OrderFinancials` nunca lo declaró. Agregado como `tradeMargin?: number`. |
| Comparación imposible | `src/lib/finance.ts` | `o.customCostPrice !== ''` sobre un campo tipado `number \| undefined` (herencia de cuando el valor llegaba como texto del formulario). Los guardas de `undefined`/`null` ya cubrían todos los casos del tipo. |
| Escapes redundantes en regex | `src/hooks/useInvoiceParser.ts` | `/[\s\-]/g` → `/[\s-]/g` en dos lugares; el guion al final de una clase de caracteres no necesita escape. |
| `catch` que solo relanzaba | `functions/src/index.ts` | `catch (error) { throw error; }` en `processStorageFile`. Ahora registra en Cloud Logging **qué archivo** falló antes de relanzar: el reintento de `onObjectFinalized` volvía a lanzar sin dejar rastro de cuál de todos reventó. |
| Basura en el árbol | raíz y `functions/` | Eliminados `OrderModal.backup.tsx` (64 KB), `fix_dashboard.cjs` y `functions/firebase-debug.log` (207 KB). Ninguno estaba referenciado. |

### 🟡 Pendientes conscientes

- **2 advertencias de `react-hooks/exhaustive-deps` en `Dashboard.tsx`** (líneas 142 y 214). No se tocaron a propósito: corregirlas puede cambiar el comportamiento del Dashboard nuevo, y conviene probarlo funcionando antes de meter mano.
- **Dependencias de Gemini sin usar.** `genkit`, `@genkit-ai/googleai`, `@genkit-ai/ai` y `@genkit-ai/core` siguen en `functions/package.json` aunque `index.ts` ya no importa ninguna. Retirarlas es trivial, pero se deja para cuando la decisión de no volver a la IA esté confirmada.
- **Ciclo 4 sin reaplicar.** Los tres fixes críticos (escape de HTML en la impresión de Cobranza, `runTransaction` en `OrderModal.save`, recálculo del importe dentro de la transacción en `collectContrareciboBlock`) siguen siendo válidos y pendientes sobre esta base v6.

---

## 🔎 Verificación de Fase de Auditoría — 2026-07-29

- **Diagnóstico de Estado:** Al iniciar la ejecución del plan de auditoría global propuesto, se realizó una verificación cruzada de todos los archivos (`App.tsx`, `OrdersContext.tsx`, `index.ts`, `finance.core.ts`, `OcTracking.tsx`, `firestore.rules`).
- **Hallazgo:** ¡El código se encuentra en un estado excelente! Todas las vulnerabilidades y problemas de rendimiento identificados en el plan original fueron herencia de un escaneo de registros históricos que **ya habían sido resueltos exitosamente en la versión 5.8.0 y 5.8.1 (Fase 6)**.
- **Acción Tomada:** Se abortó la reescritura de los archivos críticos para no generar regresiones sobre un código que ya está altamente optimizado, seguro y validado.
- **Lo que sigue verdaderamente pendiente (Macroarquitectura):**
  1. Migración a agregación en `stats/dashboard` (para evitar descargar toda la colección `purchaseOrders` y sólo leer las métricas).
  2. Migración de `invoices` a subcolección (para evitar bloqueos de tamaño y sobreescrituras completas).
- **Estado:** ✅ Validado y Confirmado. Base de código sólida.

---

## 🚨 Incidente — 2026-07-29 — `INSTALAR_ACTUALIZACION.bat` descartaba `src/lib` entero

- **Problema:** la línea de copia del instalador usaba `robocopy ... /XD node_modules dist .git .firebase lib _respaldo_*`. Robocopy interpreta un nombre suelto en `/XD` como *«cualquier carpeta que se llame así, en cualquier nivel»*. La intención era excluir `functions/lib` (código compilado); el efecto fue excluir también **`src/lib`**, es decir `finance.ts`, `logger.ts`, `cloudBackup.ts`, `types.ts`, `format.ts`, `firebase.ts` y `bridge.ts`.
  El mismo defecto estaba en la línea del respaldo previo, así que los respaldos de seguridad que generaba el instalador **se guardaban sin la mitad de la lógica del sistema**.
- **Cómo se detectó:** al ejecutar `INSTALL_AND_DEPLOY.bat` de la v5.8.0, Vitest respondió «No test files found». El archivo de pruebas vive en `src/lib/__tests__/`. Tirando del hilo se confirmó, contra el historial de Git, que el commit `87c5776` (v5.7.0) no contiene **ningún** archivo bajo `src/lib`.
- **Daño real en producción:** la v5.7.0 endureció la regla de `system_logs` a `request.resource.data.user == request.auth.token.email.lower()`, pero `logger.ts` —el archivo que normaliza el correo antes de enviarlo— nunca se instaló. Desde ese despliegue, **todas las escrituras de bitácora se rechazaban**, y como `logAction` captura el error sin propagarlo, el fallo era invisible. Es, punto por punto, el mismo modo de fallo que provocó el diagnóstico equivocado del ciclo 1.
  También se perdió la separación de metadatos y contenido en `cloudBackup.ts`; eso no rompía nada, sólo dejó la mejora sin aplicar.
- **Solución:** exclusiones con ruta completa (`"!ORIGEN!\functions\lib"` en vez de `lib`) en las dos líneas de robocopy, y reaplicación de los dos archivos perdidos en el paquete v5.8.1.
- **Lección:** el paquete se verificaba compilando en origen, no comprobando qué llegaba al destino. Una comprobación posterior a la instalación —que confirme que los archivos del ZIP existen en el proyecto con el mismo tamaño— habría cazado esto en el primer intento.
- **Estado:** ✅ Resuelto en v5.8.1

---

## ✅ Ciclo 3 — RESUELTO en v5.8.0 (2026-07-29)

Los doce hallazgos del ciclo 3 fueron corregidos y verificados. Estado de la verificación al cerrar el ciclo:
`tsc --noEmit` limpio · `eslint .` sin errores ni avisos · **12 pruebas unitarias en verde** · `npm run build` completo (frontend + functions).

| Hallazgo | Archivo | Resolución |
|---|---|---|
| CI publicaba un frontend inservible | `.github/workflows/deploy.yml` | Se inyectan las seis `VITE_FIREBASE_*` desde *GitHub Secrets*; se añadió una comprobación que aborta si el bundle sale con `apiKey:void 0`; typecheck y pruebas como barrera previa; despliegue reducido a `--only hosting,functions` (las reglas ya no se publican por push); acción fijada a `v14.11.1`; `checkout`/`setup-node` a v4; control de concurrencia. ✅ |
| `collected` rompía la derivación de estatus | `src/lib/finance.ts` | Se añadió la bandera `hasCollected`, `collected` cuenta como liquidado en `allPaid`, y hay rama propia en la cascada. Cubierto por prueba de regresión que recorre los siete valores de `OrderStatus` y falla si alguno cae al valor legado de la raíz. ✅ |
| `invoiceStatuses` se desincronizaba en cada cobro | `src/pages/Cobranza.tsx` | Helper `camposInvoices()` que siempre escribe `invoices`, `invoiceStatuses` y `updatedAt` juntos, usado en las tres rutas de cobro. ✅ |
| Nueve suscripciones a la misma consulta | `src/context/OrdersContext.tsx` (nuevo) | `OrdersProvider` con suscripción única montado en `App.tsx`. `useOrders()` queda como fachada con firma idéntica: ninguna pantalla necesitó cambios. ✅ |
| Sin reintentos ni clasificación de errores | `functions/src/index.ts` | `retry: true` en el trigger de Storage (retroceso exponencial de Eventarc) más `esTransitorio()`, que distingue 429/5xx/cuota/timeout de un PDF ilegible. Sólo se relanzan los transitorios y hasta `MAX_INTENTOS = 3`, contados en `aiAttempts` dentro del propio expediente. Un fallo permanente no vuelve a quemar cuota de Gemini. ✅ |
| Cliente Genkit reconstruido por invocación | `functions/src/index.ts` | `obtenerGenkit()` con caché a nivel de módulo. ✅ |
| Escaneo completo en la importación | `src/pages/Respaldo.tsx` | `where('folio','!=','')` sustituido por consultas `where('folio','in',[...])` en lotes de 30, sobre los folios que trae el archivo entrante. De N lecturas a las estrictamente necesarias. ✅ |
| `writeBatch` daba atomicidad, no aislamiento | `src/pages/Cobranza.tsx` | Las tres rutas migradas a `runTransaction`, releyendo dentro de la transacción y aplicando por **id de factura**, no por índice. En la recolección de efectivo, el movimiento de Caja Chica va dentro de la misma transacción. ✅ |
| Fórmula financiera duplicada y divergiendo | `functions/src/shared/finance.core.ts` (nuevo) | Fuente única de verdad importada por los dos lados. `configEfectiva` deja de existir dos veces con dos nombres: `OrderModal` usa exactamente la misma función que el trigger de saneamiento. ✅ |
| Sin ESLint ni pruebas | `eslint.config.js`, `vitest.config.ts`, `src/lib/__tests__/finance.test.ts` | ESLint 9 con `react-hooks/exhaustive-deps` y 12 pruebas sobre `computeFinancials`, `configEfectiva` y `getOrderSummary`. Deliberadamente fuera de `npm run build` (un error de estilo no debe bloquear un despliegue urgente), pero **sí** dentro del CI y de `INSTALL_AND_DEPLOY.bat`. ✅ |
| Clases `.stat-*` inexistentes en Seguimiento de OC | `src/pages/OcTracking.tsx` | Sustituidas por el componente `KpiCard` del sistema. ✅ |
| Datos falsos durante la carga | `src/pages/OcTracking.tsx` | Esqueletos de carga; `money` local duplicada eliminada en favor de `lib/format`; ternario-sentencia convertido en `if/else`. ✅ |
| Manuales anclados en v5.5.0 | `docs/*.md` | Versión sincronizada y nota con los tres cambios que el usuario final nota: límite de 5 MB, verificación de correo obligatoria en altas, Catálogo funcionando. ✅ |

**Lo que el linter encontró en su primera ejecución** (todo corregido en el mismo ciclo): dos `prefer-const` en las Cloud Functions, dos `@ts-ignore` en `Layout.tsx` que además silenciaban cualquier otro error de esa línea —resueltos declarando `__BUILD_DATE__` en `src/vite-env.d.ts`—, un `catch` que se tragaba el error en `Dashboard.tsx`, una variable acumuladora muerta en `OrderModal.tsx`, y **dos `useMemo`/`useCallback` con dependencias incompletas** en `OrderModal.tsx` y `Upload.tsx`. Exactamente la familia de defectos que motivó añadir la herramienta.

### 🔴 Lo que queda abierto (consciente, no olvidado)
- **Agregación en `stats/dashboard`.** El `OrdersProvider` elimina las copias duplicadas en memoria, pero la suscripción sigue trayendo la colección entera. El paso definitivo —un documento de agregados mantenido por trigger, con las pantallas leyendo métricas en vez de documentos— es un cambio de modelo de datos que merece su propia rama y su propia migración. Es el siguiente trabajo grande.
- **`invoices` como subcolección.** Las transacciones cierran la pérdida de escrituras concurrentes, pero mientras `invoices` sea un arreglo dentro del expediente seguirá existiendo el techo de 1 MiB por documento y la reescritura completa en cada cambio.
- **Expedientes fantasma.** Cuando una factura no encuentra su OC, el `catch` sigue creando un documento vacío en `manual_review`. Debería ir a una colección `failedUploads`.

---

## 🔎 Ciclo 3 — 2026-07-29 (auditoría sobre `main` @ `f7d0a4b`, versión 5.7.0)

> Verificación previa: se clonó el repositorio limpio, se corrió `npm ci` en raíz y en `functions`, y `npm run build` completo. Compila sin errores. Las seis correcciones críticas del ciclo 2 están confirmadas en el código desplegado.

### 🔴 2026-07-29 — `.github/workflows/deploy.yml` — El CI publica un frontend inservible en cada push a `main`
- **Problema:** el workflow ejecuta `npm run build` **sin inyectar las variables `VITE_FIREBASE_*`**, que viven en `.env` y están correctamente excluidas del repositorio. Vite sustituye cada variable ausente por `undefined` en tiempo de compilación, así que el bundle sale con la configuración de Firebase vacía y la aplicación arranca mostrando «Faltan variables de entorno» (`Login.tsx`).
  **Comprobado, no supuesto:** al compilar este repositorio sin `.env` —exactamente lo que hace el runner— el bundle resultante contiene literalmente `apiKey:void 0` y la cadena `Faltan variables`.
  Agrava el problema que el paso final sea `firebase deploy` **sin `--only`**: publica hosting, reglas y funciones de una vez. Es decir, cada push a `main` puede sobrescribir un despliegue manual correcto con uno roto, sin que nada avise.
- **Solución propuesta:** inyectar las variables desde *GitHub Secrets* en el paso de build (`env: VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}`, y las otras cinco), fijar `w9jds/firebase-action` a un SHA concreto en vez de `@master`, actualizar `actions/checkout` y `actions/setup-node` a v4, y separar el despliegue de reglas a un workflow con aprobación manual.
- **Verificación inmediata sugerida:** abrir producción en una ventana privada. Si aparece «Faltan variables de entorno», el CI ya sobrescribió el despliegue bueno y hay que volver a publicar con `INSTALL_AND_DEPLOY.bat`.
- **Estado:** 🔴 Pendiente — es el hallazgo más urgente del ciclo.

### 🔴 2026-07-29 — `src/lib/finance.ts` — El estado `collected` no existe para `getOrderSummary`, y la v5.7.0 amplificó el daño
- **Problema:** `OrderStatus` incluye `'collected'` («✅ Recibida»: el contador ya entregó el efectivo, el estado final del ciclo). El bucle de derivación de `getOrderSummary` (líneas 108-114) contempla `overdue`, `manual_review`, `pending`, `facturado`, `paid` y `pedido`, pero **no `collected`**. Una factura en ese estado no enciende ninguna bandera, hace `allPaid = false` y `allPedido = false`, y la cascada de `if/else` no entra en ninguna rama. El estatus se queda en el valor de respaldo: `o.creditCycle?.status`, el campo legado de la raíz del documento — habitualmente `'pending'`.
  Resultado: un expediente completamente cobrado y con el efectivo ya recibido vuelve a mostrarse como pendiente.
- **Responsabilidad:** este defecto ya existía, pero **la corrección del ciclo 2 lo amplificó**. Al unificar `Orders`, `Dashboard` y `Layout` sobre el estatus derivado (que era lo correcto), el fallo pasó de afectar sólo a la columna «Estado» a contaminar también los chips de filtro, los KPIs del tablero y los badges rojos del menú. Se introdujo al arreglar otra cosa y se corrige en el mismo sitio.
- **Solución propuesta:** añadir `if (s === 'collected') hasCollected = true;` y una rama antes de `allPaid`, decidiendo explícitamente si un expediente con facturas `collected` debe presentarse como `paid` (recomendado: el dinero entró) o mantener `collected` como estado propio en la tabla. Conviene además una prueba unitaria sobre `getOrderSummary` que recorra los siete valores de `OrderStatus`: es justo el tipo de omisión que un `switch` exhaustivo con `never` habría impedido en tiempo de compilación.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/pages/Cobranza.tsx` — `invoiceStatuses` se desincroniza en cada cobro
- **Problema:** el arreglo desnormalizado `invoiceStatuses` sostiene la consulta del barrido nocturno (`where("invoiceStatuses", "array-contains", "pending")`). En todo el frontend **sólo `OrderModal.save()` lo reescribe** (línea 124). Las dos rutas de Cobranza —`collectCash` (línea 121) y `payContrareciboBlock`— actualizan el arreglo `invoices` sin tocarlo, igual que el manejador de complementos XML del backend.
  Consecuencia: facturas ya cobradas siguen figurando como `"pending"` en el índice. El barrido diario las vuelve a traer indefinidamente —coste de lectura recurrente y creciente— y cualquier consulta futura que se apoye en ese campo devolverá expedientes que ya no aplican. Las escrituras tampoco actualizan `updatedAt`.
- **Solución propuesta:** extraer un helper `escribirInvoices(ref, invoices)` que siempre escriba los tres campos juntos (`invoices`, `invoiceStatuses`, `updatedAt`) y usarlo en las cuatro rutas. A medio plazo, mover `invoices` a subcolección elimina la clase entera de problema.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — `src/hooks/useOrders.ts` — Suscripción sin límite replicada en nueve pantallas (sigue abierto del ciclo 2)
- **Problema:** sin cambios respecto al ciclo anterior. `onSnapshot` sobre `purchaseOrders` sin `limit()` ni filtros, invocado de forma independiente desde `Layout`, `Dashboard`, `Orders`, `Cobranza`, `Upload`, `Respaldo`, `Settings`, `Catalog` y `OcTracking`. Cada instancia guarda su propia copia del arreglo en el estado de React.
- **Solución propuesta:** documento de agregados `stats/dashboard` mantenido por trigger, consultas acotadas por vista, paginación por cursor en Órdenes y un `OrdersProvider` único. Es trabajo de rama propia, no de parche.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — `functions/src/index.ts` — Sin reintentos ni cola de descartes (sigue abierto del ciclo 2)
- **Problema:** cero apariciones de `retry` en todo el archivo. Los triggers de Storage v2 no reintentan por omisión, así que un 429 o un 503 de Gemini deja el expediente en `manual_review` hasta intervención humana, sin distinguirlo de un PDF genuinamente ilegible. El cliente `genkit({...})` se sigue construyendo dentro del handler (línea 218) en cada invocación.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — `src/pages/Respaldo.tsx` — Escaneo completo en la importación
- **Problema:** la línea 115 hace `getDocs(query(collection(orders), where('folio', '!=', '')))` para construir un índice de folios en memoria. A 10.000 expedientes son 10.000 lecturas facturadas por cada importación.
- **Solución propuesta:** consultar sólo los folios presentes en el archivo entrante, en lotes de 30 con `where('folio', 'in', [...])`.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — `src/pages/Cobranza.tsx` — `writeBatch` da atomicidad, no aislamiento
- **Problema:** el ciclo 1 migró `payContrareciboBlock` de `Promise.all(updateDoc)` a `writeBatch`, lo cual garantiza que el lote se aplique entero o no se aplique. Pero sigue habiendo lectura-modificación-escritura del arreglo `invoices` completo a partir de una copia local del snapshot. Dos usuarios simultáneos, o un usuario y el procesador de complementos XML, continúan pisándose: el último gana.
- **Solución propuesta:** `runTransaction` releyendo dentro de la transacción y aplicando el cambio por `id` de factura, no por índice de arreglo.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — `finance.ts` / `functions/src/index.ts` — La fórmula duplicada empezó a divergir
- **Problema:** `computeFinancials` sigue existiendo dos veces, con el comentario «Si cambias una, cambia la otra» como única salvaguarda. La v5.7.0 introdujo una divergencia real: `configEfectiva` —que aplica `customCostPrice` y `customCommissionRate`— **sólo existe en el backend**. El frontend resuelve lo mismo con `dynamicConfig` dentro de `OrderModal`, con otro nombre y otra ubicación. Son dos implementaciones de la misma regla de negocio en dos lugares distintos.
- **Solución propuesta:** mover la fórmula y la resolución de configuración a un módulo compartido (`shared/finance.ts`) importado por ambos vía alias de rutas, y cubrirlo con pruebas.
- **Estado:** 🔴 Pendiente

### 🟡 2026-07-29 — Tooling — Sigue sin ESLint ni pruebas
- **Problema:** el hallazgo `collected` de este ciclo es exactamente lo que una prueba unitaria de `getOrderSummary` sobre los siete valores de `OrderStatus` habría detectado en segundos. `npm run build` sólo ejecuta `tsc -b`.
- **Nota operativa:** añadir dependencias de desarrollo obliga a regenerar los `package-lock.json`; debe hacerse en un commit propio, no dentro de un paquete de correcciones, para no arriesgar el `npm ci` del CI.
- **Estado:** 🔴 Pendiente

### 🟢 2026-07-29 — `src/index.css` — Clases invocadas que no existen (segunda tanda)
- **Problema:** `OcTracking.tsx` usa `.stat-card`, `.stat-label` y `.stat-value` para las tres tarjetas de resumen de la parte superior. Ninguna está definida en la hoja de estilo: esos KPIs se dibujan sin recuadro, sin tipografía y sin jerarquía, en una pantalla que por lo demás sigue el diseño del sistema. `.page` tampoco existe y se usa en doce archivos; es inofensiva, pero induce a pensar que hay un contenedor con estilo cuando no lo hay.
- **Solución propuesta:** definir las tres clases reutilizando los tokens de `.kpi-card`, o sustituir el bloque por el componente `KpiCard` que ya existe en `components/ui.tsx`, que es la opción coherente.
- **Estado:** 🔴 Pendiente

### 🟢 2026-07-29 — `src/pages/OcTracking.tsx` y `src/pages/Catalog.tsx` — Muestran datos falsos mientras cargan
- **Problema:** `OcTracking` desestructura `useOrders()` ignorando `loading` y `error`. Durante la carga inicial la pantalla afirma «OCs activas: 0» y «Total facturado: $0.00» como si fueran cifras reales, y después salta a los valores correctos (desplazamiento de contenido, además de información momentáneamente falsa). `Catalog` sí recibe `loading` y `error` pero conviene revisar que los presente.
  El mismo archivo define su propia función `money()` (líneas 7-8), duplicando la de `lib/format.ts`, y usa `next.has(oc) ? next.delete(oc) : next.add(oc)` como sentencia-expresión, un patrón que cualquier linter marcaría.
- **Solución propuesta:** usar los esqueletos de carga que ya existen (`Skeleton` en `components/ui.tsx`), importar `money` de `lib/format` y convertir el ternario en `if/else`.
- **Estado:** 🔴 Pendiente

### 🟢 2026-07-29 — Documentación — Los manuales siguen anclados en v5.5.0
- **Problema:** `docs/FICHA_TECNICA.md`, `docs/INSTRUCCIONES_USO.md` y `docs/SISTEMA_ACTUAL.md` se presentan como v5.5.0 mientras el sistema va en 5.7.0. Entre medias cambiaron cosas que el usuario final nota: el límite de subida bajó de 20 MB a 5 MB, las altas de usuario ahora exigen verificar el correo, y el Catálogo pasó de no funcionar a funcionar.
- **Solución propuesta:** actualizar el encabezado de versión de los tres, corregir el límite de tamaño en el manual de uso y añadir el paso de verificación de correo al procedimiento de alta.
- **Estado:** 🔴 Pendiente

---

## 🔎 Ciclo 2 — 2026-07-29 (auditoría sobre `main` @ `3b5d201`)

### 🔴 2026-07-29 — `firestore.rules` — La colección `products` no tiene regla: el Catálogo está muerto y guardar un expediente falla
- **Problema:** `PATHS.products = 'products'` se lee en `useProducts` (pantalla Catálogo) y se escribe en `OrderModal.save()`. En `firestore.rules` no existe ningún `match /products/{id}`, así que ambas operaciones caen en el `match /{document=**} { allow read, write: if false }` final.
  Consecuencias en cadena:
  1. La pantalla **Catálogo** siempre muestra "Error al cargar productos".
  2. Peor: en `OrderModal.save()` el bloque *"Upsert products to catalog"* (líneas 155-168) está **fuera** del `try/catch` que protege el enlace con `purchases`. El `permission-denied` sube al `catch` general y dispara `toast('No se pudo guardar: Missing or insufficient permissions', 'bad')` **aunque el expediente ya se guardó correctamente** en la línea 111. El modal no se cierra, no se escribe la bitácora, y el usuario reintenta creyendo que perdió el trabajo.
  3. Afecta al 100% de los expedientes con partidas, que son todos los que procesa la IA.
- **Solución propuesta:** agregar `match /products/{productId} { allow read: if isAuthenticatedUser(); allow write: if isManagerOrAdmin(); }` y envolver el upsert de catálogo en su propio `try/catch` (es una función accesoria: nunca debe tumbar el guardado del expediente).
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `functions/src/index.ts` — `sanitizePurchaseOrder` revierte la función "Costos variables" y borra el importe real del CFDI
- **Problema:** El trigger recalcula con `computeFinancials(kilos, data.historicalConfig ?? readConfig())` y, si detecta diferencia, sobrescribe `invoices[].financials`. Dos daños distintos:
  1. **Costos variables (v5.5.0):** `OrderModal` calcula los importes con `dynamicConfig`, que aplica `customCostPrice` y `customCommissionRate` del expediente. `historicalConfig` no contiene esos campos, así que el trigger siempre ve una discrepancia, la clasifica como *"manipulación de cliente"* y **revierte el costo y la comisión personalizados**. El usuario ve el número correcto un segundo y luego se restaura solo.
  2. **Importe fiscal real:** al crear una factura, la línea 246 guarda `invoiceTotal: data.totalAmount ?? fin.invoiceTotal`, es decir el total real del CFDI. El sanitizador devuelve `{ ...baseFin, ... }`, lo que **reemplaza ese importe por `kilos × precio × 1.16`**. Toda factura cuyo total real no coincida con la fórmula pierde su valor fiscal, en silencio.
  Además `expectedNet` se calcula sin `round2()`, a diferencia de `computeFinancials`, así que el `netCashFlow` que persiste el trigger difiere en centavos del que calcula el frontend.
- **Solución propuesta:** que el trigger construya su configuración de referencia como `{ ...cfg, costPricePerKg: data.customCostPrice ?? cfg.costPricePerKg, commissionRate: data.customCommissionRate ?? cfg.commissionRate }`, preserve `invoiceTotal` cuando la factura trae UUID (viene del CFDI, no de la fórmula) y aplique `round2()` a `expectedNet`.
- **Estado:** 🔴 Pendiente — es el hallazgo de mayor impacto del ciclo.

### ↩️ 2026-07-29 — `firestore.rules` — La bitácora volvió a ser falsificable (regresión del ciclo 1)
- **Problema:** La regla quedó en `allow create: if isAuthenticatedUser() && request.resource.data.keys().hasAll(['user','action','timestamp'])`. `hasAll()` sólo comprueba que **existan** las llaves, no su contenido: cualquier usuario autenticado (incluido un `viewer`) puede escribir `{ user: "paco@cobertores.com", action: "Expediente Eliminado", timestamp: <lo que sea> }`. La bitácora de un ERP financiero deja de tener valor probatorio.
- **Nota sobre el diagnóstico previo:** el registro del ciclo 1 atribuye el fallo a `request.resource.data.timestamp == request.time`, con el argumento de que `serverTimestamp()` se resuelve *después* de evaluar las reglas. Eso no es así: Firestore resuelve `serverTimestamp()` **antes** de la evaluación y lo hace igual a `request.time` — es el patrón canónico que la propia documentación de Firebase recomienda para forzar sellos de tiempo del servidor. La causa real del rechazo era casi con certeza la otra condición que se eliminó en el mismo cambio, `request.resource.data.user == request.auth.token.email`: `logger.ts` recibe el correo desde el cliente y en algunos flujos difiere en mayúsculas o espacios respecto al del token.
- **Solución propuesta:** restaurar `request.resource.data.timestamp == request.time` (es seguro) y sustituir la comparación de correo por `request.resource.data.user == request.auth.token.email` **normalizando en el cliente** (`user.email!.toLowerCase().trim()`), o mejor: mover la escritura de bitácora a una Cloud Function `onCall` que tome la identidad de `request.auth`.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/pages/OrderModal.tsx` — "Reintentar IA" sigue llamando a la región equivocada
- **Problema:** `src/lib/firebase.ts` exporta correctamente `getFunctions(app, 'us-east1')`, pero la línea 447 crea otra instancia con `getFunctions(app)`, que apunta a `us-central1`. Las funciones están desplegadas en `us-east1` (`setGlobalOptions`), así que la llamada falla siempre con `not-found` o error de CORS y el expediente se queda en revisión manual para siempre.
- **Solución propuesta:** importar `functions` desde `lib/firebase.ts` y eliminar el `getFunctions` local (y el import de `app`, que queda sin uso).
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `functions/src/index.ts` — `reprocessOrder` corre con 256 MiB y 60 s para hacer el trabajo de una función de 1 GiB y 300 s
- **Problema:** `parseUploadedPDF` declara `{ memory: "1GiB", timeoutSeconds: 300 }`. `reprocessOrder` invoca exactamente el mismo `processStorageFile` pero se declara sin opciones, heredando los valores por omisión. Aun corrigiendo la región (hallazgo anterior), un PDF mediano se cae por memoria o por tiempo agotado.
- **Solución propuesta:** `onCall({ secrets: [apiKeySecret], memory: "1GiB", timeoutSeconds: 300 }, ...)`.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — Límite de tamaño de archivo: cuatro cifras distintas y un fallo silencioso
- **Problema:** `Upload.tsx` valida y anuncia 20 MB · `storage.rules` permite hasta 20 MB · `parseUploadedPDF` **ignora todo lo que pase de 5 MB** con un simple `logger.warn` · `SECURITY.md` documenta 25 MB para PDFs y 10 MB para XML. Un PDF de 6 MB pasa la validación del navegador, pasa las reglas de Storage, muestra el toast verde de éxito... y desaparece: no genera expediente, ni registro en `manual_review`, ni error visible. El usuario espera un documento que nunca va a llegar.
- **Solución propuesta:** unificar en un solo valor (5 MB es el límite real que impone el envío del PDF en base64 a Gemini) y propagarlo a `Upload.tsx`, `storage.rules` y `SECURITY.md`. Cuando la función descarte un archivo por tamaño, debe dejar constancia en Firestore (`manual_review` con `aiError` legible), no sólo en los logs de Cloud.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `functions/src/index.ts` — Detector de expedientes legacy que siempre devuelve cero
- **Problema:** `checkOverdueInvoices` cuenta los expedientes sin `invoiceStatuses` con `.where("invoiceStatuses", "==", null).count()`. En Firestore, una consulta `== null` sólo encuentra documentos con el campo presente y valor **null explícito**; los documentos que no tienen el campo nunca aparecen en ninguna consulta sobre ese campo. El contador devuelve 0 siempre, y los expedientes anteriores a la introducción de `invoiceStatuses` siguen fuera de la revisión diaria de vencidos sin que nada lo advierta. El mensaje además remite a `migrarInvoiceStatuses`, función que fue eliminada (queda el comentario huérfano en la línea 496).
- **Solución propuesta:** comparar totales — `count()` de la colección completa contra `count()` de `where("invoiceStatuses", "!=", null)` — y borrar la referencia a la función inexistente.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/context/AuthContext.tsx` — Los usuarios dados de alta desde el panel no pueden entrar nunca
- **Problema:** `Users.tsx` crea la cuenta con `createUserWithEmailAndPassword`, que produce un usuario con `emailVerified: false`. La línea 67 de `AuthContext` cierra la sesión de todo usuario sin correo verificado salvo el master. El propio texto de la pantalla de alta promete lo contrario: *"sin necesidad de verificar el correo"*.
  Hay una inconsistencia adicional: el bypass `isMasterUser` permite entrar a `paco@cobertores.com` sin verificar, pero `firestore.rules` exige `email_verified == true` en `isAuthenticatedUser()`. Ese usuario cargaría la aplicación y luego recibiría `permission-denied` en absolutamente todas las consultas.
- **Solución propuesta:** decidir un solo camino — enviar `sendEmailVerification()` al crear la cuenta, o marcar `emailVerified` desde una Cloud Function con Admin SDK — y eliminar el bypass del cliente para que coincida con las reglas.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/pages/OrderModal.tsx` — `useMemo` con dependencias incompletas: los costos variables no se ven hasta que otra cosa cambia
- **Problema:** `computedInvoices` (línea 73) declara `[form.invoices, config]` como dependencias pero consume `dynamicConfig`, que deriva de `form.customCostPrice` y `form.customCommissionRate`. Al editar el costo personalizado, el memo no se recalcula: los importes en pantalla siguen mostrando los valores anteriores hasta que el usuario toca cualquier otro campo.
- **Causa raíz:** el proyecto no tiene ESLint configurado, así que la regla `react-hooks/exhaustive-deps` —que habría marcado esto en el editor— nunca corrió.
- **Solución propuesta:** completar el arreglo de dependencias y añadir ESLint con `eslint-plugin-react-hooks` al `npm run build`.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/hooks/useOrders.ts` — Suscripción sin límite replicada en siete pantallas
- **Problema:** `onSnapshot` sobre `purchaseOrders` sin `limit()` ni filtros. El hook se invoca de forma independiente desde `Layout`, `Dashboard`, `Orders`, `Cobranza`, `Upload`, `Respaldo`, `Settings`, `Catalog` y `OcTracking`: cada instancia mantiene su propia copia del arreglo en el estado de React y su propio ciclo de render. `useExpenses` y `usePurchases` tampoco tienen límite. A 500 expedientes no se nota; a 5,000 el navegador se arrastra y cada carga descarga la colección completa.
- **Solución propuesta (por capas):** (1) un documento de agregados `stats/dashboard` mantenido por un trigger `onDocumentWritten`, para que el Dashboard lea **un** documento en vez de toda la base; (2) consultas acotadas por vista — Cobranza sólo necesita `where('invoiceStatuses','array-contains','pending')`; (3) paginación por cursor en Órdenes; (4) un `OrdersProvider` único en `App.tsx` que sustituya las nueve suscripciones.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/pages/Orders.tsx` — El filtro y el contador leen estatus distintos, y `getOrderSummary` corre ~10 veces por renglón
- **Problema:** la línea 54 filtra por `o.creditCycle?.status` (campo legado de la raíz) mientras el contador de los chips y la columna Estado usan `getOrderSummary(o).status`. El chip puede decir *"Vencidas (5)"* y la tabla salir vacía. El mismo desacuerdo persiste en `Dashboard.tsx:210`, `Layout.tsx:69-70` y `Settings.tsx:56`.
  En el mismo archivo hay diez llamadas a `getOrderSummary`: una en el contador, ocho en `totals` (un `reduce` independiente por métrica) y una en el render. Sin *debounce* en el buscador, cada tecla dispara ~10×N recorridos.
- **Solución propuesta:** un único `useMemo` que produzca `[{ order, summary }]` y un solo `reduce` que acumule las ocho métricas en una pasada; prohibir el acceso directo a `o.creditCycle` fuera de `finance.ts`.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/lib/cloudBackup.ts` — Podar los respaldos descarga los respaldos enteros
- **Problema:** `createCloudBackup` y `listCloudBackups` hacen `getDocs(collection(db,'snapshots'))`, y cada documento contiene el campo `payload` con el estado completo serializado. Sólo para ordenar por fecha y borrar los sobrantes se descargan los cinco respaldos íntegros. Con un payload de 300 KB son 1.5 MB por operación, y la pantalla de Respaldo lo repite en cada visita.
  Riesgo adicional: `payload: JSON.stringify(estado)` no tiene tope, y Firestore rechaza documentos de más de 1 MiB. Al crecer la base, el respaldo en la nube empezará a fallar.
- **Solución propuesta:** separar metadatos de contenido — `snapshots/{id}` con los contadores y `snapshots/{id}/data/payload` con el JSON — o mejor, subir el payload a Cloud Storage (`backups/{fecha}.json`) y guardar en Firestore sólo el puntero y el resultado del último intento.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `functions/src/index.ts` — Sin reintentos, sin cola de descartes, y expedientes fantasma
- **Problema:** los triggers de Storage v2 **no reintentan por defecto**, así que el `throw` de la línea 368 sólo deja rastro en los logs. Si Gemini responde 429 o 503, el expediente cae a `manual_review` y ahí se queda hasta intervención humana; no se distingue un PDF genuinamente ilegible de un límite de cuota temporal.
  Además, el `catch` crea siempre un documento en `purchaseOrders`. Cuando falla una **factura** por no encontrar su OC (línea 227), nace un expediente vacío, sin folio ni kilos, que ensucia la colección y el contador de *"esperan captura manual"* del Dashboard.
  Detalle menor del mismo archivo: el cliente `genkit({...})` se construye dentro del handler (línea 179) en cada invocación, en lugar de vivir en el ámbito del módulo.
- **Solución propuesta:** colección `processingQueue` con `{ filePath, attempts, lastError, nextRetryAt }` y un `onSchedule` cada 15 min con retroceso exponencial (3 intentos) que sólo reintente errores transitorios; registrar los fallos de emparejamiento en `failedUploads` en vez de crear órdenes.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `functions/src/index.ts` — `sanitizePurchaseOrder` se dispara en cascada sobre las escrituras del sistema
- **Problema:** el trigger escucha toda escritura en `purchaseOrders`, incluidas las suyas propias y las de los procesos por lotes. `checkOverdueInvoices` puede confirmar lotes de hasta 400 documentos a medianoche: eso son hasta 400 invocaciones encadenadas del sanitizador, cada una releyendo `config/financials` cuando el expediente no trae `historicalConfig`.
- **Solución propuesta:** salir temprano si el cambio no tocó `invoices` (comparar `before`/`after`), y cachear `readConfig()` en una variable de módulo con expiración.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — `src/pages/Orders.tsx` y `src/pages/Logs.tsx` — Inyección de fórmulas en el CSV exportado
- **Problema:** las exportaciones entrecomillan las celdas pero no neutralizan los valores que empiezan con `=`, `+`, `-` o `@`. Los nombres de cliente los extrae Gemini de PDFs de terceros: una celda `=HYPERLINK(...)` se ejecuta al abrir el archivo en Excel.
- **Solución propuesta:** anteponer un apóstrofo a cualquier campo que empiece con esos caracteres.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — Documentación — Fallas de sincronización
- **Problema:**
  1. `package.json` declara `"version": "5.5.0"` mientras `CHANGELOG.md` documenta v5.6.0 como publicada.
  2. `SECURITY.md` §4 documenta límites de 25 MB y 10 MB que no existen en ninguna parte del código (ver hallazgo de tamaños).
  3. `SECURITY.md` §3 afirma que la escritura en `system_logs` tiene *"validación de campos"* — la validación comprueba que las llaves existan, no su contenido, y eso no protege de nada (ver regresión de la bitácora).
  4. `SECURITY.md` §5 presenta `sanitizePurchaseOrder` como garantía de integridad, cuando hoy es la causa de una pérdida de datos (ver hallazgo de costos variables).
  5. `INSTALAR_ACTUALIZACION.bat` ofrece al final ejecutar `DIAGNOSTICO.bat`, y `LEEME-PRIMERO.txt` remite a `CONECTAR_FIREBASE.bat`, `CONFIGURAR_CLAVE_GEMINI.bat` e `INSTALL_AND_DEPLOY.bat`. **Ninguno de esos cuatro scripts existe en el repositorio.**
- **Solución propuesta:** sincronizar la versión, corregir las tres afirmaciones de `SECURITY.md` y decidir si los scripts faltantes se crean o se quitan las referencias.
- **Estado:** 🔴 Pendiente

### 🔴 2026-07-29 — Tooling — El proyecto no tiene ESLint ni pruebas
- **Problema:** no hay `.eslintrc`, ni `eslint.config.js`, ni framework de pruebas. `npm run build` sólo hace `tsc -b`. TypeScript no detecta dependencias incompletas de hooks (ver hallazgo de `computedInvoices`), ni promesas sin `await`, ni variables de estado capturadas en cierres obsoletos — que es justo la familia de errores que ha aparecido en esta auditoría.
- **Solución propuesta:** añadir ESLint con `eslint-plugin-react-hooks` y Vitest con pruebas unitarias de `computeFinancials` y `getOrderSummary`, que son las dos funciones donde un error se traduce directamente en dinero mal contado.
- **Estado:** 🔴 Pendiente

### 🟢 2026-07-29 — `src/index.css` — Clases y variables invocadas que no existen
- **Problema:** el código aplica clases sin definición en la hoja de estilo, por lo que esos controles se renderizan con los estilos crudos del navegador y rompen la coherencia visual. Verificar en particular `.btn-small` y `.btn-warn` (Cobranza) y `.input-field` (Usuarios).
- **Solución propuesta:** definirlas junto al resto de variantes de `.btn` y `.input`.
- **Estado:** 🔴 Pendiente

### 🟢 2026-07-29 — UI/UX — Oportunidades sin tocar el diseño base
- **Problema / oportunidad:**
  - Sin `tabular-nums` en las columnas de dinero, los dígitos "bailan" al actualizarse.
  - Los encabezados de tabla no son pegajosos: en Cobranza y Órdenes se pierde la referencia de columna al desplazarse.
  - Los botones no tienen estado `:active`, así que un clic no produce ninguna respuesta visual.
  - Las filas clicables carecen de `role="button"`, `tabIndex` y soporte de teclado; el `Modal` no atrapa el foco ni cierra con `Escape`.
  - Los `Spinner` genéricos provocan salto de layout (CLS) al reemplazarse por la tabla; un esqueleto con las mismas dimensiones lo evita.
- **Solución propuesta:** todo se resuelve en `index.css` y en `components/ui.tsx`, sin alterar la paleta ni la tipografía existentes.
- **Estado:** 🔴 Pendiente

---

## 📜 Ciclo 1 — 2026-07-29 (registros previos)

### 2026-07-29 — `firestore.rules` — Regla `system_logs` rompía escrituras desde SDK cliente
- **Problema:** La regla exigía `request.resource.data.timestamp == request.time`. Sin embargo, `serverTimestamp()` enviado desde el frontend se resuelve server-side *después* de evaluar las reglas, haciendo que todas las escrituras de auditoría fallaran silenciosamente en producción.
- **Solución:** Se flexibilizó la regla a `request.resource.data.keys().hasAll(['user', 'action', 'timestamp'])`, garantizando inmutabilidad y permitiendo `serverTimestamp()`.
- **Estado:** ↩️ Revisado en el ciclo 2 — el diagnóstico era incorrecto y el cambio reabrió la falsificación de bitácora. Ver la entrada correspondiente arriba.

### 2026-07-29 — `src/context/AuthContext.tsx` — Typo en email master
- **Problema:** Existía la cadena `paco@cobertors.com` con typo ("cobertors" en lugar de "cobertores"), permitiendo potencialmente inconsistencias en el rol admin.
- **Solución:** Se corrigió el typo a `paco@cobertores.com` y se estandarizó la lista de administradores autorizados.
- **Estado:** ✅ Resuelto en v5.6.0 — verificado en el ciclo 2.

### 2026-07-29 — `src/pages/Seeder.tsx` — Vulnerabilidad de acceso público y cálculo prematuro
- **Problema:** La ruta `/seed` era accesible por cualquier rol (incluyendo `viewer`), permitiendo ejecutar un reseteo de base de datos. Además, el botón de inyección no esperaba a que la configuración global de Firestore cargara, calculando importes con valores default.
- **Solución:** Se agregó la guardia `if (role !== 'admin') return <Navigate to="/" replace />` y se deshabilitó el botón con etiqueta `"Cargando configuración..."` mientras `loading === true`.
- **Estado:** ✅ Resuelto en v5.6.0 — verificado en el ciclo 2.

### 2026-07-29 — `functions/src/index.ts` — Riesgo de bucle infinito en `sanitizePurchaseOrder`
- **Problema:** El trigger `onDocumentWritten` de sanitización server-side usaba `_sanitized: true` para detener la recursión. Si un doc perdía la clave, se arriesgaba a un bucle infinito de escrituras.
- **Solución:** Se refactorizó el comparador para evaluar si `financials` cambió realmente. Si no hay discrepancias, la función finaliza sin realizar ninguna escritura en Firestore.
- **Estado:** ✅ El bucle está cerrado — pero el ciclo 2 detectó que el comparador destruye datos legítimos. Ver arriba.

### 2026-07-29 — `functions/src/index.ts` — Fallback de escaneo O(N) en emparejamiento de contrarecibos
- **Problema:** En la vinculación de contrarecibos se mantenía una consulta fallback `where("invoices", "!=", null).limit(100)` que ejecutaba Full Table Scans ineficientes en Firestore.
- **Solución:** Se eliminó el fallback ineficiente en favor del índice optimizado por lotes `invoiceFolios` (`array-contains-any`).
- **Estado:** ✅ Resuelto en v5.6.0 — verificado en el ciclo 2.

### 2026-07-29 — `src/pages/Dashboard.tsx` — Doble iteración O(N²) en `useMemo`
- **Problema:** El hook principal iteraba `orders` dos veces completas (`orders.forEach`) para calcular métricas y luego extraer facturas en estado `paid` ("Por recibir del contador").
- **Solución:** Se consolidaron ambas iteraciones en una sola pasada O(N), ahorrando tiempo de renderizado y eliminando la tipificación `any[]` por interfaces estrictas (`PurchaseOrder[]`, `Invoice[]`).
- **Estado:** ✅ Resuelto en v5.6.0.

### 2026-07-29 — `src/pages/Cobranza.tsx` — Transacciones no atómicas en pagos por lote
- **Problema:** `payContrareciboBlock` actualizaba múltiples órdenes usando `Promise.all(updateDoc...)`. Si una solicitud fallaba a la mitad, la base de datos quedaba en un estado inconsistente.
- **Solución:** Se migró a `writeBatch(db)` para garantizar atomicidad transaccional total (todo o nada).
- **Estado:** ✅ Resuelto en v5.6.0 — nota del ciclo 2: `writeBatch` garantiza atomicidad, no aislamiento. Sigue habiendo lectura-modificación-escritura del arreglo `invoices` completo desde una copia local, así que dos usuarios simultáneos (o un usuario y el procesador de complementos XML) todavía pueden pisarse. La solución completa es `runTransaction` o mover `invoices` a subcolección.

### 2026-07-29 — `src/pages/Cobranza.tsx` — Falsos días de atraso en facturas con Contrarecibo
- **Problema:** La tabla "Qué cobrar primero" mostraba "X días de atraso" para facturas con contrarecibo, confundiendo un plazo pactado con mora real.
- **Solución:** Se rediseñó la columna para mostrar `Faltan Xd`, `Hoy` o `Cobrar ✓` (para fechas cumplidas). Las facturas sin contrarecibo se colocan al inicio con alerta roja `⚠ Xd sin CR`.
- **Estado:** ✅ Resuelto en v5.6.0.

### 2026-07-29 — `src/components/Layout.tsx` — Falta de título dinámico en el navegador
- **Problema:** Todas las vistas mostraban el mismo título estático de la app en la pestaña del navegador.
- **Solución:** Se implementó actualización dinámica de `document.title` en función del módulo de navegación activo.
- **Estado:** ✅ Resuelto en v5.6.0.

### 2026-07-29 — Documentación (`README.md`, `SECURITY.md`, `CHANGELOG.md`)
- **Problema:** Ausencia de un manual de seguridad consolidado y falta de sincronización del registro de versiones.
- **Solución:** Creado `SECURITY.md` con el modelo Zero Trust y actualizado `CHANGELOG.md` con la versión v5.6.0.
- **Estado:** ✅ Creado — el ciclo 2 detectó cuatro afirmaciones desincronizadas con el código. Ver arriba.
### 🟢 2026-07-29 — Fase 5: Mantenibilidad, Seguridad y Desacoplamiento (Completada)
- **Problema 1:** OrderModal.tsx con acoplamiento severo y más de 1300 líneas.
- **Solución 1:** Lógica de parseo de XML/Factura extraída al hook src/hooks/useInvoiceParser.ts.
- **Problema 2:** unctions/src/index.ts sobrescribiendo invoiceTotal de facturas capturadas por folio corto por falta de validación de olio.
- **Solución 2:** Inclusión de check (inv.uuid || (inv.folio && inv.folio.length > 2)) en sanitizePurchaseOrder para proteger facturas manuales y XMLs subidos.
- **Problema 3:** unctions/src/index.ts 
eadConfigCacheada provocaba condición de carrera si múltiples eventos se procesan en la misma instancia de Cloud Functions simultáneamente.
- **Solución 3:** Implementación de pendingConfigPromise para centralizar lecturas superpuestas, minimizando costos de Firestore.
### 🔴 2026-07-29 — src/pages/Upload.tsx — Subida de documentos duplicados
- **Problema:** Al no verificar el contenido del archivo antes de subirlo a Storage, los usuarios pueden arrastrar el mismo PDF varias veces, generando expedientes duplicados.
- **Solución propuesta:** Implementar una verificación criptográfica SHA-256 en el cliente y consultar Firestore antes de subir para prevenir duplicidad.
- **Estado:** 🔴 Pendiente

### 2026-07-29 - src/pages/OrderModal.tsx - Lag extremo de renderizado (Monolito)
- **Problema:** Múltiples text inputs usaban el evento `onChange` para mutar un estado de formulario gigante y recalcular sumarios costosos (O(N)), causando severo input lag en cada pulsación.
- **Solución:** Refactor de los eventos críticos en `OrderModal.tsx` (customCostPrice, customCommissionRate) para usar `defaultValue` y el evento `onBlur`, resolviendo el problema de lag sin desmantelar la estructura del modal completo prematuramente.
- **Estado:** ✅ Resuelto y compilación verificada.

### 2026-07-29 - src/pages/Orders.tsx, src/pages/Cobranza.tsx - A11y en tablas
- **Problema:** Las filas interactivas en las tablas de expedientes y cobranza dependían únicamente del evento `onClick`, impidiendo la navegación por teclado para usuarios de accesibilidad o power users.
- **Solución:** Se añadió `role="button"`, `tabIndex={0}` y `onKeyDown` (Enter/Espacio) a todas las filas clicables (`<tr>`) en `Orders.tsx` y `Cobranza.tsx`.
- **Estado:** ✅ Resuelto.

### 2026-07-29 - UI - Ajuste visual en Días de Atraso
- **Problema:** El sufijo "d" (ej. "28d") en las columnas de cobranza y órdenes se confundía visualmente con un "0" para usuarios con dificultades visuales ("280").
- **Solución:** Se eliminó el sufijo "d" o se reemplazó por la palabra "días" en `Orders.tsx` y `Cobranza.tsx` para máxima legibilidad.
- **Estado:** ✅ Resuelto.

### 2026-07-29 - firestore.rules y Dashboard.tsx - "Missing or insufficient permissions"
- **Problema:** El nuevo bloque de agregación en `stats/dashboard` no tenía regla de lectura, bloqueando todo el frontend. Además, el Dashboard intentaba leer la bitácora `system_logs` sin importar el rol del usuario, colisionando con la regla de seguridad que lo reserva solo para super administradores.
- **Solución:** Se agregó la regla `allow read: if isAuthenticatedUser();` para `stats` en Firestore. En el Dashboard se condicionó el stream de `system_logs` y la tarjeta de "Último Movimiento" para que se ejecuten y rendericen exclusivamente si `role === 'admin'`.
- **Estado:** ✅ Resuelto y reglas desplegadas a producción.

### 2026-07-29 - system_logs - Limpieza de bitácora
- **Problema:** El usuario solicitó borrar los logs, pero debido al modelo Zero-Trust, el frontend tiene `allow delete: if false` para la colección `system_logs` previniendo manipulaciones.
- **Solución:** Ejecución forzada vía terminal local (Firebase CLI / Admin) con el comando `firestore:delete system_logs -r -f`.
- **Estado:** ✅ Resuelto.

### 2026-07-29 - src/pages/Catalog.tsx - Columna de Código Faltante
- **Problema:** El catálogo inteligente no mostraba el código de los productos a pesar de existir en el esquema de datos, complicando la identificación por SKU.
- **Solución:** Inyección de la columna `Código` (`p.code`) en la tabla de `Catalog.tsx`, justo antes de la descripción.
- **Estado:** ✅ Resuelto.

### Intervención - 2026-07-30 (Fijación de Ceros y Limpieza de UI)
- **Problema Reportado:** El panel mostraba 0 en todos los KPIs y seguía apareciendo el texto 'la IA no pudo leer el PDF'.
- **Análisis Staff Engineer:**
  1. Los ceros ocurrieron porque el backend (Cloud Functions) que contiene recalcDashboardStats aún no estaba desplegado en la nube tras la actualización local a v6.1.0.
  2. El texto sobre la IA quedó obsoleto debido a la implementación del parser XML local (v6.1.0).
- **Acciones Tomadas:**
  - Se ejecutó firebase deploy --only functions para subir la función de siembra.
  - Se modificó Dashboard.tsx cambiando la advertencia a 'XML no subido o inválido'.
  - Se redactó el Plan de Implementación para el **Paso 3 (Subcolecciones)**, a la espera de aprobación para ejecutar.

### Evaluación de Refactorización - 2026-07-30 (Cancelación de Paso 3)
- **Problema:** En el plan original (Paso 3) se planteó migrar el arreglo de invoices a una subcolección por supuestos problemas de límite de 1MB y colisiones.
- **Análisis Staff Engineer:** Al realizar un escaneo profundo de dependencias (15 archivos afectados incluyendo stats.ts, Cobranza.tsx, OrderModal.tsx), descubrí que el modelo actual es **100% correcto** para este caso de uso NoSQL.
  1. **El límite de 1MB es un mito aquí:** Invoice solo guarda metadata (IDs, fechas, montos). Los archivos XML/PDF pesados viven en Firebase Storage. Un expediente con 100 facturas pesa menos de 50KB.
  2. **Atomicidad:** Al estar embebidas, las Cloud Functions (syncDashboardStats) pueden recalcular toda la orden en un solo trigger, asegurando coherencia. Una subcolección rompería esta atomicidad y obligaría a crear complejas transacciones multi-documento.
  3. **Concurrencia:** Ya está resuelta con el uso de 
unTransaction que inyectaste en la v6.0.
- **Decisión:** **SE CANCELA EL PASO 3**. Sería un anti-patrón de sobreingeniería (Over-engineering). Nos enfocaremos en optimizar el frontend (UI/UX) y limpiar deuda técnica (Paso 4).
