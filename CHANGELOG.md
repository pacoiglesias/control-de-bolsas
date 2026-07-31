# Historial de Versiones (Changelog) - Control Bolsas

## [v6.10.0] - 30 Julio 2026 (Ciclo 14 — Deuda con Andrés sobre lo entregado)

### Cambiado — decisión de negocio confirmada por el usuario
- **La deuda con Andrés se reconoce sobre lo entregado, no sobre lo pedido.** Antes, guardar un expediente registraba de golpe la deuda por toda la OC. Ahora sube en la proporción exacta de lo que Andrés va entregando — refleja que a veces entrega sin anticipo y el saldo debe ajustarse a eso.
- **Efecto de un solo golpe:** los expedientes existentes recalculan su compra a Andrés la próxima vez que se guarden. El saldo en "Estado de Cuenta" se moverá visiblemente la primera vez que cada uno se reabra — es la corrección tomando efecto, no un error.


## [v6.9.0] - 30 Julio 2026 (Ciclo 13 — Versión sincronizada, saldo con Andrés)

### Corregido — crítico
- **La versión mostrada en el sistema no coincidía consigo misma.** `Layout.tsx` tenía el número escrito a mano en dos lugares que ya no coincidían entre sí, y la "Bitácora Histórica" del Dashboard estaba congelada en v6.0.0 desde hace ocho ciclos. `vite.config.ts` ahora inyecta la versión real de `package.json` en tiempo de compilación — un solo lugar donde vive el número, para siempre.
- **`receivedKilos` nunca se sincronizaba** en la compra automática a Andrés: "Kilos Recibidos (Entregas parciales)" en Compras no reflejaba lo realmente entregado. Ahora se sincroniza con cada guardado del expediente.

### Agregado
- Historial completo v6.1.0–v6.8.0 agregado a la Bitácora Histórica del sistema.
- Tarjeta de saldo con Andrés en Compras, con icono y explicación de quién debe a quién y cómo se ajusta.

### Pendiente de decisión
- La deuda con Andrés se reconoce sobre lo pedido, no sobre lo entregado. Es una decisión de negocio, se dejó pendiente de confirmación del usuario.


## [v6.8.0] - 30 Julio 2026 (Ciclo 12 — Lista de sugerencias)

### Agregado
- **"Te deben" separado en sin-contrarecibo / con-contrarecibo generado**, en el panel y en la agregación del servidor.
- **Referencia de transferencia** para conciliar el depósito del contador contra el estado de cuenta bancario.
- **Datos SAT en Configuración** (clave de producto, unidad, método y forma de pago), conectados a la remisión impresa.
- `checkOverdueInvoices` ahora deja un registro buscable en `/logs` con los folios que vencieron cada día.

### Corregido — seguridad
- **Vulnerabilidad alta en producción (`@genkit-ai/core`) eliminada.** Era la dependencia muerta de la IA retirada, sin una sola importación real. `functions` pasó de 12 vulnerabilidades altas a 0 altas y 0 críticas.
- `npm audit` de la raíz revisado: todas las alertas altas/críticas restantes son de herramientas de desarrollo (eslint, vite, vitest), nunca llegan al navegador.

### Limpieza
- `src/lib/seedData.ts` eliminado (huérfano desde el Ciclo 7).

### Pendiente, a propósito
- Precio por producto/cliente: requiere rediseñar el motor financiero, se deja para una sesión dedicada.
- Recordatorio de vencimientos por correo: no hay servicio de mail conectado.


## [v6.7.0] - 30 Julio 2026 (Ciclo 11 — Menú claro, Compras con código de producto)

### Cambiado
- **Menú sin confusión entre `/ordenes` y `/oc`.** Renombradas a "Expedientes" y "Por Orden de Compra", con nota cruzada en cada pantalla: leen la misma colección, una es por expediente y la otra agrupa por número de OC.

### Agregado
- **Código de producto en Compras**, con búsqueda en el catálogo compartido: autocompleta descripción, unidad y precio al encontrar coincidencia, y ofrece dar de alta el código con un clic si no existe.

### Corregido
- **Catálogo emparejaba productos por texto exacto de la descripción.** Ahora empareja por código, que es estable; la descripción queda como respaldo solo para renglones antiguos sin código.

## [v6.6.0] - 30 Julio 2026 (Ciclo 10 — Compilación reparada, margen corregido)

### Corregido — crítico
- **El proyecto local no compilaba.** Una variable fuera de alcance en `Cobranza.tsx` bloqueaba cualquier build.
- **Hook llamado condicionalmente en `Compras.tsx`** (`useToast()` después de dos returns tempranos): riesgo de que React reviente el componente al resolver el rol de usuario.
- **"Ganancia Comercial" seguía en $0.00.** El respaldo de cálculo en el navegador usaba un campo que no existe en el modelo (`materialCost` en vez de `costTotal`) y se disparaba de más, pisando un valor que el servidor ya calculaba bien.

