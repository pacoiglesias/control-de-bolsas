# Historial de Versiones (Changelog) - Control Bolsas

## [v6.62.0] - 5 Agosto 2026 (Restauracion automatica -- sin abrir nada manualmente)

### Agregado
- **El expediente de tus 10 contrarecibos se restaura solo, automaticamente, en cuanto inicias sesion** -- sin abrir el expediente, sin usar la Papelera. Migracion temporal de un solo uso, se puede quitar despues de confirmar.


## [v6.61.0] - 4 Agosto 2026 (URGENTE: pestana Papelera -- el boton Restaurar era inalcanzable)

### Agregado — critico
- **Nueva pestana "Papelera" en Centro de Control.** El boton "Restaurar Expediente" (v6.59.0) vive dentro del modal de edicion, pero ningun expediente eliminado aparecia en ninguna lista ni busqueda del sistema -- no habia forma de ABRIR el expediente para llegar al boton. La Papelera hace su propia consulta, sin ese filtro, y permite restaurar directamente desde ahi.


## [v6.60.0] - 4 Agosto 2026 (Causa raiz real del scroll + flechas de navegacion + auditoria numerica)

### Corregido — critico
- **Causa raiz real del problema de scroll en modales**: `.modal-root`, `.modal-box` y `.modal-scrim` no tenian NINGUN estilo CSS en todo el sistema. El modal se dibujaba como un bloque normal sin limite de altura -- por eso el scroll interno nunca se activaba y la pagina completa tenia que estirarse. Ahora el modal es un overlay fijo y centrado de verdad, con su propio scroll interno funcional (encabezado fijo arriba, cuerpo con scroll abajo). Afecta a todos los modales del sistema.
- **"Ganancia Comercial" con margen por kilo inflado** ($8.08/kg en vez de los ~$5/kg esperados) -- el KPI de kilos totales leia un campo de expediente que se quedo en 0 para un caso real, aunque sus facturas si tenian kilos correctos. Ahora usa la suma real de facturas como respaldo.

### Agregado
- **Flechas de navegacion (◀ ▶)** en los tres tableros Kanban (Cobranza, Compras, Entregas) -- un clic los desplaza, sin depender de gestos de mouse/trackpad poco descubribles.
- Auditoria completa de las formulas financieras centrales (comision, deuda con Andres, proyeccion de flujo, antiguedad de vencimiento) -- verificadas correctas contra numeros reales.

### Detectado (no corregido, requiere decision del usuario)
- Duplicado real de datos confirmado: dos expedientes distintos contienen las mismas facturas 5927/5928 (folios `QMjuMVzzM3rPPchXlgZC` y `cTpSirJD5iv2lx56X4BB`). No se elimino nada -- requiere confirmar cual es el correcto antes de limpiar el sobrante.


## [v6.59.0] - 4 Agosto 2026 (URGENTE: boton para restaurar expediente eliminado)

### Agregado — critico
- **No existia forma de deshacer "Eliminar Expediente" desde la interfaz.** Se agrego un boton "Restaurar Expediente" que aparece automaticamente cuando abres un expediente ya eliminado -- revierte el borrado exacto, sin tocar Firebase Console a mano.


## [v6.58.0] - 4 Agosto 2026 (Proveedor real de Andres, avisos de duplicados, 2 tableros Kanban nuevos)

### Corregido — crítico
- **El registro de compra tomaba el proveedor del texto de la OC pegada** (a veces el propio negocio del usuario, ej. "Elemental Denim") **en vez del proveedor real que entrega el material** (Andrés). Ahora siempre usa el proveedor configurado globalmente en Centro de Control, sin importar qué diga el expediente individual. Corregir un expediente ya existente basta con volver a guardarlo — se autocorrige.
- **Deuda Histórica con Andrés** ajustada de -$123,175.56 a **+$21,824.44**, verificada con el propio cálculo del usuario contra su saldo real ($102,670.28).
- **Expedientes completamente cobrados desaparecían del tablero Kanban** de Expedientes & Ventas — faltaba una columna para el estado final ("collected"), de 7 estados posibles solo había 6 columnas.

