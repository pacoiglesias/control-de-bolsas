
### Iteración 9: Auditoría Maestra reparada — renglones nuevos, sincronización y signo correcto (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/pages/AuditSync.tsx`, `src/lib/export.ts`
**Problema:** La herramienta de "Auditoría Maestra" (única forma de cargar/corregir datos masivamente, tras eliminarse `Seeder.tsx`) tenía tres fallas reales: (1) al cambiar el estatus de una factura, escribía `invoices` pero nunca `invoiceStatuses` — el arreglo desnormalizado del que dependen todas las consultas del sistema (Dashboard, Cobranza, el proceso de vencidos) quedaba desincronizado en silencio; (2) los movimientos de Caja Chica nuevos se creaban con el signo invertido: `Number(diff.newValue) < 0 ? 'ingreso' : 'egreso'`, exactamente al revés de la convención ya establecida en el resto del sistema; (3) no había forma de detectar a qué proveedor correspondía un movimiento nuevo, ni de validar que el texto de la columna "Estatus" fuera uno real; y (4) la hoja "Auditoria_Compras" del Excel descargable exportaba campos que no existen en el modelo de datos (`subtotal`, `iva`, `total`, `invoiceDate`), así que salía siempre en blanco.
**Impacto:** Riesgo real de corromper datos financieros al usar la única herramienta pensada para corregirlos — el signo invertido en particular podía convertir un anticipo en un "ingreso" y viceversa, afectando el saldo de Caja y el Estado de Cuenta del proveedor.
**Solución:** Escritura de facturas ahora pasa siempre por `camposInvoices()`, igual que el resto del sistema. Signo de Caja corregido a la convención establecida (negativo = egreso). Detección automática de proveedor por el texto del concepto, igual que la reparación del Ciclo 30. Validación de estatus contra el enum real del sistema, con los renglones inválidos marcados como error y excluidos de "Aplicar Ajustes" en vez de guardarse tal cual. Hoja "Auditoria_Compras" corregida para exportar los campos reales de `Purchase`. Probado con una sábana sintética que reproduce exactamente los datos reales del usuario (12 contrarecibos, movimientos de Caja, un estatus inválido a propósito) para confirmar el comportamiento antes de entregar.
**Riesgo:** 🟡 Medio — escribe directamente datos financieros; mitigado con la prueba de extremo a extremo antes de la entrega.
**Commit:** `fix(AuditSync): sincronizar invoiceStatuses, corregir signo de Caja, detectar proveedor y validar estatus`
**Estado:** ✅ Verificado — `tsc` limpio en raíz y functions, 39/39 pruebas, build completo, prueba manual de extremo a extremo con datos sintéticos idénticos a los reales.

### 🟡 Pendiente consciente
La hoja "Auditoria_Compras" del Excel descargable ahora exporta datos correctos, pero **subir cambios en esa hoja todavía no hace nada** — `AuditSync.tsx` no la lee. Sirve hoy solo para consulta/respaldo, no para corregir compras desde el Excel. Construir esa mitad es candidato para un ciclo futuro si se necesita.

### Iteración 10: Saldo histórico con Andrés ignorado en la tabla de movimientos de Compras (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/hooks/useAndresStats.ts`, `src/pages/Compras.tsx`
**Problema:** El número principal de "Saldo con Andrés" en `/compras` usa correctamente el hook compartido `useAndresStats()`, que sí incluye el ajuste histórico configurado (`config.historicalDebtAndres`, -$123,175.56 real). Pero la tabla de movimientos (el detalle línea por línea, y el reporte imprimible que se genera desde ahí) tenía su propio cálculo local con `const deudaHistorica = 0` fijo — cada renglón de esa tabla arrancaba su saldo acumulado en cero, desfasado del número principal de la pantalla por el monto completo del ajuste histórico.
**Impacto:** El saldo principal era correcto, pero el detalle de movimientos y su reporte impreso no coincidían con él — confusión real al intentar cuadrar cifras.
**Solución:** `useAndresStats()` ahora expone `deudaHistorica` en su valor de retorno; `Compras.tsx` la usa en vez de su copia local fija en cero.
**Riesgo:** 🟢 Bajo — un solo valor corregido, mismo patrón de "una sola fuente de verdad" ya aplicado varias veces.
**Commit:** `fix(Compras): usar el saldo histórico real en la tabla de movimientos, no un cero fijo`
**Estado:** ✅ Verificado.

### Iteración 11: Revisión de diseño responsive (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/components/Compras/OrderModals.tsx`, `src/components/OrderModal/TabEntregas.tsx`
**Problema:** El sistema sí tiene diseño responsive real (menú lateral colapsable en móvil, tamaño de fuente de 16px en inputs para evitar el zoom automático de iOS, cuadrícula de indicadores que se reacomoda, botones con área táctil mínima de 40px). Se encontraron 2 tablas de datos sin el envoltorio `.table-scroll` que sí usa el resto del sistema para permitir desplazamiento horizontal en pantallas angostas.
**Solución:** Envueltas ambas tablas en `.table-scroll`, mismo patrón ya establecido.
**Riesgo:** 🟢 Bajo — solo estructura visual.
**Commit:** `style: agregar table-scroll faltante en 2 tablas para consistencia móvil`
**Estado:** ✅ Verificado.

### Iteración 12: Scroll bloqueado en toda la aplicación tras un error dentro de un modal (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/components/ui.tsx`, `src/components/Layout.tsx`
**Problema:** 🔴 Reportado por el usuario en `/caja-chica`: el scroll de la página dejó de funcionar. Causa raíz: el componente `Modal` bloquea el scroll del fondo mientras está abierto (`document.body.style.overflow = 'hidden'`) y lo restaura al cerrarse — patrón correcto en sí, pero el `useEffect` que lo hace dependía de `[onClose]`, una función que casi siempre es una referencia nueva en cada render del componente padre. Esto hacía que el efecto se reiniciara en cada render mientras el modal seguía abierto. Si algo tronaba a mitad de una interacción dentro de un modal (como los `ReferenceError` reales encontrados hoy en `TabFacturas.tsx` — `sound`, `addDoc`, `addDays` usados sin importar, ocultos hasta ahora por `@ts-nocheck`), la limpieza final del efecto podía no completarse nunca, dejando el `body` con `overflow:hidden` para siempre. El bloqueo afecta a **toda la aplicación**, no solo a la pantalla donde ocurrió — de ahí que el usuario preguntara si era solo esa pantalla.
**Impacto:** Scroll completamente roto en cualquier página, hasta recargar el navegador.
**Solución:** Dos capas. (1) El efecto del `Modal` ahora se ejecuta una sola vez por apertura/cierre real (dependencias `[]`), usando una ref para la última versión de `onClose` — ya no se reinicia en cada render. (2) Red de seguridad en `Layout.tsx`: el bloqueo de scroll se libera automáticamente cada vez que cambia de ruta, sin depender de que la limpieza del modal se haya ejecutado correctamente — cubre cualquier otro fallo futuro de la misma naturaleza, no solo este caso puntual.
**Riesgo:** 🟢 Bajo — el cambio hace el comportamiento existente más robusto, no cambia la experiencia cuando todo funciona bien.
**Commit:** `fix(ui): reparar bloqueo de scroll permanente cuando un modal falla a medio uso`
**Estado:** ✅ Verificado — `tsc` limpio, 39/39 pruebas, build completo.

### 🟡 Nota de continuidad
`TabFacturas.tsx` quedó con `@ts-nocheck` restaurado temporalmente para no bloquear esta entrega urgente — pero ya con los imports reales corregidos (`sound`, `addDoc`, `collection`, `db`, `PATHS`, `serverTimestamp`, `addDays`), que eran justamente la causa más probable del bug de scroll. Falta terminar de recortar su desestructuración y anotar los tipos implícitos, igual que ya se hizo en los otros 6 archivos. `OrderModal/index.tsx` (547 líneas) tampoco se ha tocado todavía. Ambos quedan como continuación directa de la limpieza de `@ts-nocheck` ya en curso.

### Iteración 13: Seguridad del Portal Maquilador, FastEntry, y limpieza total de @ts-nocheck (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `firestore.rules`, `src/hooks/useSystemSettings.ts`, `src/pages/Settings.tsx`, `src/pages/MaquiladorPortal.tsx`, `functions/src/index.ts`, `src/pages/FastEntry.tsx`, y los 8 archivos que tenían `@ts-nocheck`
**Problema:** 🔴 El PIN del Portal Maquilador vivía en `system_settings/global`, un documento con `allow read: if true` — legible por cualquiera sin sesión. Además, la función en la nube que lista órdenes activas solo exigía el PIN para la acción "ledger"; el camino principal (registrar entregas) no lo exigía en absoluto en el servidor. `FastEntry.tsx` escribía `invoices` sin `invoiceStatuses`, el mismo desajuste corregido antes en otras pantallas. Los 8 archivos con `@ts-nocheck` escondían, entre otras cosas: un destructuring de 40 valores usando solo 10-13, una API de `toast` inexistente (`toast.showError`/`toast.showSuccess` en vez de `toast(msg, tono)`), y cinco funciones usadas sin importar (`sound`, `addDoc`, `collection`, `db`, `PATHS`, `serverTimestamp`, `addDays`) que habrían tronado en tiempo real de uso.
**Impacto:** El PIN del portal era efectivamente público. Cualquier fallo dentro de un modal (como los `ReferenceError` reales encontrados) podía dejar el scroll de toda la app bloqueado (ver Iteración 12).
**Solución:** PIN movido a `system_settings_private/maquila`, legible solo por super admin; el cliente nunca ve el valor real, solo envía el intento al servidor. La función en la nube exige PIN válido para cualquier acción. `FastEntry.tsx` usa `camposInvoices()`. Los 8 archivos limpiados uno por uno, cada uno verificado con `tsc --noEmit` antes de continuar con el siguiente.
**Riesgo:** 🟡 Medio en el cambio de seguridad (toca autenticación), 🟢 Bajo en el resto.
**Commit:** `fix(security): PIN del portal maquilador ya no es publico; fix(FastEntry): sincronizar invoiceStatuses; refactor: eliminar @ts-nocheck de los 8 archivos restantes`
**Estado:** ✅ Verificado — `tsc` limpio en raíz y functions, `eslint` **0 errores y 0 avisos** en todo el proyecto, 39/39 pruebas, build completo.