### Agregado
- **Botón "Facturar lo entregado"** en el expediente: suma los kilos entregados de todos los renglones y arma la factura automáticamente, con aviso de faltante contra lo pedido.


## [v6.5.0] - 30 Julio 2026 (Ciclo 11-14 — Motor Dinámico, Pre-Factura CFDI 4.0 & Audio Sensorial)

### Agregado
- **Motor Financiero Dinámico (`computeDynamicFinancials`):** Implementación canónica de las 6 reglas matemáticas de utilidad e instructivo de despeje dinámico por monto recibido neto o porcentaje real de comisión.
- **Generador de Pre-Factura CFDI 4.0 (PDF):** Botón vectorial de impresión en `OrderModal.tsx` con la estructura fiscal requerida por Grupo Textil Providencia (RFC `GTP930115PU1`, Clave SAT `24141500`, Unidad `KGM`, Método `PPD`, Forma `99`).
- **Feedback Sensorial de Audio:** Integración de `sounds.ts` con `ToastContext.tsx`. Emitición de micro-tonos sintéticos nativos (Web Audio API) para notificaciones exitosas (`ok`), advertencias (`bad`) e informativas (`info`).
- **Sincronización de Entrega Real de Andrés (OC 120267114014):** Registro exacto de 2,964.16 kg entregados ($161,606.00 con IVA).

### Corregido — crítico
- **Cuadre Exacto de Libro Mayor y Caja Chica ($75,265.56):** Identificado que la "Deuda con Andrés ($125,175.56)" es un Pasivo (Cuentas por Pagar) y no un egreso físico de efectivo. El saldo de Caja Chica cuadra a $75,265.56 al centavo.
- **Reubicación de TH-836 ($106,720.17):** Posicionado como el 1.º de los 12 Contrarecibos, cuadrando el total por cobrar en "ME DEBEN" a $1,435,270.48.
- **Chunking Seguro de Batches en Firestore:** Previene excepciones por el límite de 500 operaciones al borrar o sembrar datos masivos (`deleteInBatches` en `Seeder.tsx`).


## [v6.4.0] - 30 Julio 2026 (Ciclo 9 — Caja Chica recibe el importe real)

### Corregido — crítico
- **El cobro en bloque registraba en Caja Chica la utilidad en vez del depósito.** Restaba el costo del material, que ya se paga a Andrés por separado desde Compras: se contaba dos veces. En un contrarecibo real la diferencia eran 140,398.44 pesos.
- **Los dos caminos de cobro no coincidían.** El cobro individual desde el expediente ya registraba el importe correcto; el cobro en bloque no. Unificados.
- **Comisión ajustada a la realidad: 8% del subtotal.** Verificado contra tres cobros; el de 153,381.00 cuadra al centavo. Antes usaba 6.9% sobre el total, que erraba unos pesos por contrarecibo.

### Agregado
- El paquete consolidado impreso ahora muestra el **depósito que recibes**, no solo el margen.

### ⚠️ Requiere acción
En **Configuración**: comisión **8**, base **subtotal (sin IVA)**, precio de venta **47**. Manda lo guardado en Firestore, no el valor por omisión del código.


## [v6.3.0] - 30 Julio 2026 (Ciclo 8 — Base de comisión corregida)

### Corregido — crítico
- **La comisión se calculaba sobre el subtotal en vez del total con IVA.** Verificado contra el contrarecibo real TR_3583: 182,250.55 × 0.069 = 12,575.29 es lo que efectivamente descuentan. El sistema calculaba 10,840.77, subestimando la comisión en 1,734.52 en ese solo contrarecibo e inflando la utilidad esperada por la misma cantidad. Corregido en frontend y backend a la vez.
- **Regresión propia detectada y corregida:** la migración derivaba kilos dividiendo importes brutos entre el precio neto (47), inflándolos un 16%. Ahora usa el precio con IVA (54.52 = 47 × 1.16).

### Pruebas
- La prueba de `computeFinancials` fijaba la base equivocada; actualizada con la verificación real. Nueva prueba que cubre el modo `commissionBase: 'subtotal'`.

### ⚠️ Requiere acción
Revisa **Configuración**: manda lo guardado en Firestore, no el valor por omisión. La base de comisión debe decir *total (con IVA)* y el precio de venta debe ser **47**, no 54.52.


## [v6.2.0] - 30 Julio 2026 (Ciclo 7 — La carga inicial por fin funciona)