### Agregado
- **Sin ninguna protección contra duplicar números de Contrarecibo, Factura, u OC entre expedientes** — corregido: ahora avisa (con confirmación, no bloqueo) si el número ya existe en otro expediente del sistema.
- **Tablero Kanban para Logística de Entregas** — completa la trilogía visual (Compras → Entregas → Cobranza), columnas: Pedido → En Camino → Entregado sin facturar → Facturado por cobrar → Cobrado.
- Columna "✅ Cobrado y Recolectado" agregada al tablero de Expedientes; columna `paid` renombrada de "Cobradas" a "Con el Contador" (más preciso).


## [v6.57.0] - 4 Agosto 2026 (Auditoria completa: numeros cuadrados contra Excel, 0 errores)

Verificacion final antes de esta entrega: `tsc` limpio (frontend y funciones),
`eslint` 0 errores / 0 avisos, **42/42 pruebas**, build completo en ambos
proyectos. Todo lo de aqui abajo ya esta en el codigo, verificado.

### 🔴 Critico
- **"Pendiente por Facturar" y "Deuda Total Providencia" ya cuadran exacto
  contra el Excel** ($161,606.00 y $1,319,423.80). Causa: el guardado de un
  expediente migrado se bloqueaba por campos de resumen sin llenar (kilos,
  proveedor) ajenos al cambio que se intentaba hacer.
- **"Material Flotante" volvia a quedar negativo despues de CUALQUIER
  guardado** en el expediente migrado — `upsertAndresPurchase()` recalculaba
  el registro de compra ligado desde "entregas", y para expedientes que solo
  tienen kilos a nivel factura (sin arreglo de entregas), lo dejaba en 0
  cada vez, borrando correcciones anteriores sin avisar.
- **"Ganancia Comercial" con margen por kilo inflado** ($8.08/kg calculado
  vs ~$5/kg real del negocio) — el conteo de "kilos totales" del servidor
  leia un campo de resumen vacio en vez de sumar las facturas reales.
- **"Por Recibir del Contador" mostraba $440,559.13 en vez de $427,997.50**
  — dos facturas importadas por XML nunca capturaron el campo de comision,
  mostrando -$0.00 en vez del ~6.9% real. Corregido en cliente y servidor.
- **Corregir un numero de Contrarecibo (CR) se revertia solo** al perder el
  foco del campo — el prefijo (TH-/GT-) se reescribia siempre con el
  departamento del expediente, descartando lo que el usuario acababa de
  escribir.

### Corregido
- Al abrir un expediente, la pagina "saltaba" por no compensar el ancho de
  la barra de scroll que se ocultaba de fondo.
- Mover una tarjeta en Cobranza de "Por Cobrar" a "Revision" borraba el CR
  sin ninguna confirmacion.

### Mejorado / Nuevo
- **Tarjeta "Por Recibir del Contador" rediseñada**: flujo claro en 3 pasos
  (Cobrado por el cliente − Comision del contador = Lo que entra a Caja),
  en vez de una sola cifra sin contexto.
- **Tablero Kanban para Compras (Andres)**: nueva vista alternable en
  "Ordenes de Compra", mismo lenguaje visual que ya funciona en Cobranza
  (Pedido → En Transito → Recibido, Falta Pagar → Pagado).
- Barra de scroll de la pantalla principal reforzada de forma explicita.


## [v6.56.0] - 4 Agosto 2026 (Paquete grande: 4 correcciones críticas + 6 mejoras)

### 🔴 Crítico
- **"Deuda con Andrés" mostraba -$1,248,344.64 en vez de -$102,670.27.** Dos bugs reales: (1) el cálculo del Dashboard sumaba TODAS las compras del sistema sin filtrar por proveedor; (2) donde sí filtraba (Compras), comparaba "andres" sin acento contra datos guardados como "Andrés" con acento, y nunca coincidían. Ambos corregidos con una función compartida que ignora acentos y mayúsculas en cualquier comparación de proveedor.
- **Corregir un número de Contrarecibo (CR) se revertía siempre, sin aviso.** El campo reconstruía el valor usando el departamento del expediente como prefijo fijo, descartando lo que el usuario acababa de escribir — cualquier corrección con un prefijo distinto (TH-/GT-) se revertía sola al salir del campo.
- **23 variables de color/estilo (CSS) usadas en más de 20 archivos, nunca definidas en ningún lado.** Auditoría completa del código encontró que tarjetas, fondos y bordes en varias pantallas (incluido el tablero de Cobranza) quedaban visualmente transparentes o de bajo contraste por esta causa — no una pantalla aislada, un patrón repetido por todo el sistema.
- **Sábana Maestra (/mining) se caía por completo** con "Cannot read properties of undefined" al ordenar u buscar expedientes migrados sin fecha o sin folio.

