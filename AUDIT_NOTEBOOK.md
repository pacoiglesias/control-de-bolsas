
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