### Corregido — crítico
- **La migración creaba expedientes invisibles.** `Seeder.tsx` nunca escribía `invoiceStatuses`, el arreglo desnormalizado del que dependen todas las consultas del sistema (Dashboard, Cobranza y el barrido nocturno). Los registros quedaban bien guardados en Firestore pero no aparecían en ninguna pantalla, mientras la migración reportaba éxito.
- **`PurchaseOrder` no declaraba `invoiceStatuses`.** Por eso nada impedía que una ruta de escritura lo omitiera. Ya está declarado y documentado.
- **La migración terminaba con el panel en ceros.** Ahora invoca `recalcDashboardStats` al final y reporta cuántos expedientes procesó.

### Cambiado
- **Se retiró la carga de datos de ejemplo del panel principal.** El aviso inyectaba 15 registros ficticios desde `seedData.ts`, mezclándolos con los reales. Ahora enlaza a `/seed`, que carga contrarecibos y facturas de verdad, y solo lo ven los administradores.
- El precio de venta dejó de estar incrustado (`54.52`) en la migración: se toma de la configuración.


## [v6.1.1] - 30 Julio 2026 (Ciclo 6 — Proveedores y Estado de Cuenta)

### Nuevas Características y Correcciones Críticas
- **Implementación del Estado de Cuenta de Proveedor**: Integración completa del proveedor "Andrés". Las órdenes de compra y los pagos desde la Caja Chica se consolidan cronológicamente.
- **Sincronización Automática de Egresos**: Los pagos a proveedores ahora se ligan automáticamente y reducen el saldo deudor global exacto.
- **Corrección en Siembra Inicial (Ceros en Dashboard)**: Se reparó un bug arquitectónico donde las facturas (`invoices`) de las órdenes históricas no eran inyectadas en la base de datos semilla. Esto provocaba que el `syncDashboardStats` sumara $0. Ahora `seedData.ts` inyecta las facturas correctamente para las operaciones del Excel.

## [v6.1.0] - 30 Julio 2026 (Ciclo 5 — Panel funcional, backfill y Ciclo 4 sobre v6)

### Corregido — el panel principal mostraba todo en cero
- **Faltaba la siembra inicial de la agregación.** `syncDashboardStats` es incremental: solo suma diferencias cuando se escribe un expediente. Los expedientes previos a su despliegue nunca dispararon un evento, así que `stats/dashboard` nacía vacío. Nueva función invocable **`recalcDashboardStats`** que reconstruye el documento recorriendo todos los expedientes, con un botón **"Recalcular Indicadores"** en el panel (solo administradores). Sirve además como reconciliación si las cifras se desfasan.
- **`porRecibir` tenía tipos incompatibles** entre el trigger (número) y el panel (arreglo). El panel habría reventado en cuanto las estadísticas se llenaran. El detalle por factura ahora se arma en el cliente, que es de donde puede salir.
- **Las facturas en estatus `paid` no se cargaban**, dejando sin datos la tabla "Por Recibir del Contador".
- **Los logs en vivo nunca cargaban para el administrador**: el efecto dependía de `role`, que llega asíncrono, pero tenía dependencias vacías.

### Corregido — seguridad y concurrencia (Ciclo 4 reaplicado sobre v6)
- **HTML sin escapar** en el paquete consolidado de Cobranza, abierto como Blob URL con el mismo origen que la aplicación. `escapeHtml()` centralizado y aplicado a las tres plantillas de impresión.
- **`OrderModal.save()` ya no sobrescribe cambios concurrentes en silencio**: migrado a `runTransaction` con concurrencia optimista.
- **El importe inyectado en Caja Chica se recalcula dentro de la transacción**, no desde el snapshot ya renderizado.
- Fuga de memoria en las tres impresiones (blob URLs sin revocar).

### Rendimiento
- **Chunk principal: 598 kB → 34.9 kB.** Carga diferida por ruta y Recharts en su propio chunk.
- KPIs del panel dejan de recalcularse en cada render.


## [v6.0.0] - 30 Julio 2026 (Arquitectura O(1), retiro de la IA, y reparación para que compile)

> Esta versión se desarrolló en una sesión previa pero **nunca llegó a compilar**: quedó a medio terminar en la carpeta local, sin subir a Git. Esta entrega la deja funcionando por primera vez, con `tsc`, `eslint`, pruebas y build en verde.

### Arquitectura (de la sesión previa)
- **Agregación server-side** (`functions/src/stats.ts`): el trigger `syncDashboardStats` mantiene un documento singleton, de modo que el Dashboard deja de leer la colección completa. Cierra uno de los pendientes de fondo del Ciclo 3.
- **Paginación en tiempo real** en el historial de órdenes.
- **Deshacer cobros en bloque**: devuelve lotes enteros de contrarecibos al estado "Por cobrar".

