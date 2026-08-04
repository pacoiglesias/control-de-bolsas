
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