### Iteración 14: Las 4 propuestas de mejora — estado real de cada una
**Fecha:** 2026-08-03
1. **Dividir Dashboard.tsx** — no se dividió en esta pasada (715 líneas, ya más manejable de lo reportado originalmente); se priorizó la seguridad y los bugs reales encontrados. Queda como siguiente paso si se retoma.
2. **Tarjetas en Compras** — el botón de recepción rápida sin modales pesados **ya existía** (`RegistrarEntregaModal`, construido en un ciclo anterior); se renombró a "📦 Recibir Kilos Rápidos" para coincidir con la propuesta. El rediseño visual completo a tarjetas (en vez de tabla) no se hizo — es un cambio de layout más grande, no un bug.
3. **Acciones rápidas en Cobranza** — "✅ Cobrar Exacto" **ya existía**. Se agregó **"💬 WhatsApp"** real (enlace `wa.me` con el mensaje precargado, en vez de solo copiar al portapapeles). "Reprogramar" no se implementó.
4. **Lectura automática de PDF con IA** — 🔴 NO implementado a propósito. Requeriría reintroducir capacidad de IA (OCR/extracción), la misma que se retiró antes por decisión explícita del usuario. No se reintroduce sin confirmar primero que sigue siendo lo que se quiere, dado ese historial.
**Estado:** Parcialmente completado, con razones explícitas para cada punto no construido.

### Iteración 15: Descarga/subida de sábana nunca coincidieron; botón OC roto; branding incorrecto (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/pages/Orders.tsx`, `src/pages/Dashboard.tsx`, `src/pages/DataMining.tsx`, `src/pages/Settings.tsx`, `src/components/Layout.tsx`, `public/plantilla_llena.xlsx`
**Problema:** 🔴 El usuario reportó "varias sábanas" y que la Auditoría Maestra parecía no funcionar. Al comparar un Excel descargado en producción contra el código actual: **el sitio en vivo corre una versión vieja de `export.ts`** que genera hojas llamadas `Cobranza_Clientes`/`Caja Chica` sin `ID_SISTEMA`, mientras `AuditSync.tsx` busca `Auditoria_Cobranza`/`Auditoria_CajaChica` — nunca coincidían, así que subir de vuelta un archivo descargado no encontraba nada que comparar. El código en este repo YA genera el formato correcto (confirmado línea por línea) — el problema es que producción no se ha desplegado con él. Además: (1) un botón de Dashboard descargaba un archivo estático (`plantilla_llena.xlsx`) congelado desde su creación, sin relación con la base de datos real — riesgo real de subir datos viejos pensando que eran actuales, ya eliminado; (2) "Subir OC (PDF)" en Expedientes navegaba a `/subir`, una ruta que ya no existe, regresando al usuario al inicio en silencio; (3) `DataMining.tsx` llamaba a `exportToExcel()` con parámetros que la función no acepta (`as any` escondía el error), descargando el volcado genérico en vez de su tabla de análisis calculada; (4) el pie de página decía "Desarrollado por Elver Gonzalez" en vez del nombre real del usuario.
**Impacto:** Auditoría Maestra percibida como no funcional; riesgo de sobrescribir datos reales con una foto vieja; un botón completamente muerto; crédito de autoría incorrecto.
**Solución:** Botón de sábana estática reemplazado por la exportación en vivo (misma función que ya usan los otros tres botones). "Subir OC (PDF)" ahora abre un expediente nuevo directo en la pestaña Productos (donde vive de verdad la función de pegar/extraer texto de una OC), separado de "+ Expediente Manual" que abre en Resumen. `DataMining.tsx` ahora escribe su propio Excel con `xlsx` directamente, con los datos que el botón promete. Corregido el nombre en el pie de página.
**Riesgo:** 🟢 Bajo — son correcciones de UI y de una ruta muerta, no tocan fórmulas financieras.
**Commit:** `fix: reparar boton de subir OC, exportacion de Data Mining, eliminar sabana estatica peligrosa, corregir credito de autoria`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### 📌 Acción requerida del usuario, no resoluble desde este entorno
1. **Desplegar esta versión** — el desajuste entre exportación e importación de la sábana ya está resuelto en el código, pero solo tendrá efecto una vez desplegado.
2. **Revisar `CAJA` en producción**: se detectó un movimiento de prueba de "$8" registrado hoy (visible en el log de auditoría del panel), que dejó el saldo mostrado en $9.00 en vez del saldo real (~$75,270). Hay que borrarlo manualmente desde `/caja-chica` una vez desplegado.
3. Una vez desplegado, descargar la sábana de nuevo (ya vendrá con `ID_SISTEMA` real) y compartirla para hacer el cruce correcto de los 10 contrarecibos y las 2 cobranzas nuevas (TR_3640, TR_3620) sin riesgo de duplicar.

### Iteración 16: Auditoría completa de menús, rutas y scroll (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/pages/Dashboard.tsx`, `src/pages/Orders.tsx`
**Problema:** El usuario pidió revisar todos los menús, submenús y páginas — funcionamiento de scrolls, que todo se vea bien y sea funcional. Verificación sistemática:
- Los 10 enlaces del menú principal (`Layout.tsx`) contra las rutas reales (`App.tsx`): **todos coinciden**, sin enlaces muertos en la navegación principal.
- Búsqueda de `overflow: hidden` en todo `src/`: ninguno a nivel de página o `body` — todos son locales (recorte de texto, esquinas redondeadas, barras de progreso, plantillas de impresión). El único bug de scroll real ya se corrigió en el Ciclo 12.
- Los dos tableros Kanban (`Orders/KanbanBoard.tsx`, `Cobranza/TableroKanban.tsx`): scroll horizontal y vertical bien implementados, con `maxHeight` correcto en las columnas.
- Cobertura de `.table-scroll` en tablas anchas: completa, sin faltantes.
- 🔴 Búsqueda de cada `navigate()`/`nav()` a rutas internas encontró **dos ocurrencias más del mismo bug** ya corregido una vez: `nav('/subir')` duplicado en `Dashboard.tsx` (idéntico al de `Orders.tsx`, apunta a una ruta eliminada), y `nav('/seed')` en el mensaje de "sistema sin órdenes" — `Seeder.tsx` fue eliminado del proyecto hace varios ciclos y este mensaje nunca se actualizó.
**Impacto:** Dos botones adicionales, no detectados en la corrección anterior porque solo se revisó `Orders.tsx`, no todo el proyecto.
**Solución:** Botón de Dashboard corregido con el mismo patrón (abre expediente nuevo directo en Productos). Mensaje de "sistema vacío" reescrito con dos opciones reales: ir a la Auditoría Maestra (carga masiva vía Excel) o capturar a mano — ninguna apunta a una pantalla que ya no existe.
**Riesgo:** 🟢 Bajo.
**Commit:** `fix: corregir las dos ultimas rutas muertas (dashboard duplicado y mensaje de sistema vacio)`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo. Barrido completo de rutas internas confirma cero referencias muertas restantes en todo el proyecto.

### Iteración 17: isClosedShort corregido, Compras a tarjetas, Reprogramar en Cobranza (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/lib/finance.ts`, `src/pages/Compras.tsx`, `src/components/Cobranza/index.tsx`, `src/components/Cobranza/ProximasTable.tsx`
**Problema:** 🔴 `isClosedShort` (cierre forzado de una OC sin completar) tenía una inconsistencia real entre el código y su propio comentario: `getOrderSummary()` solo revisaba `isClosedShort` dentro de un bloque que exige `invoices.length > 0`. El disparador real (el aviso automático "completaste la entrega, ¿cerrar?") puede activarse sobre un expediente que **todavía no tiene ninguna factura** (estatus `pedido`) — en ese caso, `isClosedShort` se guardaba en `true`, pero el estatus se quedaba pegado en `pedido` para siempre, contradiciendo la promesa de la ventana de confirmación ("deja de aparecer como pendiente"). Además, en `Compras.tsx` se confirmó que **el buscador y el filtro "Activas/Completadas" no hacían absolutamente nada** — existían como controles visuales sin conectar a la lista.
**Impacto:** Expedientes cerrados a la fuerza que seguían apareciendo como pendientes indefinidamente; dos controles de UI que aparentaban funcionar y no hacían nada.
**Solución:** El chequeo de `isClosedShort` se movió fuera del bloque que exige facturas, para que aplique sin importar si ya existen o no. Comentario interno corregido para reflejar la realidad del código. Buscador y filtro de Compras conectados de verdad a la lista. De paso, tabla convertida a tarjetas (Propuesta 2 original): folio, cliente, barra de progreso de kilos, monto, y el botón de recepción rápida, todo visible de un vistazo.
**Riesgo:** 🟡 Medio — toca la función central de estatus de todo el sistema (`getOrderSummary`); mitigado con las 18 pruebas de `finance.test.ts`, todas verdes tras el cambio.
**Commit:** `fix(finance): isClosedShort aplica sin importar si hay facturas; feat(Compras): tarjetas + buscador/filtro reales; feat(Cobranza): Reprogramar`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Nota sobre html2pdf.js
Investigado y confirmado que **no requiere corrección**: ya se importa de forma dinámica (`await import('html2pdf.js')`) dentro de una función que solo se ejecuta al presionar un botón de "Compartir PDF" — los 6 puntos donde se usa están dentro de manejadores de clic, ninguno se ejecuta al cargar la página. El peso de 982 KB solo se descarga cuando alguien de verdad genera un PDF, no en cada visita.

### Iteración 18: Sábana de Cobranza real corregida; Auditoría Maestra reconstruida visualmente; menú de sábana consolidado (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/pages/AuditSync.tsx`, `src/pages/Dashboard.tsx`
**Problema:** 🔴 Al subir la sábana real de vuelta, aparecieron 14 errores: `Estatus "issued" no es válido`. Investigado contra la base de datos real: 12 facturas (los 10 contrarecibos originales de Andrés + 2 facturas en revisión) tenían `creditCycle.status: 'issued'`, un valor que nunca existió en el enum real del sistema — residuo de la migración original, antes de que se definieran los estatus válidos. Al mismo tiempo se descubrió que esas mismas 10 facturas tenían `invoiceTotal: 0` en producción, aunque sus montos reales son conocidos. Se armó y entregó un archivo corregido (26 ajustes: 12 estatus + 10 montos + 1 fecha) construido directamente sobre la sábana real descargada por el usuario, preservando los `ID_SISTEMA` reales para actualizar en vez de duplicar. El usuario confirmó además que "Recibimos dinero" debía ser $76,140 (no $100,000, un valor de prueba) — corregido con el mismo mecanismo.