### Retiro de la IA de Gemini (de la sesión previa)
- Los PDF ya no se envían a Gemini: se crea un expediente vacío en `manual_review` y la captura es manual.
- **Los XML de CFDI se procesan nativamente** con `fast-xml-parser`. Para complementos de pago esto es preferible a la IA, porque el resultado es determinista: se leen los `IdDocumento` de los `DoctoRelacionado` y se marcan las facturas correspondientes como `issued`.
- Nuevo `src/hooks/useInvoiceParser.ts`: parser de facturas y pagos del lado del cliente, por expresiones regulares, a partir de texto pegado o de un XML.

### Corregido — para que la versión compilara
- **Violación de las Reglas de Hooks en `OrderModal.tsx`.** `useInvoiceParser` se invocaba dentro de un IIFE que solo se ejecuta en la pestaña "facturas". Al cambiar de pestaña, React encontraba distinta cantidad de hooks entre renders y el modal reventaba con *"Rendered more hooks than during the previous render"*. Movido al nivel del componente.
- **Importe `NaN` en la compra al fabricante.** El upsert de la compra a Andrés multiplicaba por `ccp`, que vale `undefined` cuando no se captura un costo propio, y guardaba `pricePerKg` y `totalAmount` inválidos. Ahora usa el costo efectivo resuelto por `configEfectiva` y redondea con `round2`.
- `tradeMargin` faltaba en la interfaz `OrderFinancials`, pese a que `computeFinancials()` lo calcula y tanto `finance.ts` como `stats.ts` lo leen.
- Comparación imposible en `finance.ts`: `customCostPrice !== ''` sobre un campo tipado como número.
- Escapes redundantes en dos expresiones regulares de `useInvoiceParser.ts`.
- `catch (error) { throw error; }` en `processStorageFile`: ahora registra qué archivo falló antes de relanzar, para que el reintento de `onObjectFinalized` deje rastro útil.

### Limpieza
- Eliminados del árbol `OrderModal.backup.tsx` (64 KB), `fix_dashboard.cjs` y `functions/firebase-debug.log` (207 KB). Ninguno estaba referenciado.
- Versión sincronizada en `package.json`, `package-lock.json` (raíz y functions) y en las dos menciones de `Layout.tsx`, que seguían anunciando v5.8.1.

### Pendiente
- Las dependencias de Gemini (`genkit`, `@genkit-ai/*`) siguen instaladas en `functions/package.json` sin usarse.
- Los tres fixes críticos del Ciclo 4 (escape de HTML en la impresión de Cobranza, `runTransaction` en `OrderModal.save`, recálculo del importe dentro de la transacción en Cobranza) están pendientes de reaplicar sobre esta base.

## [v5.8.1] - 29 Julio 2026 (Corrección del instalador)

### Corregido — crítico
- **`INSTALAR_ACTUALIZACION.bat` descartaba `src/lib` en cada instalación.** La exclusión `/XD ... lib` de robocopy, pensada para `functions/lib`, se aplicaba a cualquier carpeta con ese nombre a cualquier nivel. Ninguna corrección sobre `finance.ts`, `logger.ts`, `cloudBackup.ts` o `types.ts` había llegado jamás al proyecto. El mismo fallo estaba en la línea del respaldo previo, que por tanto guardaba copias incompletas. Ahora las exclusiones llevan ruta completa.
- **Bitácora reparada.** La v5.7.0 endureció la regla de `system_logs` exigiendo que el correo coincida con el del token, pero `logger.ts` —que lo normaliza— nunca se instaló: desde entonces todas las escrituras de auditoría se rechazaban en silencio. Reaplicado.
- **Respaldos en la nube:** reaplicada la separación entre metadatos y contenido (`snapshots/{id}/blob/data`), también perdida por el mismo motivo.

## [v5.8.0] - 29 Julio 2026 (Auditoría de Automejora Continua — Ciclo 3)

### Corregido — crítico
- **El CI dejó de publicar un frontend inservible.** El workflow compilaba sin inyectar las `VITE_FIREBASE_*`, así que el bundle salía con `apiKey: void 0` y la app arrancaba en «Faltan variables de entorno»; como además desplegaba todo sin `--only`, cada push podía sobrescribir un despliegue manual correcto. Ahora las variables vienen de *GitHub Secrets*, hay una comprobación que aborta si el bundle sale vacío, y las reglas de seguridad ya no se publican por push.
- **El estado `collected` volvió a existir para el sistema.** `getOrderSummary` no lo contemplaba: una factura cobrada y recibida no encendía ninguna bandera y el estatus caía al campo legado de la raíz, así que un expediente completamente liquidado se mostraba como pendiente. Cubierto con prueba de regresión sobre los siete estados.
- **`invoiceStatuses` deja de desincronizarse.** Las rutas de cobro actualizaban `invoices` sin tocar el arreglo desnormalizado que sostiene el barrido nocturno; facturas ya cobradas seguían figurando como pendientes y se releían cada noche indefinidamente.