### Corregido
- Guardar cualquier edición en un expediente migrado (como corregir un CR) quedaba bloqueado por validaciones de campos totalmente ajenos al cambio ("Kilos totales" y "Proveedor" del resumen, nunca llenados en la migración original).
- Expediente nuevo con entregas capturadas aparecía como "FACTURADO" sin ninguna factura real.
- Mover una tarjeta en el tablero de Cobranza de vuelta a "Revisión" borraba el número de Contrarecibo sin ninguna confirmación.
- Barra de scroll vertical del tablero Kanban prácticamente invisible (recortada contra apenas 4px de espacio reservado).
- Barra de scroll global (vertical y horizontal, toda la aplicación) con bajo contraste en modo claro.

### Mejorado
- Identificadores de OC, Folio y Contrarecibo ahora llevan insignias de color fijas y distintas — ya no se confunden entre sí.
- Caja Chica usa el mismo tipo de pantalla de carga (skeleton) que el resto del sistema, en vez de un ícono genérico.
- Columna fija en tablas anchas (Expedientes, Contrarecibos, Seguimiento de Pedidos) al hacer scroll lateral.
- Tarjeta "Flujo de Efectivo Providencia" con barra de composición visual y colores por categoría.


## [v6.47.0] - 3 Agosto 2026 (CRÍTICO: documentos invisibles por orderBy)

### Corregido — crítico, máxima prioridad
- **Expedientes, compras, gastos de caja y productos podían desaparecer por completo del sistema, sin ningún error, si les faltaba el campo exacto usado para ordenar la lista.** Confirmado: el expediente con los 10 contrarecibos originales (de la migración inicial) era invisible en Dashboard, Cobranza, Compras y Expedientes por esta causa — solo la Auditoría Maestra lo veía, porque usa una consulta distinta.
- Las cuatro fuentes de datos principales (`Orders`, `Purchases`, `Expenses`, `Products`) ya no dependen de `orderBy` de Firestore — se ordenan del lado del cliente, sin posibilidad de excluir un documento por un campo faltante.

Este es probablemente el hallazgo más importante de toda la sesión de auditoría: explica por qué cifras que ya se habían corregido en la base de datos seguían sin aparecer correctamente en el sistema.


## [v6.46.0] - 3 Agosto 2026 (Seguimiento de Pedidos reemplaza gráfica de ganancias)

### Cambiado
- **"Ganancias Estimadas por Fecha de Factura" eliminada** (a petición explícita del usuario) y reemplazada por **"Seguimiento de Pedidos"**: una tabla con cada OC, sus kilos pedidos/entregados/facturados con porcentaje de avance, total, cobrado, y estatus.
- Bundle del Dashboard más liviano al quitar esa dependencia de gráficas.


## [v6.45.0] - 3 Agosto 2026 (Flujo Providencia con líneas claras)

### Mejorado
- El panel "Flujo de Efectivo Providencia" ahora muestra "Facturas en Revisión (sin CR)" y "Contrarecibos (con CR)" como líneas separadas y claramente etiquetadas, en vez de una sola cifra combinada con el desglose en texto pequeño sin etiqueta.

### Aclarado, no era un error
- "Total Vendido" depende del selector "Mes P&L" — selecciona "Histórico Global" para ver el acumulado completo.
- El botón "Subir OC (PDF)" ya está corregido desde v6.42.0; si sigue fallando, falta desplegar esa versión.


## [v6.44.0] - 3 Agosto 2026 (Sábana visual reparada + tabla de contrarecibos)