Por separado, el usuario reportó: (1) el botón "Subir Sábana Modificada" era casi invisible sobre fondo blanco — investigado: usaba `var(--brand)`, una variable CSS que **no existe en ninguna parte del proyecto**, dejando el botón sin color de fondo; (2) no había forma de cancelar, solo "Aplicar Cambios"; (3) el menú de la sábana se repetía en la Visión Global — confirmado: existían **tres botones que descargan exactamente el mismo archivo** con nombres distintos ("Descargar Sábana", "Sábana de Auditoría", "Cierre de Mes Excel" — este último con una etiqueta engañosa que sugería un filtro por mes que nunca existió).
**Impacto:** Auditoría Maestra percibida como rota (botón invisible); sin forma de cancelar una carga; Dashboard confuso con acciones duplicadas bajo nombres distintos.
**Solución:** `AuditSync.tsx` reconstruido con las clases y variables reales del sistema (`.btn`, `.btn-primary`, `Card`, `Empty`, variables `--ok`/`--warn`/`--bad`), botón "Cancelar" agregado en dos lugares (junto a las pestañas y junto a "Aplicar Cambios"). En el Dashboard: los tres botones de descarga se consolidaron en uno solo arriba; el card duplicado de "Sábana de Auditoría" ahora navega a la Auditoría Maestra (acción distinta) en vez de repetir la descarga.
**Riesgo:** 🟢 Bajo — cambios visuales y de navegación, no tocan lógica financiera.
**Commit:** `fix(AuditSync): reconstruir UI con estilos reales, agregar Cancelar; fix(Dashboard): consolidar los 3 botones de descarga duplicados`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### 📌 Nota importante para el usuario
Las cifras del panel ("Facturado (Te Deben) $136,300.00", "1 contrarecibo pasado de fecha") siguen sin reflejar los 26 ajustes recién aplicados — es el mismo patrón de siempre: el agregado del servidor no se actualiza retroactivamente sobre datos que ya existían. **Se requiere presionar "Recalcular Indicadores" para ver las cifras correctas.**

### Iteración 19: Tabla de contrarecibos por vencer; "Pendiente por Facturar" corregido con documento real (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/components/Dashboard/ContrarecibosTable.tsx` (nuevo), `src/pages/Dashboard.tsx`
**Contexto:** El usuario compartió 9 documentos CFDI reales (facturas, complementos de pago, capturas del portal de Providencia). Cruce reveló que la Factura 6159 factura exactamente la mitad de cada producto de la OC-71-14014 (500 kg de 983.46/1000/980.70) — el "Pendiente por Facturar" que se venía rastreando como $161,606.00 (2,964.16 kg completos) en realidad bajó a **$81,780.00 (1,500 kg reales)**, dato que solo se pudo confirmar con el documento fiscal real, no adivinado.
**Solicitud explícita:** "el cuadro de los contrarecibos para saber lo que se vence y se vencerá de forma clara" — no existía en el panel.
**Solución:** Nuevo componente `ContrarecibosTable`, construido directo de las órdenes activas (no del agregado del servidor, que se desactualiza hasta recalcular) — cada contrarecibo con folio, cliente, fecha de vencimiento, monto, y su estado (vigente/próximo a vencer en 7 días/vencido con días de atraso), más el resumen de totales vigentes vs. vencidos.
**Riesgo:** 🟢 Bajo — componente nuevo, de solo lectura, no toca escritura de datos.
**Commit:** `feat(Dashboard): agregar tabla de contrarecibos por vencer`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### 📌 Pendiente — alcance completo de "perfeccionar el flujo" y limpiar Visión Global
El usuario pidió una revisión mucho más amplia (limpiar información "irrelevante" de Visión Global, hacer todo el flujo OC→cobro más visual/proactivo con skeletons y menús interactivos, y una auditoría completa del ciclo de negocio). Dado el tamaño, se entregó la pieza concreta y explícitamente solicitada (la tabla de contrarecibos) en este ciclo. El resto queda como trabajo de continuación, a abordar por partes para no comprometer la verificación de cada cambio.

### Iteración 20: Panel de Flujo Providencia con líneas claras (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/components/Dashboard/DashboardKpiGrid.tsx`
**Problema:** El usuario pidió ver claramente: Contrarecibos, Facturas en Revisión, y Pendiente por Facturar como conceptos separados que suman la Deuda Total Providencia. La fórmula YA estaba correcta (`deudaTotalProvidencia = porCobrar + montoPendienteFacturar`, donde `porCobrar` ya se separaba internamente en `porCobrarSinCR`/`porCobrarConCR`) — pero esa separación solo se mostraba como texto pequeño sin etiqueta al final de la tarjeta, no como líneas claras del desglose principal.
**Solución:** "Facturado (Te Deben)" (una sola cifra combinada) reemplazado por dos líneas explícitas: "Facturas en Revisión (sin CR)" y "Contrarecibos (con CR)", usando el vocabulario exacto que pidió el usuario.
**Riesgo:** 🟢 Bajo — solo relabeling, la fórmula subyacente no cambió.
**Commit:** `style(Dashboard): mostrar Facturas en Revision y Contrarecibos como lineas separadas`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Nota: "Total Vendido" y el botón "Subir OC"
Ambos reportados de nuevo por el usuario. Investigado: "Total Vendido" no es un bug — depende del selector "Mes P&L" (default "Histórico Global", pero cambia si el usuario selecciona un mes específico). El botón "Subir OC (PDF)" ya está corregido en el código desde el Ciclo 16; si sigue fallando en producción, la explicación más probable es que esa versión no se ha desplegado todavía.

### Iteración 21: "Ganancias Estimadas" reemplazada por Seguimiento de Pedidos (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/components/Dashboard/SeguimientoPedidosTable.tsx` (nuevo), `src/pages/Dashboard.tsx`, `src/components/Dashboard/DashboardCharts.tsx` (eliminado)
**Problema:** El usuario dijo explícitamente que la gráfica "Ganancias Estimadas por Fecha de Factura" no le interesa — lo que necesita es seguimiento de sus pedidos (OC), pagos y cobros.
**Solución:** Gráfica eliminada por completo (componente y archivo). Nueva tabla `SeguimientoPedidosTable`: una fila por expediente con folio, cliente, fecha, kilos pedidos/entregados/facturados (con porcentaje de avance), total, cobrado, y estatus — construida sobre `getOrderSummary()`, ya probado y usado en el resto del sistema.
**Riesgo:** 🟢 Bajo — quita una gráfica, agrega una tabla de solo lectura.
**Commit:** `feat(Dashboard): reemplazar grafica de ganancias por tabla de seguimiento de pedidos`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo. Bundle del Dashboard ~370 KB más liviano al quitar la dependencia de gráficas para esa sección.