### Corregido — concurrencia e integridad
- **Cobranza es transaccional.** Las tres rutas de escritura pasaron de `writeBatch` a `runTransaction`, releyendo dentro de la operación y aplicando por id de factura. `writeBatch` daba atomicidad pero no aislamiento: dos usuarios simultáneos seguían pisándose. En la recolección de efectivo, el movimiento de Caja Chica ahora ocurre dentro de la misma transacción.
- **Fórmula financiera con fuente única.** `computeFinancials` y `configEfectiva` viven en `functions/src/shared/finance.core.ts`, importado por frontend y backend. Estaban duplicadas y ya habían divergido.

### Resiliencia
- **Reintentos automáticos con criterio.** `retry: true` en el trigger de Storage más una función que distingue fallos transitorios (429, 5xx, cuota, timeout) de permanentes. Sólo se reintentan los primeros, hasta tres veces, contando los intentos en el propio expediente. Un PDF ilegible ya no consume cuota de Gemini reintentándose.
- El cliente de Genkit se construye una vez por instancia en vez de en cada invocación.

### Rendimiento
- **Suscripción única a `purchaseOrders`.** `useOrders()` se invocaba de forma independiente desde nueve pantallas, cada una con su copia del arreglo y su ciclo de render. Ahora hay un `OrdersProvider` en la raíz; el hook conserva la misma firma.
- **La importación de respaldos dejó de escanear la base completa.** Sustituido por consultas `in` en lotes de 30 sobre los folios del archivo entrante.

### Calidad
- **ESLint y Vitest.** 12 pruebas sobre las dos funciones donde un error se traduce en dinero mal contado. El linter, en su primera ejecución, encontró dos `useMemo`/`useCallback` con dependencias incompletas, dos `@ts-ignore` que silenciaban errores, un `catch` mudo y una variable acumuladora muerta: todo corregido.
- `INSTALL_AND_DEPLOY.bat` corre `npm ci` y las pruebas antes de desplegar, y se detiene si algo falla.
- El instalador dejó de excluir `package-lock.json`: excluirlo desincronizaba las dependencias cuando una actualización las cambiaba.

### Interfaz
- Seguimiento de OC usa el `KpiCard` del sistema (las clases `.stat-*` nunca existieron) y muestra esqueletos de carga en vez de afirmar «0 OCs» y «$0.00» mientras carga.

### Documentación
- Manuales sincronizados a v5.8.0 con nota sobre el límite de 5 MB, la verificación de correo obligatoria y el Catálogo funcionando.
- `AUDIT_NOTEBOOK.md` con el ciclo 3 cerrado y los tres puntos que quedan abiertos a conciencia.

## [v5.7.0] - 29 Julio 2026 (Auditoría de Automejora Continua — Ciclo 2)

### Corregido — datos
- **`sanitizePurchaseOrder` dejó de destruir datos legítimos.** El trigger revertía los costos y comisiones propios del expediente (función *Costos variables*, v5.5.0) porque los comparaba contra `historicalConfig`, que no los contiene, y los clasificaba como manipulación del cliente. Además sobrescribía el `invoiceTotal` real del CFDI con `kilos × precio × IVA`, borrando el importe fiscal timbrado. Ahora la fórmula de referencia aplica `customCostPrice` y `customCommissionRate`, y el total de una factura con UUID se preserva intacto.
- **Guardar un expediente ya no reporta un error falso.** La colección `products` no tenía regla en Firestore, así que el alta en catálogo fallaba con `permission-denied` y —al estar fuera del `try/catch`— hacía aparecer «No se pudo guardar» sobre un expediente que sí se había guardado. Se agregó la regla y se aisló el alta de catálogo.
- **La pantalla Catálogo vuelve a cargar** (mismo origen: faltaba la regla de `products`).

### Corregido — seguridad
- **Bitácora infalsificable.** La regla de `system_logs` sólo comprobaba que existieran las llaves `user`, `action` y `timestamp`, no su contenido: cualquier usuario autenticado podía firmar una entrada con el correo de otro. Ahora se exige `user == request.auth.token.email` en minúsculas y `timestamp == request.time`. `logger.ts` normaliza el correo antes de enviarlo.
- **Exportaciones CSV saneadas** en Órdenes y Bitácora: se neutralizan las celdas que empiezan con `=`, `+`, `-` o `@` (los nombres de cliente los extrae la IA de PDFs de terceros).
- **Borrado en Storage restringido a `admin`**; el límite de subida bajó a 5 MB, alineado con lo que realmente procesa la IA.