### Corregido — crítico
- **12 facturas reales con `Estatus: "issued"`** (valor inválido, residuo de la migración original) y **10 con monto en $0** — corregidas con datos reales, entregado archivo listo para subir.
- **Botón "Subir Sábana Modificada" invisible**: usaba una variable CSS (`var(--brand)`) que no existe en el proyecto. Reconstruida toda la pantalla con los estilos reales del sistema.
- **Sin forma de cancelar** una carga en la Auditoría Maestra — agregado en dos lugares.
- **3 botones duplicados** que descargaban el mismo archivo en el Dashboard, consolidados en 1.

### Agregado
- **Tabla de contrarecibos por vencer** en Visión Global: folio, cliente, vencimiento, monto y estado (vigente / próximo a vencer / vencido con días de atraso), con totales.

### Corregido con documento real
- "Pendiente por Facturar" bajó de $161,606.00 a **$81,780.00**, confirmado contra la Factura 6159 real (factura la mitad exacta de la OC-71-14014).


## [v6.43.0] - 3 Agosto 2026 (isClosedShort corregido, Compras a tarjetas, Reprogramar)

### Corregido — crítico
- **`isClosedShort` no cumplía su promesa** cuando se cerraba una OC antes de facturarla: el estatus se quedaba pegado en "pedido" para siempre. Corregido en `getOrderSummary()`.
- **Buscador y filtro de Compras no hacían nada** — controles visuales sin conectar a la lista. Ya funcionan de verdad.

### Agregado
- **Compras rediseñado a tarjetas** (folio, cliente, barra de progreso, monto, recepción rápida) en vez de tabla.
- **"📅 Reprogramar"** en Cobranza — cambia la fecha de vencimiento de una factura en un clic.

### Verificado, sin cambios necesarios
- `html2pdf.js` (982 KB): confirmado que ya carga de forma perezosa, solo al generar un PDF real.


## [v6.42.0] - 3 Agosto 2026 (Auditoría completa de menús y rutas)

### Corregido
- **Dos rutas muertas más**, encontradas en un barrido completo de todo el proyecto (no solo la pantalla donde se reportó el problema original): un botón duplicado en el Dashboard apuntando a `/subir`, y un mensaje de "sistema sin órdenes" apuntando a `/seed` — ambas rutas ya no existen.

### Verificado, sin cambios necesarios
- Los 10 enlaces del menú principal contra las rutas reales: coinciden todos.
- Todo `overflow: hidden` del proyecto: ninguno bloquea el scroll de página, solo usos locales legítimos.
- Los dos tableros Kanban: scroll horizontal/vertical bien implementado.
- Cobertura de tablas anchas con desplazamiento en móvil: completa.


## [v6.41.0] - 3 Agosto 2026 (La sábana por fin coincide; botón de OC reparado)

### Corregido — crítico
- **Descarga y subida de la sábana nunca coincidían.** Confirmado: el código de este repo ya genera el formato correcto (`Auditoria_Cobranza`/`Auditoria_CajaChica` con `ID_SISTEMA`); producción corre una versión anterior. Desplegar esta versión resuelve el desajuste de raíz.
- **"Subir OC (PDF)" navegaba a una ruta eliminada** (`/subir`), regresando al inicio sin aviso. Ahora abre un expediente nuevo directo en la pestaña donde se pega y extrae el texto de la OC.
- **Botón de sábana estática eliminado.** Descargaba un archivo congelado (`plantilla_llena.xlsx`) sin relación con los datos reales — riesgo de subir información vieja pensando que era actual.
- **Data Mining exportaba los datos equivocados**: llamaba a una función con parámetros que no acepta (silenciados con `as any`), descargando el volcado genérico en vez de su propio análisis.
- Corregido el nombre de autoría en el pie de página.

### ⚠️ Acción requerida
Después de desplegar, revisar `/caja-chica`: hay un movimiento de prueba de $8 que dejó el saldo mostrado en $9 — hay que borrarlo manualmente.


## [v6.40.0] - 3 Agosto 2026 (Seguridad del Portal Maquilador + limpieza total de tipos + WhatsApp)