### Iteración 22: 🔴 CRÍTICO — Expedientes, compras, gastos y productos invisibles por orderBy silencioso (COMPLETADO)
**Fecha:** 2026-08-03
**Archivo:** `src/context/OrdersContext.tsx`, `src/context/PurchasesContext.tsx`, `src/context/ExpensesContext.tsx`, `src/context/ProductsContext.tsx`
**Problema:** 🔴🔴 El usuario reportó que la tabla nueva de "Contrarecibos — Qué vence y cuándo" salía vacía, pese a tener 10 contrarecibos reales con datos correctos (verificados en la sábana). Investigación reveló la causa raíz: **`OrdersContext.tsx` consultaba con `orderBy('processedAt', 'desc')`** — y Firestore **excluye por completo, en silencio, cualquier documento que no tenga el campo usado en `orderBy`**, sin lanzar error ni advertencia. El expediente que agrupa los 10 contrarecibos originales (creado por la migración inicial, antes de que `processedAt` se capturara consistentemente) no tiene ese campo — así que ha sido **invisible en absolutamente todas las pantallas que usan `useOrders()`: Dashboard, Cobranza, Compras, Expedientes** — durante toda esta sesión, aunque la Auditoría Maestra sí lo veía (usa una consulta distinta, sin `orderBy`, por eso ahí sí se pudo corregir). Se encontró el mismo patrón peligroso en otras tres suscripciones: `PurchasesContext.tsx` (compras a Andrés, `orderBy('date')`), `ExpensesContext.tsx` (Caja Chica, `orderBy('date')`) y `ProductsContext.tsx` (catálogo, `orderBy('description')`) — cualquier registro sin ese campo exacto desaparecería igual, en silencio.
**Impacto:** Esta es probablemente la causa de fondo de buena parte de la confusión de cifras a lo largo de toda la sesión — datos reales, correctos en Firestore, invisibles para el sistema sin ningún error visible.
**Solución:** Las cuatro consultas ya no usan `orderBy` de Firestore — se ordenan del lado del cliente, con un valor de respaldo (`?? 0` / cadena vacía) para que ningún documento pueda excluirse por faltarle el campo de orden.
**Riesgo:** 🟡 Medio — toca las cuatro fuentes de datos más usadas del sistema; mitigado con verificación completa y el hecho de que el cambio es puramente aditivo (ver más documentos, nunca menos).
**Commit:** `fix(context): eliminar orderBy que excluia documentos en silencio en Orders/Purchases/Expenses/Products`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 23: 🔴 CAUSA RAÍZ ENCONTRADA — el total de una factura se recalcula de Kilos × Precio, no de un valor guardado (COMPLETADO)
**Fecha:** 2026-08-03/04
**Archivo:** `src/pages/AuditSync.tsx`
**Problema:** 🔴🔴🔴 Investigación en vivo, directo en el navegador del usuario (lectura de IndexedDB del caché de Firestore), confirmó que las correcciones de monto aplicadas via Auditoría Maestra se "revertían" solas. Causa raíz real: el expediente calcula el total de cada factura como `kilos × precio` cada vez que se guarda — nunca confía en el valor de `invoiceTotal` guardado directamente. Las 12 facturas de la migración original tienen `kilos: 0` (nunca se capturó ese dato en la migración), así que **cualquier corrección de monto sin corregir también los kilos se pierde en el siguiente guardado del expediente**, sin ningún aviso. Se confirmó probando en vivo: al escribir manualmente los kilos correctos en una factura desde la UI, el monto se recalculó exacto al centavo.
**Impacto:** Explica por completo el ciclo de "lo corrijo, se ve bien, y luego vuelve a estar en $0" que se repitió varias veces con el usuario — no era caché, no eran datos corruptos nuevos, era esta causa estructural no identificada hasta ahora.
**Solución:** `AuditSync.tsx` ahora detecta y corrige también la columna `Kilos` de la sábana (ya existía en la exportación, nunca se leía de vuelta). Los renglones nuevos también calculan un valor de kilos razonable si el Excel no lo trae explícito, en vez de nacer con `kilos: 0` como antes.
**Riesgo:** 🟢 Bajo — la corrección solo agrega una columna más al mismo mecanismo ya verificado.
**Commit:** `fix(AuditSync): corregir tambien los kilos, causa raiz de que el monto se revertiera solo`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 24: Material Flotante negativo; conteo de "Vencido" corregido; soporte de Compras en Auditoría Maestra (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/pages/AuditSync.tsx`, `src/pages/Dashboard.tsx`, `src/components/Dashboard/DashboardKpiGrid.tsx`
**Contexto:** Tras aplicar la corrección de kilos del Ciclo 23, el usuario reportó dos problemas nuevos: (1) "Material Flotante" mostrando **-23,825.58 kg** — exactamente la suma de los kilos recién corregidos, con signo negativo; (2) "Vencido: $420,681.78" pero la etiqueta decía "1 contrarecibo pasado de fecha" cuando en realidad son 4 (confirmado: $107,420.76+$98,136.00+$106,477.56+$108,647.46 = $420,681.78 exacto).
**Causa raíz #1:** "Material Flotante" = kilos recibidos de Andrés (colección `purchases`) − kilos facturados (colección `orders`). El expediente de la migración original **nunca tuvo un registro de compra vinculado** — nunca pasó por "Registrar Entrega" ni por guardar el expediente completo, los dos únicos caminos que lo crean. Al corregir los kilos facturados sin que existiera el lado de "recibido", la resta se volvió negativa.
**Causa raíz #2:** El contador de "Vencido" cuenta **expedientes**, no facturas — correcto casi siempre (1 expediente = 1 factura), pero incorrecto para este expediente que agrupa 12 contrarecibos en un solo documento.
**Solución:** (1) La Auditoría Maestra ahora soporta también la hoja `Auditoria_Compras` (la exportación ya generaba las columnas correctas desde el Ciclo 18, nunca se leían de vuelta) — detecta y crea/corrige registros de compra faltantes o desactualizados, usando el mismo esquema que `upsertAndresPurchase()`. (2) El conteo de "Vencido" ahora se calcula en vivo por factura individual en `Dashboard.tsx`, en vez de depender del contador de expedientes del agregado del servidor.
**Riesgo:** 🟡 Medio en la escritura de Compras (dinero real, nueva superficie de escritura); 🟢 Bajo en el conteo de Vencido (solo lectura).
**Commit:** `feat(AuditSync): soporte para Auditoria_Compras; fix(Dashboard): contar vencidos por factura, no por expediente`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 25: El botón "Eliminar" de Caja Chica no aparecía para el movimiento de prueba (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/pages/Settings.tsx`, `src/pages/CajaChica.tsx`
**Problema:** El usuario reportó que `/caja-chica` no tenía botón "Eliminar" para borrar el movimiento de prueba de $8. Causa: ese botón solo aparece si `expense.createdAt` es verdadero — y el botón "Inyectar Saldo" en Configuración (el que creó ese movimiento) **nunca guardó el campo `createdAt`**, dejándolo permanentemente sin ese campo. Cualquier registro creado por ese botón queda atrapado sin poder borrarse, para siempre, sin importar qué versión del sistema se instale después.
**Solución:** Se agregó `createdAt: serverTimestamp()` a la creación del saldo inicial (previene que se repita). Para los registros que YA quedaron atrapados (como el de $8), se corrigió la condición del botón: los 4 lugares que crean un movimiento nuevo en blanco marcan explícitamente `createdAt: null` a propósito — así que un registro real, aunque le falte el campo por este bug, tiene `createdAt === undefined`, que es distinto de `null`. El botón ahora se muestra con `expense.createdAt !== null` en vez de un chequeo de verdad simple, permitiendo borrar cualquier registro real ya guardado sin arriesgar mostrar el botón sobre un borrador todavía sin guardar.
**Riesgo:** 🟢 Bajo — corrige la condición de visibilidad de un botón, no la lógica de borrado en sí (que ya funcionaba y estaba probada).
**Commit:** `fix(CajaChica): boton Eliminar visible en registros reales sin createdAt; fix(Settings): guardar createdAt en el saldo inicial`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 26: "Pegar Texto de OC" no funcionaba — tres causas reales encontradas (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/components/PasteTextModal.tsx` (nuevo), `src/components/OrderModal/TabResumen.tsx`, `src/components/OrderModal/TabFacturas.tsx`, `src/components/OrderModal/TabProductos.tsx`
**Problema:** El usuario pegó el texto real de una OC y no funcionó. Investigación encontró tres causas reales, no una:
1. **Colores rotos**: el botón de "Pegar Texto de OC" en la pestaña Resumen usaba `var(--brand-light)`/`var(--brand-dark)` — variables CSS que **no existen en el proyecto**, mismo patrón del bug de `var(--brand)` corregido en un ciclo anterior.
2. **Las 3 funciones de "pegar texto"** (OC, Factura, Complemento de Pago) usaban `window.prompt()` — un cuadro nativo de una sola línea, frágil para pegar un documento completo: fácil de pegar mal, sin forma de revisar el contenido, y un clic fuera de lugar pierde todo el texto sin aviso.
3. **Existían DOS implementaciones distintas** de "pegar OC" — una simple en la pestaña Resumen (solo folio + kilos totales) y una completa en Productos (cada artículo con código, cantidad y precio) — sin que quedara claro cuál usar, y el enrutamiento del botón principal de "Subir/Pegar OC" mandaba a veces a la pestaña equivocada.
**Solución:** Nuevo componente `PasteTextModal` reutilizable (textarea real, botón de confirmar explícito) que reemplaza los 3 `window.prompt()`. Colores corregidos a variables reales. Confirmado con prueba de escritorio que el parser de Productos SÍ extrae correctamente folio, proveedor, y los 3 artículos del texto real que pegó el usuario — el problema nunca fue la lógica de extracción, sino los tres bugs de arriba impidiendo que el texto llegara limpio a esa lógica.
**Riesgo:** 🟢 Bajo — cambios de UI y de mecanismo de captura de texto, no tocan cálculos financieros.
**Commit:** `fix(OrderModal): reemplazar window.prompt por modal confiable en las 3 funciones de pegar texto; fix: corregir colores de boton indefinidos`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 27: 🔴 CRÍTICO — Imposible guardar CUALQUIER expediente nuevo por primera vez (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/useOrderActions.ts`
**Problema:** 🔴🔴🔴 El usuario reportó "No se pudo guardar: El expediente ya no existe" al intentar guardar un expediente recién creado con "Subir/Pegar OC". Causa: la función de guardado usaba `if (!snap.exists()) throw new Error('El expediente ya no existe.')` de forma **incondicional** — exigiendo que el documento YA existiera en Firestore antes de poder guardarlo. Para un expediente genuinamente nuevo (creado con "+ Expediente Manual", "Subir/Pegar OC" o "Venta Manual", que solo generan un ID en el navegador sin escribir nada a Firestore todavía), `snap.exists()` es `false` la primera vez — lo esperado, no un error — pero el código lo trataba como si el expediente hubiera sido borrado por alguien más.
**Impacto:** Guardar CUALQUIER expediente nuevo, por cualquiera de los tres caminos que lo crean, estaba completamente roto. No es un problema aislado del pegado de OC — es un bloqueo total a dar de alta cualquier pedido nuevo en el sistema.
**Solución:** El chequeo de "ya no existe" ahora solo se exige cuando `baselineUpdatedAt` está presente — es decir, cuando el expediente se leyó antes de una version real ya guardada. Un expediente nuevo (sin `baselineUpdatedAt`, porque nunca se leyó de Firestore) ya no dispara el error — se crea normalmente. Se revisaron las otras 4 ocurrencias del mismo patrón en el sistema (Compras, Cobranza ×3): todas operan sobre expedientes que ya existen por diseño, así que esas sí están correctas y no se tocaron.
**Riesgo:** 🟡 Medio — toca la función de guardado central de expedientes; mitigado revisando cuidadosamente que la protección contra ediciones simultáneas siga funcionando igual para expedientes existentes (sin cambios en ese camino).
**Commit:** `fix(OrderModal): permitir guardar un expediente nuevo por primera vez sin requerir que ya exista`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 28: Tablero de Cobranza clasificaba TODO como "Sin CR", aunque sí tuvieran contrarecibo (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Cobranza/TableroKanban.tsx`
**Problema:** 🔴 Verificado en vivo, en el navegador del usuario: los 10 contrarecibos reales (TH-836, GT-742, etc.) mostraban correctamente su insignia verde "CR: TH-836" en cada tarjeta, pero **todos** aparecían en la columna "En Revisión (Sin CR)" — la columna "Por Cobrar (Con CR)" estaba vacía. Causa: el tablero leía `data.open`, el arreglo crudo de facturas abiertas, que **nunca tuvo el campo `hasCr` calculado** — ese cálculo solo existe en `data.lista`, un arreglo derivado y separado construido aparte. `!x.hasCr` sobre un campo inexistente (`undefined`) es siempre verdadero, así que absolutamente todo caía en "Sin CR" sin importar si de verdad tenía contrarecibo — mientras la tarjeta individual sí calculaba el dato correcto de forma independiente para su propia insignia, revelando la contradicción visual.
**Impacto:** El tablero Kanban de Cobranza no distinguía en absoluto entre facturas con y sin contrarecibo — la columna diseñada específicamente para ese propósito nunca funcionó desde que se construyó.
**Solución:** El tablero ahora usa `data.lista` (el arreglo ya correcto, que las tarjetas y otras pantallas de Cobranza ya usan) en vez de `data.open`.
**Riesgo:** 🟢 Bajo — corrige la fuente de datos que alimenta la clasificación visual, no toca escritura.
**Commit:** `fix(TableroKanban): usar data.lista con hasCr calculado en vez del arreglo crudo data.open`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 29: 🔴 CRÍTICO — Guardar un expediente sin Costo/Precio/Comisión personalizados tronaba el guardado completo (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/useOrderActions.ts`
**Problema:** 🔴🔴🔴 Error real capturado del usuario: `Function Transaction.set() called with invalid data. Unsupported field value: undefined (found in field customCostPrice...)`. Causa: `customCostPrice`, `customSellPrice`, y `customCommissionRate` son campos opcionales (el usuario los deja en blanco casi siempre) — pero el código los incluía SIEMPRE en el objeto que se guarda, con valor `undefined` cuando estaban vacíos. **Firestore rechaza la escritura COMPLETA si cualquier campo llega como `undefined`** — no lo ignora, no lo omite, truena todo el documento. Esto probablemente explica también los "cuelgues" repetidos de la automatización del navegador en los intentos previos de esta sesión: el error se lanza dentro de la transacción y, mal manejado, puede congelar el hilo de renderizado.
**Impacto:** Guardar cualquier expediente nuevo (o editar uno existente) SIN capturar los tres campos opcionales de precio personalizado —el caso más común— fallaba silenciosamente o con este error.
**Solución:** Los tres campos ahora solo se incluyen en el objeto a guardar si tienen un valor real; si están vacíos, se omiten por completo del documento en vez de mandarse como `undefined`.
**Riesgo:** 🟢 Bajo — la corrección es puramente aditiva (omitir campos vacíos), no cambia el comportamiento para expedientes que sí tienen esos valores capturados.
**Commit:** `fix(OrderModal): omitir campos opcionales vacios en vez de mandarlos como undefined a Firestore`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 30: Columna fija en tablas anchas (mejora visual, no crítica) (COMPLETADO)
**Fecha:** 2026-08-04
**Archivo:** `src/index.css`, `src/pages/Orders.tsx`, `src/components/Dashboard/ContrarecibosTable.tsx`, `src/components/Dashboard/SeguimientoPedidosTable.tsx`
**Contexto:** El usuario confirmó que el arreglo de la barra de scroll de v6.53.0 sí está presente en el código, pero pidió algo más "profesional" y proactivo — que valiera la pena la sesión. Se agregó `position: sticky` a la primera columna (Expediente/OC, Contrarecibo, Folio OC) en las tres tablas anchas del sistema, para que se quede visible al hacer scroll lateral — un patrón estándar de tablas profesionales, reduce la necesidad de usar el scroll en primer lugar. De paso, se encontró y corrigió otra instancia de `var(--brand)` (variable CSS indefinida) en la insignia "CR:" de Expedientes.
**Riesgo:** 🟢 Bajo — CSS puro, `position: sticky` es una técnica estándar y bien soportada.
**Verificación:** `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo. **No se pudo probar visualmente en vivo** (el navegador de pruebas y el entorno de código están en redes separadas, sin forma de servir la build local ahí) — verificado por revisión de código, no por captura de pantalla.
**Commit:** `feat(tablas): columna fija al hacer scroll lateral; fix: otra instancia de var(--brand) indefinida`
**Estado:** ✅ Compilado y verificado; visual sin confirmar en vivo.

### Iteración 31: Tarjeta "Flujo de Efectivo Providencia" rediseñada; "Pendiente por Facturar" sigue en $0 por el bloqueo entre pestañas (COMPLETADO parcial)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Dashboard/DashboardKpiGrid.tsx`
**Contexto:** El usuario pidió mejorar visualmente las tarjetas de Cobranza y preguntó por qué "Pendiente por Facturar" sigue en $0. Se intentó crear en vivo el expediente de la OC-71-14014 directamente en el navegador del usuario, pero **el guardado se congeló de nuevo** — mismo patrón exacto del bloqueo entre pestañas (Ciclo con `persistentMultipleTabManager`) ya diagnosticado y corregido en v6.54.0, todavía no instalado por el usuario (sigue en v6.53.0 en producción). No se pudo completar el guardado del expediente por esta causa ambiental, no por un bug nuevo.
**Mejora visual aplicada:** La tarjeta "Flujo de Efectivo Providencia" ahora tiene una barra de composición (Facturas en Revisión / Contrarecibos / Pendiente, coloreada y proporcional al total) justo debajo del título, y cada línea del desglose tiene un punto de color que coincide con la barra — reemplaza el pie de texto plano anterior que solo repetía números ya mostrados arriba.
**Riesgo:** 🟢 Bajo — CSS/JSX puro, no toca cálculos.
**Pendiente real:** Una vez el usuario instale v6.54.0 (que ya incluye el arreglo de multi-pestaña), debe repetir la captura del expediente OC-71-14014 — la instrucción exacta ya se le dio dos veces en el chat.
**Commit:** `feat(DashboardKpiGrid): barra de composicion visual en tarjeta Flujo Providencia`
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 39/39 pruebas, build completo.

### Iteración 32: Expediente nuevo con entregas aparecía como "FACTURADO" sin ninguna factura real (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/lib/finance.ts`
**Contexto:** Se creó en vivo el expediente de la OC-71-14014 (Cliente Providencia, 3 artículos, 2,964.16 kg entregados, sin facturar a propósito). El guardado funcionó (confirma que v6.55.0 resolvió el bloqueo entre pestañas), pero el expediente apareció con **Estado: FACTURADO** y **Kilos Facturados: 2,964.16 kg**, pese a que "Facturado (c/IVA)" mostraba $0.00 y nunca se capturó ninguna factura.
**Causa raíz:** `getOrderSummary()` sintetiza una factura falsa cuando `invoices.length === 0` pero el expediente tiene folio — pensado para expedientes viejos migrados sin trazabilidad de facturas (donde "tener folio" era la única señal disponible). Pero esta misma regla se disparaba también para expedientes NUEVOS con entregas explícitas capturadas, marcándolos como facturados sin serlo.
**Solución:** La síntesis de factura ahora se omite si el expediente ya tiene entregas capturadas explícitamente — esa es una señal clara de que se está usando el flujo normal (Productos → Entregas → Facturas) y que "sin factura" significa genuinamente "pendiente de facturar", no un vacío de datos migrados.
**Riesgo:** 🟡 Medio — toca la función más usada del sistema (`getOrderSummary`). Verificado que las 39 pruebas existentes siguen pasando; no se pudo confirmar en vivo contra HIST-001/OC-HIST sin desplegar.
**Commit:** `fix(finance): no sintetizar factura falsa si el expediente ya tiene entregas explicitas`
**Estado:** ✅ Compilado y verificado. **NO DESPLEGADO** — a petición explícita del usuario ("no entregues más archivos hasta que te lo pido"). Este es probablemente el motivo real de que "Pendiente por Facturar" siga en $0 incluso después de crear el expediente correctamente.

### Iteración 33: Identificadores (OC/Folio/CR) etiquetados sin ambigüedad; skeleton en Caja Chica (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/pages/Orders.tsx`, `src/pages/CajaChica.tsx`
**Problema #1:** El usuario pidió explícitamente no mezclar número de factura, OC y contrarecibo. Se encontró la causa exacta: en Expedientes, la línea principal mostraba `{o.oc || o.folio || 'Sin Folio'}` — el número de OC o el folio interno, indistintamente, en negritas, **sin ninguna etiqueta que dijera cuál de los dos era**.
**Solución #1:** Cada identificador ahora lleva su propia insignia de color fija: **OC** (azul), **FOLIO** (morado), **CR** (verde) — nunca vuelven a verse como el mismo tipo de dato.
**Problema #2:** Caja Chica seguía usando un spinner genérico mientras las demás pantallas (Dashboard, Compras, Seguimiento de OC) ya usan skeletons con la forma real del contenido.
**Solución #2:** Caja Chica ahora usa el mismo patrón de skeleton (encabezado + tarjetas resumen + filas) que el resto del sistema.
**Nota sobre "responsive":** Revisado el CSS existente — el sistema YA tiene una capa responsive razonablemente completa (sidebar colapsable en móvil, cuadrícula de KPIs que se reacomoda, botones con área táctil mínima de 44px, tipografía de inputs a 16px para evitar zoom automático en iOS). No es un sistema no-responsive; los puntos de fricción reales identificados hasta ahora son más específicos (confusión de identificadores, ya corregida) que un problema estructural de layout.
**Riesgo:** 🟢 Bajo — CSS/JSX puro.
**Commit:** `feat(Orders): etiquetar OC/Folio/CR sin ambiguedad; feat(CajaChica): skeleton en vez de spinner generico`
**Estado:** ✅ Compilado y verificado. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 34: Mover tarjeta en Cobranza borraba el CR sin avisar (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Cobranza/index.tsx`
**Problema:** El usuario movió una tarjeta en el tablero de Cobranza y, al regresarla, el sistema le pidió el número de Contrarecibo desde cero — "se supone que ya lo tenía". Causa confirmada: mover una tarjeta de "Por Cobrar" de vuelta a "En Revisión" **borra el CR en silencio**, sin ninguna confirmación — es el comportamiento esperado del diseño (esa columna es "sin CR"), pero nada avisaba que se iba a perder el número.
**Solución:** (1) Ahora se pide confirmación explícita, mostrando el número de CR que se va a borrar, antes de hacerlo. (2) El sistema recuerda ese número por si el movimiento fue accidental — al regresar la tarjeta a "Por Cobrar", el cuadro para capturar el CR viene pre-llenado con el valor anterior en vez de pedirlo desde cero.
**Sobre el botón de "deshacer" general:** Un deshacer global (para cualquier acción del sistema) es un cambio arquitectónico grande — no lo implementé todavía. Lo que sí se corrigió es el caso concreto que reportó el usuario, con una mitigación de bajo riesgo (confirmar + recordar) en vez de una reescritura mayor.
**Riesgo:** 🟢 Bajo — agrega una confirmación y un valor recordado en memoria; no cambia la lógica de escritura.
**Commit:** `fix(Cobranza): confirmar antes de borrar el CR al mover a Revision; recordar el valor para restaurarlo`
**Estado:** ✅ Compilado y verificado. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 35: 🔴 CRÍTICO — "Deuda con Andrés" mostraba -$1,248,344.64 en vez de -$102,670.27 (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/lib/finance.ts` (nueva función `normalizarTexto`), `src/hooks/useDashboardStats.ts`, `src/hooks/useAndresStats.ts`, `src/pages/CajaChica.tsx`
**Problema:** El usuario reportó "ESTADO CON ANDRÉS: -$1,248,344.64" — muy lejos de los -$102,670.27 de su Excel. Investigación encontró **dos bugs distintos, en tres archivos**:
1. **Filtro de proveedor ausente**: en `useDashboardStats.ts` y `CajaChica.tsx`, la variable que sumaba las compras "de Andrés" (`totalPurchasesCost`, `provPurchases`) en realidad **sumaba TODAS las compras del sistema, sin filtrar por proveedor**, pese a estar nombrada como si sí filtrara. Una sola compra de prueba (creada en un ciclo anterior de esta sesión, para corregir "Material Flotante") se sumó de más aquí, inflando la deuda en más de un millón de pesos.
2. **Acentos rompiendo comparaciones**: donde SÍ existía un filtro por proveedor (`useAndresStats.ts`, usado en Compras), comparaba contra `'andres'` sin acento — pero esa misma compra de prueba se guardó como `'Andrés'` con acento. `'andrés' !== 'andres'` como texto — el filtro nunca coincidía, así que esa pantalla mostraba una cifra *distinta* a la del Dashboard, ninguna de las dos correcta.
**Solución:** Nueva función compartida `normalizarTexto()` (quita acentos, minúsculas, espacios) usada en los 4 puntos de comparación de proveedor en todo el sistema — "Andres" y "Andrés" ahora son siempre el mismo proveedor, sin importar quién lo haya escrito ni cómo.
**Riesgo:** 🟡 Medio — toca el cálculo financiero más sensible del sistema (deuda con el proveedor). Mitigado con 3 pruebas nuevas específicas para este caso (42/42 pruebas totales pasando).
**Commit:** `fix(Andres): filtrar compras/gastos por proveedor de forma consistente e insensible a acentos`
**Estado:** ✅ Compilado y verificado. **NO DESPLEGADO** — acumulando, a petición del usuario. Dado lo grave del error (una cifra contable equivocada por más de un millón de pesos), se recomienda priorizar esta entrega.

### Iteración 36: 🔴🔴 CRÍTICO — Resuelto el misterio: corregir un CR se revertía SIEMPRE, por diseño equivocado (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/TabFacturas.tsx`
**Problema:** Explica de raíz por qué "editar CR: 333333 → GT-597" nunca se quedaba guardado, en tres intentos distintos, sin ningún error. El campo Contrarecibo (CR) tenía un `onBlur` que **siempre reconstruía el valor usando `order.department` como prefijo fijo**, descartando el prefijo que el usuario acabara de escribir. Para el expediente de la migración original (que agrupa contrarecibos TH- y GT- mezclados, sin un `department` único), esto significa: escribir "GT-597" → al salir del campo, el código lo convertía en "TH-597" (usando el valor por defecto 'TH'), sin importar qué se hubiera escrito. **Cualquier corrección manual a un contrarecibo con prefijo distinto al del expediente se revertía sola, siempre, silenciosamente.**
**Impacto:** Esto no era un problema aislado del "333333" — es estructural: cualquier intento de corregir a mano un número de contrarecibo, en cualquier expediente sin `department` fijo, quedaba condenado a revertirse. Muy probablemente la causa real detrás de más de un intento fallido de esta sesión que se atribuyó (incorrectamente) a bloqueos de guardado.
**Solución:** El auto-formato ahora respeta el prefijo (TH- o GT-) si el usuario ya lo escribió explícitamente — solo aplica el prefijo por defecto del expediente cuando se escribe el número sin ningún prefijo.
**Riesgo:** 🟢 Bajo — el cambio es puramente aditivo (respeta más casos de los que ya funcionaban, no quita ninguno).
**Commit:** `fix(TabFacturas): no sobreescribir el prefijo del CR si el usuario ya escribio uno valido`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 37: 🔴 CRÍTICO — 23 variables CSS usadas en decenas de archivos, nunca definidas (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/index.css`, `src/components/Cobranza/TableroKanban.tsx`, `src/pages/MaquiladorPortal.tsx`, `src/pages/OcTracking.tsx`
**Contexto:** El usuario reportó pantallas y paneles "mal ajustados". Se hizo una auditoría sistemática: se extrajo cada `var(--nombre)` usado en TODO el código fuente y se comparó contra cada variable realmente declarada en `index.css`. Resultado: **23 variables usadas en el código, en más de 20 archivos distintos, que nunca se definieron en ninguna parte** — el mismo patrón exacto de `var(--brand)` que se venía corrigiendo caso por caso desde hace varios ciclos, pero mucho más extendido de lo que parecía.
**Ejemplo concreto encontrado en vivo:** en el tablero de Cobranza, las tarjetas usaban `var(--surface)` (fondo) y `var(--border)` (borde) — ninguna de las dos existe. Sin fondo ni borde reales, las tarjetas quedaban visualmente transparentes sobre el color de la columna, haciendo que el texto se viera "lavado", casi invisible en algunos casos.
**Solución:** En vez de corregir archivo por archivo (alto riesgo de dejar alguno sin tocar), se declararon **alias de compatibilidad** en `index.css` — cada variable faltante ahora apunta a la variable real y correcta del sistema de diseño (ej. `--surface` → `--paper-raised`, `--text-muted` → `--ink-soft`), en modo claro y oscuro. Esto corrige TODOS los usos existentes de una sola vez, en ambos temas, sin tocar decenas de archivos de componentes.
**Verificación de la auditoría:** se re-extrajeron todas las variables usadas después del cambio — **cero quedan sin definir** en todo el código fuente.
**Riesgo:** 🟢 Bajo — son declaraciones CSS nuevas que no eliminan ni modifican ninguna variable existente; solo agregan las que faltaban.
**Commit:** `fix(css): declarar alias para 23 variables usadas mas nunca definidas en todo el sistema`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 38: Barra de scroll vertical del tablero Kanban prácticamente invisible (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/index.css`, `src/components/Cobranza/TableroKanban.tsx`
**Problema:** El usuario reportó no ver la barra de scroll vertical en Cobranza — pensó que no había más contenido en pantalla. Causa: cada columna del tablero (300px de ancho) reservaba solo **4px** de espacio (`paddingRight: 4`) para la barra de scroll, pero la barra global del sistema mide **14px** — quedaba recortada casi por completo contra el borde de la columna, prácticamente invisible.
**Solución:** Las 4 columnas del tablero ahora usan una barra de scroll propia, más delgada (8px, proporcionada al ancho angosto de la columna) y con el espacio correcto reservado para que se vea completa, no recortada.
**Riesgo:** 🟢 Bajo — CSS puro.
**Commit:** `fix(TableroKanban): barra de scroll vertical propia, delgada y con espacio correcto`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 39: Guardar cualquier edición en expedientes migrados bloqueado por validaciones ajenas al cambio (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/useOrderActions.ts`
**Problema:** El usuario siguió las instrucciones para corregir el CR "333333" y recibió: "Los kilos totales del pedido deben ser mayores a cero." Investigación: el expediente de la migración original (`trenHXXX`) tiene `totalKilograms: 0` y **sin campo `provider` en absoluto** — pese a tener 12 facturas reales con kilos capturados individualmente. El guardado exigía SIEMPRE que el campo resumen "Kilos Pedidos (Total)" y "Proveedor" tuvieran valor, sin importar que el expediente ya tuviera datos financieros reales capturados a nivel factura — bloqueando CUALQUIER edición (hasta corregir un typo en un contrarecibo) por campos completamente ajenos al cambio que se estaba haciendo.
**Impacto:** Confirmado con los datos reales del expediente vía inspección directa de Firestore: el usuario habría chocado con un SEGUNDO bloqueo (proveedor faltante) inmediatamente después de resolver el primero.
**Solución:** Ambas validaciones ahora se omiten cuando el expediente ya tiene kilos reales capturados en sus facturas — solo bloquean el guardado de un expediente genuinamente vacío (sin facturas, sin kilos en ningún lado), que era la intención original.
**Riesgo:** 🟢 Bajo — la validación se vuelve más permisiva solo para expedientes que ya tienen datos financieros reales; sigue bloqueando la creación de un expediente vacío desde cero.
**Commit:** `fix(useOrderActions): no bloquear el guardado de un expediente con facturas reales por campos resumen sin llenar`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### 📌 Recomendación urgente
Este arreglo desbloquea directamente la tarea que el usuario lleva varios intentos tratando de completar (corregir el CR "333333" → "GT-597"). Se sugiere priorizar esta entrega.

### Iteración 40: 🔴 Sábana Maestra (/mining) se caía por completo con "Cannot read properties of undefined" (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/pages/DataMining.tsx`
**Problema:** Al abrir Sábana Maestra desde el menú, la pantalla entera se caía con `TypeError: Cannot read properties of undefined (reading 'toMillis')`. Causa: `.sort()` llamaba `.toMillis()` directo sobre `order.createdAt` sin verificar que existiera — cualquier expediente migrado sin esa fecha (como varios de los que hemos visto en esta sesión) tronaba la página completa.
**Segundo crash encontrado justo al lado, mismo patrón:** el filtro de búsqueda llamaba `.toLowerCase()` directo sobre `order.folio` y `order.client`, también sin verificar que existieran — los expedientes "Sin Folio" que hemos visto durante toda la sesión habrían tronado esto también, apenas se corrigiera el primero.
**Solución:** Ambos accesos ahora usan valores de respaldo seguros (`?? 0` para la fecha, `|| ''` para folio/cliente) — los expedientes sin esos datos se ordenan al final o simplemente no coinciden con la búsqueda, en vez de tronar toda la pantalla.
**Riesgo:** 🟢 Bajo — solo agrega manejo de casos nulos, no cambia el comportamiento para datos completos.
**Commit:** `fix(DataMining): no tronar la pantalla completa por expedientes sin fecha o sin folio`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 41: 🟢 Confirmado en vivo: "Pendiente por Facturar" ya muestra $161,606 exactos, cuadra 100% contra el Excel
**Fecha:** 2026-08-04
**Verificación:** Se revisó directamente el documento `stats/dashboard` del servidor y ya contiene `montoPendienteFacturar: 161606` — el cálculo del servidor SIEMPRE fue correcto; el $0 que se veía antes era una vista sin refrescar. Confirmado en pantalla: "Deuda Total Providencia: $1,319,423.80" coincide EXACTO con el Excel del usuario.
**Nota:** Se detectó de paso que "Material Flotante" volvió a mostrar un valor negativo (-20,861.42 kg) tras esta corrección — mismo patrón de la Iteración 24 (desbalance kilos facturados vs. recibidos). Pendiente de investigar en un ciclo dedicado, no reportado explícitamente por el usuario todavía.
**Archivo:** `src/index.css` — reforzada la barra de scroll de la pantalla principal (`html`/`body`) con una regla explícita adicional, en caso de que el selector universal no cubra el scroll raíz en todos los navegadores.
**Estado:** ✅ Verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 42: Al abrir un expediente, la página "salta" y la barra de scroll cambia de golpe (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/ui.tsx`
**Problema:** El usuario reportó que la barra de scroll vertical "no se ve bien" específicamente al abrir algo desde el panel "Por Cobrar". Causa encontrada: al abrir cualquier expediente, el modal bloquea el scroll del fondo con `document.body.style.overflow = 'hidden'` — correcto por diseño (evita scrollear la pantalla tapada) — pero **sin compensar el ancho que dejó la barra de scroll que acaba de desaparecer**. El contenido de la página salta unos píxeles hacia la derecha en el instante exacto en que se abre el expediente (y vuelve a saltar al cerrarlo), justo cuando la barra del modal (más corta, contenida solo en el cuadro del expediente) reemplaza visualmente a la barra de toda la página. Ese salto + cambio de barra es probablemente lo que se percibe como "no se ve bien".
**Solución:** Se mide el ancho real de la barra de scroll antes de ocultarla, y se compensa con `padding-right` en el body — el contenido ya no salta al abrir ni cerrar un expediente.
**Riesgo:** 🟢 Bajo — es una técnica estándar (scrollbar-width compensation), no cambia ningún comportamiento funcional.
**Commit:** `fix(Modal): compensar el ancho de la barra de scroll al bloquear el fondo, evita que la pagina salte al abrir un expediente`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 42: Tablero Kanban para Compras (Andrés) (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Compras/ComprasKanban.tsx` (nuevo), `src/pages/Compras.tsx`
**Contexto:** A petición del usuario, se construyó una vista de tablero para el flujo de compras con Andrés, con el mismo lenguaje visual que ya funciona bien en Cobranza (columnas, scroll propio, tarjetas con progreso).
**Columnas (según el flujo real que describió el usuario: OC → anticipo → entrega → pago):**
- 📋 **Pedido** — sin nada recibido todavía
- 🚚 **En Tránsito** — recibido parcial
- 📦 **Recibido — Falta Pagar** — 100% recibido, pago pendiente
- ✅ **Pagado** — recibido y liquidado
**Integración:** Botón "Lista / Tablero" en la pestaña "Órdenes de Compra" — no reemplaza la vista existente, se puede alternar.
**Hallazgo de paso:** las tarjetas de la vista de lista ya existente usaban clases `badge-ok`/`badge-warn` que **no existen en el CSS** (mismo patrón de bug encontrado varias veces antes) — corregido en este archivo con estilos en línea usando las variables reales. Se encontraron **5 archivos más** con el mismo patrón (`orderModalPrint.ts`, `TabEntregas.tsx`, `TabResumen.tsx`, `ChangelogFeed.tsx`, `Dashboard.tsx`) — quedan pendientes para un ciclo dedicado, no se tocaron para no desviarse de esta tarea.
**Riesgo:** 🟢 Bajo — vista nueva, de solo lectura (clic abre el mismo modal de edición que ya existía).
**Commit:** `feat(Compras): tablero Kanban para el flujo de compras con Andres`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 43: 🔴 Encontrada la causa real de "Material Flotante" negativo — guardar CUALQUIER cambio en un expediente borraba su registro de compra ligado (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/useOrderActions.ts`, `src/hooks/useDashboardStats.ts`
**Pregunta del usuario:** "-20,861.42 kg ¿es correcto? Pedí una auditoría anterior y no lo detectaste." Justo — se había anotado como pendiente sin explicar la causa real. Esta vez sí se investigó a fondo con los datos reales de Firestore.
**Causa raíz encontrada:** `upsertAndresPurchase()` se ejecuta en **cada guardado de cualquier expediente**, sin importar qué se edite, y **siempre recalcula `receivedKilos` desde `form.deliveries`** — sobrescribiendo el registro de compra ligado a ese expediente. Para el expediente de la migración original (OC-CR, que nunca tuvo un arreglo de "entregas" — solo kilos capturados directamente en cada factura), esto da `kilosEntregados = 0` **siempre**. Confirmado con los datos reales: el registro de compra "Andrés" que se corrigió manualmente a 23,825.58 kg en un ciclo anterior **volvió a quedar en 0** la primera vez que se guardó cualquier cambio en ese expediente — en este caso, la corrección del contrarecibo GT-597. Se encontró también un tercer registro de compra sin filtrar por proveedor ("N0342 - ELEMENTAL DENIM", 2,964.16 kg) sumándose de más al mismo cálculo.
**Solución:** (1) `upsertAndresPurchase` ahora usa los kilos de las facturas como respaldo cuando el expediente no tiene entregas explícitas, en vez de sobrescribir con 0. (2) "Material Flotante" ahora filtra las compras por proveedor (consistente con la Iteración 35) — ya no cuenta compras de otros proveedores como si fueran de Andrés.
**Dato pendiente de reparar:** El registro de compra "Andrés" sigue en 0 en la base de datos real ahora mismo — el código ya no lo va a volver a romper, pero el valor actual necesita corregirse una vez más después de desplegar (para no repetir el ciclo de "se corrige, se guarda algo no relacionado, se vuelve a romper").
**Riesgo:** 🟡 Medio — toca la función de vinculación de compras, usada en cada guardado de expediente. Mitigado: el cambio es conservador (solo evita sobrescribir con 0 cuando hay un respaldo real de kilos).
**Commit:** `fix(upsertAndresPurchase): no sobreescribir receivedKilos con 0 si el expediente no tiene entregas pero si facturas; fix(inventarioVivo): filtrar compras por proveedor`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 43: 🔴 "Ganancia Comercial" con margen por kilo inflado ($8.08/kg en vez de ~$5/kg real) — auditoría con números reales (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `functions/src/stats.ts`
**Contexto:** El usuario pidió una auditoría real de las fórmulas del sistema. Se verificó la fórmula base (`functions/src/shared/finance.core.ts`) — sólida, con aritmética decimal precisa y 21 pruebas. Pero al calcular margen-por-kilo con los números reales del servidor (`margenTotal / totalKilos = $550,852.98 / 68,140.55 kg = $8.08/kg`) contra el margen esperado del negocio (`$47 venta − $42 costo = $5/kg`), la diferencia era real y medible — no una percepción.
**Causa raíz, confirmada con los datos reales del expediente:** el KPI "kilos totales" leía `data.totalKilograms`, un campo a **nivel expediente** — para el expediente que agrupa los 10 contrarecibos reales, ese campo está en **0**, aunque sus 12 facturas suman **23,825.58 kg reales** capturados individualmente. El cálculo de "margen" sí usa los kilos de cada factura (correcto), pero el conteo de "kilos totales" no — dejando el denominador subestimado en más de 23 mil kilos, e inflando artificialmente el margen-por-kilo aparente.
**Solución:** El KPI de kilos ahora usa la suma real de las facturas como respaldo cuando el campo resumen del expediente está vacío — mismo patrón de corrección que ya se aplicó para "Pendiente por Facturar" y "Material Flotante" en ciclos anteriores.
**Riesgo:** 🟡 Medio — toca el cálculo de kilos del agregado del servidor, usado por varios KPIs. Mitigado: el cambio es un respaldo aditivo (solo actúa cuando el campo principal está vacío), no cambia ningún caso donde `totalKilograms` ya tenga un valor real.
**Commit:** `fix(stats): usar suma de kilos por factura cuando el campo resumen del expediente esta vacio`
**Estado:** ✅ Compilado y verificado — `tsc` limpio (frontend y functions), `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario. Requiere "Recalcular Indicadores" después de instalar para que el nuevo total de kilos se refleje.

### Iteración 44: "Por Recibir del Contador" mostraba $440,559.13 en vez de $427,997.50 — comisión faltante en facturas importadas por XML (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/lib/finance.ts`, `src/hooks/useDashboardStats.ts`, `functions/src/stats.ts`
**Problema:** El usuario comparó el panel "Por Recibir del Contador" contra su Excel: el bruto coincidía casi exacto ($459,703.38 vs $459,703.23), pero el neto no ($440,559.13 vs $427,997.50 esperado) — una diferencia de $12,561.63.
**Causa raíz:** Las facturas GT-570 (#5927, #5928) mostraban "-$0.00" de comisión, mientras TH-680 y GT-535 sí mostraban ~6.9% correctamente. El código lee `inv.financials.commission` como un valor **guardado** (snapshot), no calculado — para facturas capturadas vía XML (como estas dos), ese campo nunca se llenó, quedando en $0 aunque la comisión real siga aplicando. La diferencia calculada ($12,561.63) coincide con la comisión que faltaba exactamente en esas dos facturas.
**Solución:** (1) Del lado del cliente, cuando el valor guardado es 0/falta, ahora se calcula en vivo con la tasa de comisión configurada. (2) Se encontró el mismo patrón sin respaldo, sin corregir, en **el cálculo del servidor** (`functions/src/stats.ts`, afecta `porRecibir` y `gananciaRealizada` para TODO el sistema, no solo este panel) — corregido con la misma logica de respaldo, usando la tasa estándar (6.9%) ya que ese archivo no tiene acceso directo a la configuración dinámica en ese punto (mismo patrón que ya usaba el archivo para el costo por kilo, con `|| 42` como respaldo).
**Riesgo:** 🟡 Medio — toca calculos financieros del servidor. Mitigado: el respaldo solo se activa cuando el valor guardado es exactamente 0/falta, nunca sobreescribe una comisión personalizada real ya capturada.
**Commit:** `fix(comision): calcular comision en vivo cuando el valor guardado falta, en cliente y servidor`
**Estado:** ✅ Compilado y verificado — `tsc` limpio (frontend y funciones), `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 45: Tarjeta "Por Recibir del Contador" rediseñada — flujo en 3 pasos, claro para cualquiera (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/pages/Dashboard.tsx`
**Contexto:** El usuario preguntó cuál de las dos cifras usar ($459,703.23 bruto vs $427,997.50 neto) y pidió que el sistema lo mostrara claro, para que hasta su socio lo entendiera sin explicación. La cifra correcta ya era la neta (confirmado: eso es lo que de verdad entra a Caja), pero la tarjeta solo mostraba el resultado final sin explicar de dónde salía.
**Solución:** La tarjeta ahora muestra el flujo completo en 3 pasos, visualmente: **Cobrado por el cliente** (bruto) → **− Comisión del contador** → **= Esto es lo que entra a tu Caja** (neto) — como una especie de recibo simple, en vez de una sola cifra sin contexto.
**Riesgo:** 🟢 Bajo — solo visual, no cambia ningún cálculo (que ya estaba correcto).
**Commit:** `feat(Dashboard): flujo de 3 pasos en la tarjeta Por Recibir del Contador`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 44: 🔴 El registro de compra tomaba el proveedor del texto de la OC (a veces el propio negocio del usuario) en vez del proveedor real de material (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/useOrderActions.ts`, `src/components/OrderModal/index.tsx`, `src/components/Compras/OrderModals.tsx`
**Contexto:** El usuario aclaró el modelo de negocio: Providencia le hace órdenes de compra a "Elemental Denim" (el propio negocio del usuario, el comercializador), y el usuario a su vez consigue el material con **Andrés** (el proveedor real). El campo "Proveedor" del expediente, cuando se llena pegando el texto de una OC, termina con el nombre que aparece en ese documento (a veces "Elemental Denim", el propio negocio del usuario) — no con quien realmente entrega el material.
**Impacto confirmado con datos reales:** el registro de compra creado automáticamente al guardar el expediente 71/14014 quedó con proveedor "N0342 - ELEMENTAL DENIM" en vez de "Andrés" — invisible en todas las pantallas de Compras (que filtran por "Andrés"), y excluido del cálculo de "Estado con Andrés".
**Solución:** Los dos lugares que crean/actualizan el registro de compra automáticamente ahora usan siempre el **proveedor real configurado en Centro de Control** ("Nombre del Proveedor/Fabricante"), sin importar qué diga el campo "Proveedor" del expediente individual.
**Corrección del dato ya existente:** con este código desplegado, basta con volver a abrir el expediente 71/14014 y guardar (sin cambiar nada más) — el sistema corrige automáticamente el proveedor del registro de compra asociado, sin necesitar edición manual.
**Además, corregido en esta sesión (config):** "Deuda Histórica Inicial con Andrés" se ajustó de -$123,175.56 a **+$21,824.44**, verificado con el propio cálculo del usuario: $124,494.72 (2,964.16 kg × $42) − $21,824.44 = $102,670.28, coincidiendo con el saldo real. Confirmado en pantalla: "Estado de Cuenta: +$21,824.44".
**Riesgo:** 🟡 Medio — toca la creación del registro de compra automático, usado en dos flujos distintos (guardar expediente y registrar entrega desde Compras). Mitigado: el cambio es un cambio de fuente de dato (qué proveedor usar), no de lógica de cálculo.
**Commit:** `fix(compras): usar el proveedor real configurado (Andres) en vez del proveedor del expediente para el registro de compra automatico`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario. El ajuste de configuración (+$21,824.44) SÍ ya se guardó en vivo, confirmado en pantalla.

### Iteración 45: 🔴 El número real de OC nunca se guardaba — el sistema solo capturaba el folio interno (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/TabProductos.tsx`, `src/components/OrderModal/TabResumen.tsx`, `src/components/OrderModal/useOrderActions.ts`
**Contexto:** El usuario insistió en que OC (ej. `120267114014`) y Contrarecibo (`TH-xxx`/`GT-xxx`) son documentos distintos y no deben confundirse. Se verificó el expediente 71/14014 recién creado directamente en Firestore: el campo `oc` **no existe en absoluto** en el documento — solo se guardó el folio interno corto.
**Causa raíz encontrada:** "Pegar Texto de OC" SÍ detecta ambos números en el texto (`No. Ord. de Compra: 71/14014` y `CDB OC: 120267114014`), pero el código solo capturaba **uno de los dos** — el primero que coincidiera — descartando el otro por completo, porque usaba `if (!newFolio) { ... else if ... }` en vez de capturar los dos de forma independiente. Además, **no existía ningún campo visible en la pantalla** donde ver o corregir el número de OC a mano, y aunque hubiera existido, **el guardado tampoco incluía ese campo** en el objeto que se escribe a Firestore — tres fallas en cadena para el mismo dato.
**Solución:**
1. El parser ahora captura Folio y OC como dos valores independientes, cada uno en su propio campo.
2. Se agregó un campo visible y editable **"Número de OC (Orden de Compra)"** en la pestaña Resumen, junto a Folio — para poder verlo y corregirlo a mano cuando haga falta.
3. El guardado ahora sí incluye el campo `oc` (con el mismo cuidado de omitirlo si viene vacío, para no repetir el bug de `undefined` corregido antes).
**Riesgo:** 🟢 Bajo — agrega un campo nuevo, no modifica ningún dato existente.
**Commit:** `fix(OrderModal): capturar y guardar el numero real de OC por separado del folio interno`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 46: Panel "Con el Contador" — duplicados reales confirmados; detección visual de duplicados; totales por columna; cursor corregido (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Cobranza/TableroKanban.tsx`
**Problema #1 — Expedientes duplicados:** Confirmado con evidencia directa de Firestore: **son dos expedientes reales y distintos** (`QMjuMVzzM3rPPchXlgZC`, folio "PED-OC-HIST", y `cTpSirJD5iv2lx56X4BB`, sin folio), ambos con las mismas facturas 5927/5928 — de la migración original, no un bug de la pantalla. La pantalla mostraba correctamente lo que existe en la base de datos.
**Problema #2 — Dificultad para entrar a los expedientes:** el cursor de las tarjetas decía `grab` (solo sugiere "arrastrar"), aunque el clic ya abría el expediente correctamente — confundía sobre cómo interactuar. Cambiado a `pointer`.
**Mejoras agregadas:**
- **Detección automática de posibles duplicados**: cualquier tarjeta que comparta el mismo número de Contrarecibo con otra en la misma columna ahora se marca con un borde ámbar y una etiqueta "⚠️ Posible duplicado" — para que el usuario los detecte de un vistazo, sin depender de que yo los busque a mano cada vez.
- **Total en dinero por columna**, no solo el conteo — cada columna del tablero ahora muestra "Total: $X" debajo del encabezado.
**Riesgo:** 🟢 Bajo — mejoras visuales y de detección, de solo lectura; no borra ni modifica ningún dato.
**Pendiente de confirmación del usuario:** cuál de los dos expedientes duplicados (5927/5928) debe conservarse — no se borró ninguno sin su autorización explícita.
**Commit:** `feat(TableroKanban): deteccion visual de duplicados, totales por columna, cursor corregido`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 45: Sin protección contra duplicar CR, número de Factura, ni número de OC (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OrderModal/TabFacturas.tsx`, `src/components/OrderModal/useOrderActions.ts`
**Pregunta del usuario:** si el sistema evita duplicar contrarecibos, OC y facturas, y si es posible que una OC se facture con varias facturas.
**Respuesta verificada en el código, no supuesta:**
- El modelo de datos **ya soporta** que un expediente tenga varias facturas (`invoices: Invoice[]`) — es como ya funciona la OC-71-14014 en la práctica.
- Solo existía verificación de duplicados para el **folio interno** del expediente. **No existía ninguna** para el número de Contrarecibo, el número de Factura, ni el número real de OC — así fue exactamente como "333333" se pudo colar en un campo de CR sin ningún aviso.
**Solución:** Se agregó la misma verificación (avisa con confirmación, no bloquea — para no estorbar casos legítimos donde el usuario sabe lo que hace) en los tres campos: Contrarecibo, Folio de Factura, y número de OC. Cada uno revisa contra **todos los expedientes del sistema**, no solo el actual.
**Riesgo:** 🟢 Bajo — son avisos adicionales antes de guardar, no cambian ningún cálculo ni bloquean ningún caso real.
**Commit:** `feat(OrderModal): avisar si se repite un numero de Contrarecibo, Factura, u OC entre expedientes`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 46: Tablero Kanban para Logística de Entregas — completa la trilogía visual (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/OcTracking/EntregasKanban.tsx` (nuevo), `src/pages/OcTracking.tsx`
**Contexto:** Tercer y último tablero de la trilogía visual (Compras → Entregas → Cobranza), a petición del usuario, completando el mismo lenguaje visual en los tres módulos que siguen el flujo real de negocio.
**Columnas (todo el ciclo, de punta a punta):**
- 📋 **Pedido** — sin nada entregado
- 🚚 **En Camino** — entrega parcial
- 📦 **Entregado — Sin Facturar** — 100% entregado, falta facturar
- 🧾 **Facturado — Por Cobrar** — facturado, pendiente de cobro
- ✅ **Cobrado** — ciclo completo
**Nota de calidad:** se encontró y corrigió un error de lógica propio antes de terminar — una de las columnas ("En Camino") nunca se hubiera alcanzado por el orden de las condiciones (código muerto), detectado en revisión antes de dar por completa la tarea.
**Integración:** Botón "Lista / Tablero" junto a los botones existentes de Compartir/Imprimir — no reemplaza la vista actual, se alterna. Reutiliza el mismo `OrderModal` al hacer clic en una tarjeta.
**Riesgo:** 🟢 Bajo — vista nueva, de solo lectura.
**Commit:** `feat(OcTracking): tablero Kanban para Logistica de Entregas`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.

### Iteración 47: 🔴 Expedientes completamente cobrados desaparecían del tablero Kanban de Expedientes (COMPLETADO, sin desplegar)
**Fecha:** 2026-08-04
**Archivo:** `src/components/Orders/KanbanBoard.tsx`
**Contexto:** El usuario pidió revisar también Expedientes & Ventas. Se encontró que **ya existe** un tablero Kanban bien construido, con columnas por estado real de negocio (no genérico) — no necesitaba reconstruirse, solo auditarse.
**Bug encontrado:** `OrderStatus` tiene 7 valores posibles (`pedido, facturado, pending, paid, collected, overdue, manual_review`), pero el tablero solo tenía **6 columnas** — faltaba `'collected'` (el estado final: ya cobrado y recolectado a Caja Chica). Cualquier expediente en ese estado **no tenía ninguna columna donde aparecer**, desapareciendo del tablero sin ningún aviso.
**Solución:** Se agregó la columna faltante ("✅ Cobrado y Recolectado"). De paso, se renombró la columna de `paid` de "Cobradas" a "Con el Contador" — más preciso: ese estado significa que el cliente ya pagó pero el contador todavía no entrega el efectivo, no que el dinero ya esté en Caja (eso es "collected").
**Riesgo:** 🟢 Bajo — agrega una columna, no quita ninguna.
**Commit:** `fix(KanbanBoard): agregar columna faltante para expedientes ya cobrados y recolectados`
**Estado:** ✅ Compilado y verificado — `tsc` limpio, `eslint` 0/0, 42/42 pruebas, build completo. **NO DESPLEGADO** — acumulando, a petición del usuario.