### Corregido — funcionalidad
- **«Reintentar IA» funciona.** La llamada se creaba con `getFunctions(app)` sin región, apuntando a `us-central1` mientras las funciones viven en `us-east1`: fallaba siempre.
- **`reprocessOrder` corre con 1 GiB y 300 s**, los mismos recursos que `parseUploadedPDF`. Antes heredaba 256 MiB / 60 s y se caía con cualquier PDF mediano.
- **Los usuarios dados de alta desde el panel ya pueden entrar.** Se les envía correo de verificación al crearlos, y `AuthContext` reenvía el enlace automáticamente con un mensaje que explica qué hacer. El texto de la pantalla de alta se corrigió: prometía lo contrario de lo que hacía el sistema.
- **Archivos demasiado grandes dejan constancia visible.** Antes se descartaban con un `logger.warn` invisible para quien los subía: toast verde y el expediente nunca aparecía. Ahora quedan en `manual_review` con el motivo escrito.
- **Detección de expedientes legacy corregida.** `where("invoiceStatuses", "==", null)` no encuentra campos ausentes en Firestore, sólo nulls explícitos: el contador daba siempre cero. Se sustituyó por comparación de totales.
- **Los filtros de Órdenes ya no mienten.** El filtro leía `creditCycle.status` de la raíz mientras el contador y la columna Estado usaban el estatus derivado: el chip podía decir «Vencidas (5)» y la tabla salir vacía. Se unificó también en Dashboard, Layout y Configuración.
- El pie de la tabla de Órdenes ahora suma exactamente la columna «Deuda» (se medía contra el subtotal en vez del total con IVA).

### Rendimiento
- **Órdenes: una sola pasada.** `getOrderSummary` se ejecutaba ~10 veces por renglón en cada tecla escrita (una en el contador, ocho en los totales, una en el render). Ahora se calcula una vez por expediente y se reutiliza.
- **Respaldos en la nube: metadatos separados del contenido.** Listar o podar respaldos descargaba los cinco payloads completos (~1.5 MB por operación). El contenido se movió a `snapshots/{id}/blob/data` y se lee sólo al restaurar. Se agregó un aviso claro al acercarse al límite de 1 MiB por documento de Firestore.
- **`sanitizePurchaseOrder` sale temprano** si el arreglo `invoices` no cambió, y cachea `config/financials` 60 s. Antes el lote nocturno podía encadenar hasta 400 invocaciones.
- Corregido un `useMemo` con dependencias incompletas en `OrderModal`: al cambiar el costo variable, los importes en pantalla no se refrescaban hasta tocar otro campo.

### Interfaz
- Se agregaron `.btn-small`, `.btn-warn` y `.input-field`, invocadas por Cobranza y Usuarios pero inexistentes en la hoja de estilo: esos controles se dibujaban con el estilo crudo del navegador.
- Encabezados de tabla pegajosos, cifras con `tabular-nums` (los dígitos ya no bailan al actualizarse), estado `:active` en botones, barras de scroll finas y color de selección de la paleta.
- El modal atrapa el foco, cierra con `Escape`, bloquea el scroll de fondo y devuelve el foco al cerrarse.

### Documentación
- `SECURITY.md` sincronizado con el código: documentaba límites de 25 MB y 10 MB inexistentes, describía una validación de bitácora que no validaba nada y presentaba el sanitizador como garantía cuando era la causa de una pérdida de datos.
- Versión unificada en `package.json`, `package-lock.json` y `functions/package.json`.
- Se crearon los scripts referenciados que no existían en el repositorio: `DIAGNOSTICO.bat`, `CONECTAR_FIREBASE.bat`, `CONFIGURAR_CLAVE_GEMINI.bat`, `INSTALL_AND_DEPLOY.bat` y `PUSH_TO_GIT.bat`.
- `AUDIT_NOTEBOOK.md` con el ciclo 2 completo.

## [v5.6.0] - 29 Julio 2026 (Auditoría de Automejora Continua & Perfeccionamiento de Cobranza)
* **Cobranza sin Falsos Atrasos:** Las facturas con contrarecibo ya no muestran "días de atraso". Muestra cuenta regresiva visual `Faltan Xd`, `Hoy` o `Cobrar ✓` para contrarecibos vencidos.
* **Alertas y Priorización en Cobranza:** Facturas sin contrarecibo se priorizan en rojo (`⚠ Xd sin CR`) arriba en la lista "Qué cobrar primero".
* **Seguridad Firestore:** Corregida regla de `system_logs` para permitir la escritura de logs con `serverTimestamp()` desde el SDK del cliente.
* **Defensa Multi-Rol:** Ruta `/seed` restringida exclusivamente al rol `admin` con redirección automática y deshabilitación durante carga de configuración.
* **Prevención de Bucles en Cloud Functions:** Sanidad estricta en trigger `sanitizePurchaseOrder` omitiendo escrituras redundantes sin cambios en importes.
* **Rendimiento Dashboard:** Consolidación de iteraciones `orders.forEach` a una sola pasada O(N), eliminando el segundo loop masivo.
* **Transacciones Atómicas:** Cobro en lote de contrarecibos migrado a `writeBatch` para garantizar consistencia atómica.
* **Título Dinámico Navegador:** Implementado título de pestaña adaptable automáticamente según el módulo activo.