### Corregido — crítico (seguridad)
- **El PIN del Portal Maquilador era públicamente legible** por cualquiera, sin sesión — vivía en un documento con `allow read: if true`. Movido a un documento admin-only; el cliente ya nunca ve el valor real.
- **La función en la nube no exigía PIN para la acción principal** (listar/registrar entregas), solo para el estado de cuenta. Ahora lo exige para cualquier acción.
- **`FastEntry.tsx` no sincronizaba `invoiceStatuses`** — mismo bug ya corregido en otras pantallas.

### Corregido — calidad de código
- **Eliminado `@ts-nocheck` de los 8 archivos que lo tenían.** Cada uno reveló bugs reales: un destructuring de 40 valores usando solo 10-13, una API de `toast` inexistente que habría tronado en producción, y 5 funciones usadas sin importar (`sound`, `addDoc`, `addDays`, entre otras).
- **`eslint`: de 15 errores y 192 avisos a 0 y 0** en todo el proyecto.

### Agregado
- Botón "💬 WhatsApp" en Cobranza — enlace real con el mensaje precargado, no solo copiar al portapapeles.
- Botón de recepción rápida en Compras renombrado a "📦 Recibir Kilos Rápidos".

### Pendiente, con razón explícita
- División de `Dashboard.tsx` en componentes más chicos.
- Rediseño visual de Compras a tarjetas (la función ya existe, falta el layout).
- Lectura automática de PDF con IA — no se reintroduce sin confirmar que sigue siendo lo que se quiere, dado que se retiró antes por decisión explícita.


## [v6.39.0] - 3 Agosto 2026 (Scroll bloqueado — reparado)

### Corregido — crítico
- **El scroll dejaba de funcionar en toda la aplicación** después de un fallo dentro de un modal (reportado en `/caja-chica`, pero afecta cualquier pantalla). El bloqueo de scroll de fondo del componente `Modal` se reiniciaba en cada render mientras estaba abierto; si algo tronaba a mitad de una interacción, la limpieza podía no completarse y el `body` quedaba con scroll bloqueado para siempre.
- Corregido de raíz (el efecto ya no se reinicia en cada render) y con una red de seguridad adicional: el bloqueo se libera solo al cambiar de página, sin depender de que la limpieza anterior se haya ejecutado bien.

### Continuación en curso
- Limpieza de `@ts-nocheck`: 6 de 8 archivos completamente resueltos. `TabFacturas.tsx` tiene ya los imports reales corregidos (la causa más probable de fallos dentro de modales) pero el candado temporal sigue puesto para no bloquear esta entrega urgente.


## [v6.38.0] - 3 Agosto 2026 (Saldo histórico corregido en Compras + revisión responsive)

### Corregido — crítico
- **La tabla de movimientos con Andrés en `/compras` ignoraba el ajuste histórico real** (-$123,175.56 configurado). El saldo principal de la pantalla sí lo usaba correctamente; la tabla de detalle y su reporte impreso arrancaban en $0, desfasados del número principal.

### Mejorado
- Revisión de diseño responsive: confirmado que el sistema sí adapta bien a móvil (menú colapsable, botones táctiles, sin zoom automático en inputs). Agregado el desplazamiento horizontal faltante en 2 tablas.


## [v6.37.0] - 3 Agosto 2026 (Auditoría Maestra reparada)

### Corregido — crítico
- **Signo invertido en movimientos nuevos de Caja Chica** al crearlos desde la Auditoría Maestra: un anticipo se guardaba como "ingreso" y un cobro como "egreso" — exactamente al revés.
- **`invoiceStatuses` no se sincronizaba** al cambiar el estatus de una factura desde el Excel — el resto del sistema seguía viendo el estatus viejo.
- **Los renglones nuevos ahora sí detectan el proveedor** por el texto del concepto, y se **valida el estatus** contra los valores reales del sistema antes de aplicarlo.
- Corregida la hoja "Auditoria_Compras" del Excel descargable: exportaba campos que no existen en el modelo (`subtotal`, `iva`, `total`) y siempre salía en blanco.

### Verificado
- Probado de extremo a extremo con una sábana sintética idéntica a los datos reales del negocio, incluyendo un caso de estatus inválido a propósito.

## [v6.36.0] - 2 Agosto 2026 (UI Glassmorphism, Kanban Drag & Drop y Refactorización Compras)