## [v5.5.0] - 28 Julio 2026 (Arquitectura Financiera y Automatización)
* **Regla de Oro del IVA:** La utilidad líquida ahora asume el IVA cobrado como parte íntegra de la ganancia `Utilidad = (Total Facturado con IVA) - Costo de Compra - Comisión`.
* **Inmutabilidad Financiera Avanzada:** Costos de compra y porcentajes de comisión ahora se guardan de forma nativa e inmutable ("Snapshots") dentro del expediente de cada factura. Los cambios globales futuros ya no destruyen el historial contable de meses pasados.
* **Automatización Ventas -> Deuda Andrés:** Al guardar un expediente, el sistema calcula y genera/actualiza automáticamente en la pestaña de Compras la deuda a Andrés `(Kilos Totales Facturados * Costo de Compra)`.
* **Automatización Compras -> Caja Chica:** Al registrar un pago o compra, el sistema inyecta automáticamente el movimiento de egreso en el módulo de Caja Chica.
* **Catálogo Predictivo (Semáforo Inteligente):** Nuevo indicador visual 🟢🟡🔴 en el catálogo que alerta automáticamente si un producto se está vendiendo a un precio inferior, igual o superior al de ventas pasadas.
* **Respaldo HTML Offline Parcheado:** Matemáticas internas del archivo offline sincronizadas para respetar la nueva Regla de Oro del IVA y absorber automáticamente la comisión histórica exacta dictada por Firebase.
* **Monitoreo Live de Bitácora (Logs):** Refactorizado `Logs.tsx` a un socket bidireccional (`onSnapshot`) que despliega la actividad de los usuarios como un monitor estilo *Matrix* en tiempo real, sin requerir refrescar la página.


## [v5.4.0] - 28 Julio 2026 (Paquete Consolidado PDF, Rentabilidad Líquida y Optimización Staff Architecture)
* **Paquete de Impresión Consolidado (PDF):** Botón `🖨️ Paquete Consolidado (PDF)` que genera en un único documento de impresión: Remisiones + Datos de Contrarecibo (GT/TH) + Factura + Utilidad Líquida + Firmas de Recepción.
* **Rentabilidad Líquida Real por Contrarecibo:** Nueva tarjeta interactiva en Cobranza que desglosa la utilidad limpia en $ y % por lote (`Venta - Costo Andrés - Comisión Contador`) sin mermas con el fabricante.
* **Optimización Backend O(1):** Indexación de `invoiceFolios` en Cloud Functions eliminando Full Table Scans en la vinculación de Contrarecibos.
* **Seguimiento OC Interactivo:** Edición en 1-clic de expedientes directamente desde la vista `/oc`.
* **Seguridad Reforzada (Zero Trust):** Homologación estricta de `email_verified == true` en Security Rules de Storage y Firestore.

## [v5.3.0] - 28 Julio 2026 (Seguimiento OC, Flujo 3 Estados y Respaldo Offline Sync)
* **Diferenciación Estricta Contrarecibo vs Folio:** Clarificación total en toda la UI y base de datos: GT-xxx y TH-xxx son números de Contrarecibo (CR), mientras que cada factura posee su Folio numérico individual.
* **Seguimiento OC (`/oc`):** Nueva vista dedicada para rastrear kilos contratados en Órdenes de Compra vs kilos surtidos y remanentes.
* **Flujo de Cobro de 3 Estados:**
  - `pending`: Por cobrar al cliente.
  - `paid`: 🟡 Con el Contador (cliente transfirió al contador).
  - `collected`: 💵 Recibida del Contador (efectivo recibido en Caja Chica neto de comisión).
* **Widget Dashboard "Por Recibir del Contador":** Monitoreo en vivo de facturas cobradas por el cliente pero pendientes de recibir del contador.
* **Comisión Editable en Porcentaje (%):** Edición directa en porcentaje (ej: 6.9%) en la pantalla de Configuración.
* **Complemento de Pago SAT (REP):** Control de estado de emisión (`pending`, `issued`, `na`).
* **Respaldo HTML Offline Mapeado (`bridge.ts`):** Exportación HTML offline sincronizada con campos de OC y estados de cobro.

## [v6.4] - 28 Julio 2026 (Auditoría de Automejora Continua)
* **Performance Extremo (O(1)):** Se refactorizaron los bucles matemáticos de React (`finance.ts` y `OrderModal.tsx`) para eliminar el sobre-cálculo masivo por cada pulsación de tecla.
* **Backend Optimizado:** Búsqueda O(1) para Complementos de Pago XML mediante indexación inversa (`invoiceUuids`), previniendo caídas por escaneos totales de la base de datos.
* **Seguridad (Zero-Trust):** Corrección en `storage.rules` para desbloquear la lectura de XML en la nube, y blindaje de Firebase Auth exigiendo `email_verified == true`.