### Añadido — Proactividad y Estética Premium
- **Kanban Drag & Drop (Fase 6):** Arrastrar y soltar facturas libremente en el tablero de cobranza. Transiciones inteligentes con validación de negocio (ej. preguntar por Contrarecibo al mover a "Por Cobrar").
- **Sincronización Mágica de Caja Chica:** Al mover una factura a "En Caja Chica" desde el Kanban, el sistema inyecta automáticamente el movimiento de ingreso de efectivo correspondiente usando una transacción atómica. Si se deshace el movimiento, se inyecta un egreso de reversión. Las métricas financieras "Cobrado" y "Caja" ahora cuadran perfectamente sin depender de captura manual.
- **Glassmorphism Global:** Implementación de tarjetas y modales esmerilados mediante variables CSS `--glass-*` y la clase `.glass-modal`, dotando al sistema de una estética moderna y premium.
- **Atajos Contextuales (Quick Actions):** Integración de botones proactivos directamente en los indicadores principales. (ej. "Recolectar a Caja Chica" desde el Dashboard, o "Liquidar Deuda" desde Compras).

### Mejorado — Deuda Técnica
- **Desacoplamiento de `Compras.tsx`:** Reducción monumental de ~880 líneas a ~160 líneas. La lógica de estado se extrajo a `useAndresStats.ts`, y la UI de tablas y modales se dividió en microcomponentes dedicados (`OrderModals.tsx`, `AndresLedgerTable.tsx`), mejorando drásticamente su mantenibilidad a largo plazo.
- **Performance de Renderizado:** Reducción de sobrecarga en el render inicial al separar el estado de los componentes visuales. Resolvimos falsos positivos y errores de tipado de TypeScript.

## [v6.35.0] - 2 Agosto 2026 (Reconciliación de ramas + facturas sin CR vencidas)

### Corregido — crítico
- **`checkOverdueInvoices` marcaba como vencidas facturas sin contrarecibo.** El plazo de crédito arranca cuando Providencia emite el CR, no al enviar la factura a revisión. Verificado contra datos reales: la diferencia en "Vencido" era exactamente el monto de las facturas sin CR. Se agregó además una reparación automática para las facturas ya mal marcadas.

### Reconciliado
- Unificadas las tres ramas de trabajo que habían divergido (`optimize/workspace-2026-07-29-ciclo2`, `main`/`feature/ux-quality-audit`, `audit/workspace-2026-08-01`) más una copia local en v6.34.0 sin subir. Se tomó la copia local como base y se le sumó lo que solo existía en GitHub.
- Sincronizadas las versiones de `package.json` y `functions/package.json`, que estaban desfasadas entre sí.
- Eliminados archivos sueltos sin uso en la raíz del proyecto.

## [v6.30.0] - 1 Agosto 2026 (Enterprise Release)

### Añadido — Mejoras UI/UX y Sistema
- **PWA Offline y Updater:** Instalación nativa con modo Offline para seguir operando sin conexión.
- **Audit Logs:** Auditoría estricta de todos los elementos eliminados (Soft-Delete) respaldada en la base de datos (`system_logs`).
- **Exportación Maestra Mensual:** Dashboard incluye descarga directa consolidada a Excel de todo el negocio.
- **UI UX Premium:** Nuevos toasts proactivos con react-hot-toast, micro-animaciones en Modales con Framer Motion y rediseño general de badges y esqueletos de carga.

### Corregido
- Se removió cualquier ambigüedad de "Bolsas Sueltas" al confirmar con Negocio que todo proveedor entrega exactamente (o menos) de los pedidos.


## [v6.21.0] - 31 Julio 2026 (Ciclo 33 — Vencido corregido)

### Corregido — crítico
- **"Vencido" incluía las facturas en revisión.** Mostraba $834,434.46 cuando la suma real de contrarecibos vencidos es $698,134.46 — la diferencia era exactamente el monto de las facturas aún sin contrarecibo. Ahora una factura sin CR no cuenta como vencida: el plazo de crédito arranca al emitirse el contrarecibo, no al enviar la factura.
- La migración ya no asigna una fecha de vencimiento ficticia a las facturas en revisión.


## [v6.20.0] - 31 Julio 2026 (Ciclo 32 — Saldo con Andrés corregido: dos bugs reales)