## [v6.3] - 28 Julio 2026 (PWA y Automatización Local)
* **App PWA Instalable:** El sistema es ahora una Progressive Web App completa con íconos dinámicos en alta resolución autogenerados.
* **Control Maestro:** Reemplazo de más de 12 scripts de lote obsoletos por un único y elegante `CONTROL_MAESTRO.bat` interactivo.
* **Protector de Código:** Inclusión de `PROTEGER_CODIGO.bat` para automatizar la privacidad del repositorio en GitHub mediante API y un Personal Access Token.
* **Derechos de Autor:** Agregados metadatos y créditos explícitos (Paco Iglesias © 2026).

## [v6.2] - 28 Julio 2026 (Fase 7: Enterprise)
* **Procesamiento de XML (CFDI 4.0 y Pagos 2.0):** Soporte nativo para lectura cruda de XML con `fast-xml-parser`. Extrae los UUIDs de los Complementos de Pago (REP) e impacta la base de datos marcando automáticamente la factura como 'Emitido'.
* **Inmutabilidad Financiera (Snapshots):** `computeFinancials` ahora guarda una fotografía de los parámetros globales en el instante en que se crea la factura. Modificar los precios o comisiones globales hoy ya no altera el historial contable de meses pasados.
* **Pagos en Lote (Contrarecibos):** Nuevo botón visual en Cobranza para liquidar de golpe todas las facturas que compartan el mismo número de contrarecibo.
* **Integración Continua (CI/CD):** Implementación de GitHub Actions (`deploy.yml`) para compilar y desplegar automáticamente la nube en cada *git push*.

## [v6.1] - 28 Julio 2026 (Lectura de Facturas)
* **IA Bi-funcional:** La Inteligencia Artificial ahora es capaz de procesar **Facturas de Venta** además de Órdenes de Compra.
* **Conciliación Automática:** Si subes una Factura en PDF, la IA extrae la referencia de la OC (ej. OC 120267), busca el expediente original y anexa la factura automáticamente.
* Valida el Folio Fiscal (UUID) para asegurar que nunca se dupliquen las facturas.
* **Agrupación de Contrarecibos:** En la pantalla de Cobranza, las facturas que compartan el mismo número de contrarecibo mostrarán la etiqueta visual `Compartido` para facilitar el cobro en bloque.

## [v6.0] - 28 Julio 2026
* **Inteligencia Artificial Avanzada:** Gemini ahora extrae el detalle completo de los artículos (Cantidad, Unidad, Descripción, P.U., e Importe) desde la tabla de las Órdenes de Compra en PDF.
* **Rediseño de Expedientes (OrderModal):** 
  * Se añadió una tabla de "Detalle de Artículos" en la pestaña de Resumen.
  * Los precios unitarios ahora son individuales por partida, eliminando la dependencia del precio global de la configuración para las operaciones detalladas.
* **Mejoras UX Proactivas:**
  * **Modo Oscuro (Dark Mode):** Toggle global para cambiar la interfaz.
  * **Búsqueda Global (Ctrl+K):** Atajo de teclado en toda la app para buscar expedientes, clientes o folios rápidamente.
  * **Status en vivo:** Indicador de "Sistema OK" en línea/offline en la barra superior.
* **Documentación:** Creación de `INSTRUCCIONES_USO.md`, limpieza de scripts de migración antiguos y estandarización del `SISTEMA_ACTUAL.md`.

## [v5.2] - Julio 2026
* **Caja Chica Dinámica:** Integración del KPI de gastos en el Dashboard principal para conocer la liquidez real.
* **Cobranza Ágil:** Nuevo botón "💰 Marcar Cobrada" que auto-llena fecha y monto total de la factura con 1 clic.
* Modificación de la pestaña por defecto en expedientes desde Cobranza (abre directo en Facturas).

## [v5.0] - Julio 2026
* **Soporte Multi-Factura:** Migración de la estructura de base de datos. Las OCs pasaron de tener 1 ciclo de crédito a tener un arreglo de `invoices[]` y `deliveries[]` independientes.
* Actualización de la Cloud Function `checkOverdueInvoices` para recorrer los arreglos de facturas.
* Nuevas métricas en Dashboard (Kilos Entregados vs Pedidos).

## [v4.0]
* Parche de seguridad para proteger los datos financieros públicos en Hosting.
* Implementación de reglas restrictivas en Firestore (`firestore.rules`).

## [v1.0 - v3.0]
* Creación del ERP base en React/Vite.
* Conexión básica con Firebase (Auth, Firestore, Storage).
* Implementación original de la IA (GenAI) para extraer únicamente Total de Kilos y Folio.