### Corregido — crítico
- **"Registrar Entrega" en Compras nunca actualizaba la deuda con Andrés.** Solo escribía las entregas del expediente; el registro de compra vinculado se quedaba sin tocar. Unificado con `OrderModal.save()` en una sola función compartida (`upsertAndresPurchase`).
- **Regresión revertida:** el cálculo de la deuda había vuelto a usar kilos pedidos en vez de kilos entregados durante el refactor de entregas del Ciclo 26, revirtiendo silenciosamente lo confirmado en el Ciclo 14.

### ⚠️ Requiere acción
Después de instalar y desplegar, presiona **"Recalcular Indicadores"** en el panel. Los contadores nuevos de ciclos recientes (Pendiente de Facturar, Vencido por fecha) solo se completan retroactivamente con un recálculo completo — el trigger incremental no vuelve a sumar expedientes que ya existían antes de que esos campos se agregaran.


## [v6.19.0] - 31 Julio 2026 (Ciclo 31 — Vencidos por fecha, bitácora al día)

### Corregido — crítico
- **"Vencido" no contaba contrarecibos realmente vencidos.** Dependía únicamente del job diario que corre a medianoche; entre una corrida y la siguiente, facturas vencidas por calendario seguían contando como "pendientes" en el panel, aunque Cobranza ya las mostrara correctamente. Ahora las estadísticas comparan la fecha en vivo, sin esperar al job.
- **"Bitácora de Parches" del sistema desactualizada**: se quedó en v6.8.0 pese a llevar 10 versiones más. Completada hasta v6.18.0.


## [v6.18.0] - 31 Julio 2026 (Ciclo 30 — Adelantos a proveedor visibles otra vez)

### Corregido — crítico
- **El adelanto a Andrés no aparecía en su Estado de Cuenta.** La migración inicial de CAJA nunca guardó el campo `provider` en sus movimientos, así que el filtro por proveedor los ignoraba por completo — el saldo mostraba deuda de más, por el monto exacto del adelanto perdido.
- Nueva herramienta en `/seed`: **"🔧 Reparar movimientos sin proveedor"**, que completa el campo faltante en los movimientos ya existentes sin tocar montos ni fechas.
- La migración ahora detecta el proveedor automáticamente por el concepto, para que esto no se repita en cargas futuras.


## [v6.17.0] - 31 Julio 2026 (Ciclo 29 — Panel reordenado, CAJA, catálogo editable)

### Corregido — crítico
- **"Notificar al cliente" generaba un `mailto:` sin destinatario.** Faltaba el correo antes del `?`. Nuevo campo opcional "Correo del cliente", con autocompletado; el botón avisa claramente si el cliente no tiene correo capturado en vez de fallar en silencio.

### Cambiado
- **Panel principal reordenado en tres secciones** (Ventas y Ganancias / Cobranza / Caja y Operación), en vez de nueve tarjetas sueltas.
- **"Total Vendido" ahora indica que es acumulado de todo el historial**, sin límite de fecha — confirmado en el código, no había ningún filtro temporal.
- **"Caja Chica" renombrado a "CAJA"** en toda la interfaz (26 textos: menú, botones, confirmaciones, reportes). La ruta y el nombre interno del componente no cambiaron.

### Agregado
- **Catálogo editable**: alta de productos nuevos, edición de descripción/unidad/precio, y borrado — antes solo se podía editar el código.


## [v6.16.0] - 31 Julio 2026 (Ciclo 28 — Compras con contexto real y entregas compartidas)

### Agregado
- `lib/deliveries.ts`: lógica de entregas-por-evento extraída a funciones puras, compartida entre `OrderModal.tsx` y `Compras.tsx`.
- **Compras** ahora muestra Folio, Cliente y Fecha de Entrega Estimada por cada compra (cruzado con el expediente real).
- Tarjeta **"⚠️ Entregas Atrasadas de Andrés"**: cuenta OC con fecha de entrega vencida y kilos pendientes.
- Buscador por folio/cliente en el historial de compras.
- Botón **"📦 Registrar Entrega"** por renglón: captura una entrega sin salir de Compras, con la misma protección contra ediciones simultáneas que ya usa el expediente.


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
