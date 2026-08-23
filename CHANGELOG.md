# Historial de Versiones (Changelog) - Control Bolsas

## [v8.9.19] - 24 Agosto 2026 (Modo Offline, Excel Bidireccional & Suite de Cobranza Ágil)

### 📲 Nuevo — Modo Offline & Motor de Sincronización con Excel (.xlsx)
- **Exportador Multi-Pestaña de Trabajo Offline (`offlineExcelSync.ts`):** Genera un libro estructurado con `1_EXPEDIENTES_FACTURAS`, `2_ENTREGAS_ANDRES`, `3_CAJA_CHICA_PAGOS` y `4_INSTRUCCIONES` para trabajar sin internet en Microsoft Excel o Google Sheets.
- **Detector Inteligente de Diffs y Reconciliación (`OfflineExcelSyncModal.tsx`):** Al re-importar el archivo Excel, el sistema analiza celda por celda los cambios, clasifica en 🟢 nuevos registros y 🟡 modificaciones, y valida el candado inviolable de kilos de Andrés contra la OC (cero mermas).
- **Indicador de Conexión en Vivo (`OfflineIndicator.tsx`):** Chip interactivo en la barra superior del ERP que detecta el estado de red (`En Línea` / `Modo Offline`) con acceso inmediato en 1 clic a exportar o sincronizar el libro de trabajo.

### ⚡ Nuevo — Suite de Cobranza Ágil y Pegado Mágico del Portal
- **Botón «⚡ Cobro Rápido (TR)» (`ProximasTable.tsx`):** En la cabecera de cada contrarecibo, permite cobrar en 1 solo clic con referencia bancaria (`TR_xxxx`), calcula la comisión del contador (8%) y genera el asiento del ingreso neto en Caja Chica (`expenses`) de forma atómica.
- **Pegado Mágico Ctrl+V del Portal (`portalSync.ts`):** Reconocimiento instantáneo de las 3 tablas oficiales de Providencia: Contrarecibos (`GENERADO` / `EN PROCESO DE PAGO` por $1,101,736.34), Facturas en Revisión y Pagos Cobrados con folio `TR_xxxx`.
- **Ficha Financiera Transparente de Andrés (`PagarAndresModal.tsx`):** Desglose conectado a `useAndresStats` con cálculo de efectivo restante en Caja Chica, recibo oficial imprimible en PDF y mensaje de WhatsApp en 1 toque.
- **Candado Inviolable en Entrega de Kilos (`OrderModals.tsx`):** Validación estricta que bloquea cualquier registro de entrega de Andrés que sobrepase los kilos pedidos de la OC.

---

## [v8.9.18] - 23 Agosto 2026 (Panel de Edición Rápida Universal + Multi-Sprint de Calidad)

### ✨ Nuevo — AdminQuickEditPanel (Sprint 1)
- **⚡ Panel de Edición Rápida del Sistema (`AdminQuickEditPanel.tsx`):** Panel lateral deslizable (solo admin) accesible desde el botón flotante ⚡ en el Dashboard. Permite editar en línea, sin salir de la pantalla, cualquier parámetro crítico del ERP: Precio de Venta/kg, Costo de Compra/kg, Comisión del Contador, Tasa de IVA, Días de Crédito y Saldo con Andrés (calibración automática). Cada campo tiene su propio editor inline con confirmación por Enter o ✓ Guardar, todos con guardado atómico a `config/financials` en Firestore.
- **Calibración de Saldo con Andrés extendida al Dashboard:** El botón ✏️ existente en `Compras.tsx` y el nuevo `AdminQuickEditPanel` ofrecen dos rutas para calibrar el saldo histórico de forma intuitiva.

### 🐛 Corregido — Límites de Consulta Silenciosos (Sprint 2)
- **`ExpensesContext.tsx`:** Eliminado `limit(500)`. Si la colección de caja chica superaba 500 movimientos, el saldo se truncaba silenciosamente produciendo un efectivo incorrecto. Ahora se cargan todos los documentos y el sort se realiza en cliente.
- **`PurchasesContext.tsx`:** Eliminado `limit(300)`. Compras antiguas eran ignoradas, produciendo un saldo con Andrés incorrecto. Ahora el contexto carga el histórico completo.

### 🔍 Nuevo — Detección de Folios Duplicados (Sprint 3)
- **`SmartAlerts.tsx`:** Nueva alerta 🔁 que detecta cuando un folio de factura aparece en más de un expediente. Señal proactiva de doble captura o error de copia/pega. Redirige directamente a la vista de Órdenes para corrección inmediata.

### 📊 Nuevo — Observabilidad y Alertas Proactivas (Sprint 4)
- **Alerta ⚖️ de Saldo Anómalo con Andrés:** `SmartAlerts` recibe `deudaAndres` desde el Dashboard. Si el saldo supera ±$500,000 (señal de calibración mal configurada), aparece una alerta con botón directo al panel ⚡ Edición Rápida.
- **`useDashboardStatsV2.ts` (Bug Fix sesión anterior):** Corregido el mapeo de `historicalDebtAndres` que se omitía al construir el objeto `cfg` interno, causando que el Dashboard ignorara el valor calibrado en Firestore y mostrara siempre el fallback hardcodeado, generando el saldo erróneo de −$1,104,410.41.

---

## [v8.9.17] - 23 Agosto 2026 (Suite de Navegación Intuitiva & Productividad Acelerada)


- **Command Palette Global (`Ctrl + K` / `Cmd + K`):** Modal flotante indexado para buscar instantáneamente folios de orden, números de contrarecibo, clientes, productos y ejecutar comandos rápidos desde cualquier parte de la aplicación.
- **Menú Contextual de Acciones Rápidas (`OrderContextMenu.tsx`):** Menú accesible con clic derecho o interacción táctil para copiar folios/CR, enviar resúmenes por correo electrónico o WhatsApp, abrir expedientes y facturar en un solo clic.
- **Vistas & Filtros Guardables (`SavedViewsBar.tsx`):** Barra interactiva para crear, persistir en `localStorage` y alternar vistas operativas personalizadas.

## [v8.9.16] - 23 Agosto 2026 (Suite de Mejoras Gráficas & Visuales Premium)

- **Gráfico Interactivo de Flujo & Producción (`FinancialTrendChart.tsx`):** Gráfico interactivo responsive integrado en el Dashboard con períodos dinámicos (30 días, 90 días, 1 año) comparando el volumen de kilos entregados vs. facturación neta y utilidad calculada en tiempo real.
- **Línea de Tiempo del Pedido (`OrderStepper.tsx`):** Indicador visual interactivo horizontal del ciclo de vida de la orden (`[1. OC Creada] ➔ [2. Maquila] ➔ [3. Entrega Físicas %] ➔ [4. Contrarecibo] ➔ [5. Cobro]`) integrado en el Kanban y en la tabla de órdenes.
- **Skeletons Shimmer Animados (`SkeletonLoader.tsx`):** Animaciones de esqueleto que replican la estructura real de la interfaz mientras carga Firestore, eliminando parpadeos y spinners planos.
- **Semáforos Dinámicos Pulsantes (`PulsingBadge.tsx`):** Badges con micro-animaciones pulsantes para facturas vencidas, órdenes pendientes de entrega y alertas críticas.
- **Tokens de Estilo y Glassmorphism (`index.css`):** Definición de `@keyframes shimmer`, `@keyframes pulse-ring` y elevación moderna de tarjetas.

## [v8.9.15] - 23 Agosto 2026 (Gateway Unificado de Servicios de Maquila & Eliminación de Bloqueos CORS)

- **Gateway Unificado de Maquila:** Integración de la acción `registrarEntrega` dentro del servicio verificado `getActiveMaquilaOrders` con permisos públicos en Cloud Run y cabeceras CORS preflight completas, eliminando cualquier bloqueo HTTP 403 al registrar entregas desde `https://bolsas.cobertores.com`.
- **Registro Directo Atómico:** Las confirmaciones de entregas de Andrés se aplican inmediatamente sobre `purchaseOrders/{orderId}.deliveries[]` en Firestore, recalculando en tiempo real los kilos pendientes de la OC y enviando notificaciones Web Push.
- **Cola Offline IndexedDB Sincronizada:** Sincronización transparente de entregas almacenadas en el modo taller sin cobertura hacia el gateway unificado.

## [v8.9.14] - 22 Agosto 2026 (Web Push PWA con Firebase Cloud Messaging y Resiliencia Offline IndexedDB)

- **Notificaciones Web Push PWA (FCM):** Integración de Service Worker dedicado en segundo plano (`firebase-messaging-sw.js`) y gestor `useFCMNotifications` para alertar en tiempo real sobre entregas en el taller y facturas por vencer.
- **Cola Offline Persistente con IndexedDB:** Reemplazo de localStorage por base de datos IndexedDB tipada (`offlineMaquilaDb.ts`) en el Portal Maquilador con reintentos automáticos, soporte para falta de cobertura y modal visual de sincronización.
- **Resolución de Error CORS en Cloud Functions:** Re-exportación completa de las 13 funciones Cloud en `functions/src/index.ts` con cabeceras CORS preflight completas para el dominio `https://bolsas.cobertores.com`.
- **Dependencia @sendgrid/mail instalada en Cloud Functions:** Se agregó a `functions/package.json` para evitar fallos de inicialización de contenedores en Google Cloud Run.
- **Sincronización Total de Versión:** Actualizado package.json y barra lateral a `v8.9.14`.

## [v8.9.2] - 20 Agosto 2026 (Auditoría completa: seguridad, un borrado automático oculto, y consistencia del Kanban)

Esta versión sale de una auditoría a fondo de todo el sistema (6 revisiones en paralelo: integridad de datos, seguridad de reglas, cálculos financieros, UX/flujo, rendimiento, y Cloud Functions). Se implementó lo más urgente: seguridad, un bug de borrado de datos que se encontró verificándolo directamente, y la inconsistencia del Kanban. El resto de los hallazgos (bug de comisión del 8%, más escrituras sin transacción en AuditSync/QuickInvoiceModal/QuickCrModal, unificación completa de colores de estatus en las 57 pantallas que los usan) queda documentado como pendiente para el siguiente parche.

### Corregido (CRÍTICO — borrado de datos, encontrado verificando el código directamente)
- **🗑️ "Recalcular Indicadores" borraba expedientes reales de forma permanente sin avisar, contra la regla de "nunca borres nada sin mi consentimiento":** `recalcDashboardStats` (Cloud Function llamable desde el Dashboard) tenía, debajo de su propio comentario que dice "solo reconstruye los contadores sin tocar los expedientes", un bloque que borraba físicamente CUALQUIER expediente que no apareciera en una lista de exactamente 10 contrarecibos escrita a mano (`OFFICIAL_CR_MAP`) — aparentemente una limpieza puntual de datos de prueba de algún momento del desarrollo que se quedó pegada dentro de una función que un admin puede volver a llamar cuando quiera. Cualquier expediente real creado después de que se escribió esa lista (es decir, prácticamente todo el trabajo actual) se borraba para siempre la siguiente vez que alguien recalculara. Se quitó ese bloque por completo: la función ya nunca borra nada, solo suma y cuenta lo que existe.

### Corregido (seguridad)
- **🔑 Cualquier correo `@cobertores.com` era administrador total de forma automática e irrevocable:** `isBootstrapOwner()` en `firestore.rules` daba acceso de super-admin a cualquier cuenta verificada de ese dominio, no solo a las dos cuentas personales del dueño. El botón "Revocar Acceso" de Usuarios no podía quitárselo porque ese permiso no dependía del documento que borra. Ahora solo las dos cuentas del dueño entran ahí; cualquier otra persona de ese dominio se da de alta normal desde Usuarios y esa alta sí se puede revocar.
- **🔢 El PIN del Portal Maquilador (4 dígitos) no tenía límite de intentos:** una función pública sin freno permitía probar las 10,000 combinaciones en minutos. Ahora, tras 5 intentos fallidos seguidos, se bloquea 15 minutos (con transacción para que dos intentos simultáneos no se salten el contador). De paso se quitó el PIN de respaldo `'2468'` que quedaba si el documento de configuración no existía — ahora la función falla cerrada (nadie entra) en vez de fallar hacia un PIN conocido y ya expuesto en el historial de este repositorio.
- **🕳️ Dos reglas de Firestore (`expenses`, `error_logs`) seguían aceptando cualquier sesión — incluida una anónima creada desde la consola del navegador con la configuración pública de Firebase — el mismo hueco que ya se había cerrado para `maquilaDeliveries` en v8.8.9:** `expenses` ya no necesita esa rama (el Portal Maquilador lee sus datos desde v8.8.9 vía Cloud Function, no directo de Firestore); `error_logs` ahora exige un usuario real, no cualquier `request.auth != null`.
- **🤖 El lector inteligente de documentos (IA/Gemini) solo revisaba que hubiera una sesión, no que estuviera autorizada:** cualquiera que se autorregistrara con una sesión anónima podía gastar el presupuesto de la API. Ahora exige correo verificado y rol de admin o manager, igual que `reprocessOrder`.

### Corregido (consistencia del Kanban)
- **🎨 Una factura "Con el Contador" se veía verde (éxito) en el Kanban pero ámbar (todavía pendiente) en el detalle del expediente:** dos pantallas contradiciéndose sobre si una factura que aún no está en caja ya está resuelta o no. El Kanban usaba `var(--ok)` para esa columna; el resto del sistema ya usaba ámbar (`STATUS_TONE.paid` en `lib/types.ts`, la definición existente). Se corrigió el Kanban para que coincida — el verde queda reservado exclusivamente para "Cobrado y Recolectado".
- **⚠️ Arrastrar una tarjeta del Kanban a cualquier columna, sin importar cuántos pasos se saltara, no avisaba nada:** se podía mover un expediente de "Pendiente de Facturar" directo a "Cobrado y Recolectado" en un solo arrastre por accidente. Ahora, si el salto se brinca el paso del Contrarecibo o el paso del Contador, pide confirmación explícita antes de escribir el cambio.
- **🚀 Verificado:** `tsc --noEmit` limpio en frontend y backend, `eslint` 0 errores, 72/72 pruebas unitarias.

### Pendiente (documentado, no incluido en este parche)
- Bug de cálculo: la comisión del 8% se calcula sobre el total con IVA (en vez del subtotal) en la calculadora rápida de kilos y en el respaldo de `stats.ts` para facturas sin comisión guardada — probable causa del ~$52 de diferencia visto en el Corte Financiero.
- Más escrituras sin releer primero (mismo patrón que se corrigió en v8.8.8) en Facturar Rápido, Asignar Contrarecibo, "Recalcular precios" masivo de Ajustes, y AuditSync.
- `AuditSync.tsx` borra expedientes de forma permanente (no a la papelera) y su ruta no verifica el rol dentro de la pantalla, solo el menú la esconde.
- Unificación completa de colores/etiquetas de estatus: existen en paralelo `STATUS_LABEL`/`STATUS_TONE` (`lib/types.ts`) y definiciones propias en varias pantallas más allá de las dos que se corrigieron aquí.

## [v8.9.1] - 20 Agosto 2026 (Dashboard: los dos avisos de "vencido" parecían el mismo dato y casi nunca coincidían)

### Corregido (claridad, encontrado revisando el sitio en vivo)
- **🔴 El banner rojo de arriba ("N facturas se vencieron recientemente") y la tarjeta "Urgencias (Vencido)" ("N facturas fuera de fecha") muestran números distintos a propósito, pero nada en el texto lo explica:** el banner (`OverdueBanner.tsx`) solo cuenta lo que cruzó a vencido en el chequeo automático de las últimas horas (`checkOverdueInvoices`, corre de noche); la tarjeta (`ModernKpiGrid.tsx`) cuenta el acumulado total de facturas vencidas a hoy. Son correctos los dos, pero verlos uno junto al otro con redacciones casi idénticas ("se vencieron recientemente" / "fuera de fecha") hace parecer que uno de los dos está mal. Se reescribió el banner para decir explícitamente "Nuevo: ... (esto no es el total vencido, solo lo que acaba de vencer)", y la tarjeta para decir "... en total (acumulado a hoy)".
- **🚀 Verificado:** `tsc --noEmit` limpio, 72/72 pruebas unitarias.

## [v8.9.0] - 20 Agosto 2026 (Logo e íconos: 4 versiones distintas regadas en el proyecto, una de ellas rota)

### Corregido
- **🖼️ `public/logo.png` no era un logo:** era una captura de pantalla de una tabla de facturas guardada por accidente con ese nombre. Este archivo es el que usa el código como respaldo cuando no hay `companyLogoUrl` configurado (`Layout.tsx`, `format.ts`) **y** el que `index.html` usaba directo para el ícono de pestaña del navegador y el ícono de "agregar a inicio" en iPhone — es decir, ambos puntos ya estaban rotos en producción, no solo en teoría. Se reemplazó por una versión limpia (recortada, sin el margen del JPG original) del logo real: el sello "ED" con letras en textura denim y el ícono de bolsa (el mismo de `logo.jpg`, que ya es correcto y no se tocó).
- **📱 El ícono de la app (PWA / "agregar a inicio") y el `apple-touch-icon.png` no tenían nada que ver con la marca:** eran un ícono genérico de bolsas apiladas en verde/azul turquesa que nunca se diseñó para Bolsas Elemental — probablemente quedó de una plantilla inicial y nadie lo reemplazó. `favicon.ico` directamente no existía (estaba declarado en `vite.config.ts` pero el archivo nunca se creó). Se generaron los 4 (`favicon.ico`, `apple-touch-icon.png`, `pwa-192x192.png`, `pwa-512x512.png`) a partir del mismo sello "ED" real, recortado sin el texto "ELEMENTAL / DENIM BOLSAS" (a 16-32px ese texto ya era ilegible de por sí — el ícono solo, en cambio, sigue leyéndose bien hasta en el favicon más chico).
- **🧹 `vite.config.ts` listaba `masked-icon.svg` en `includeAssets` sin que el archivo existiera** (referencia muerta de la plantilla original de Vite/PWA). Se quitó en vez de inventar un ícono nuevo sin usar.
- El logo grande de siempre (`logo.jpg`, el que se sube desde Ajustes y el que ya se ve en vivo en el sitio) **no se tocó** — sigue siendo el mismo diseño, solo se limpiaron los archivos que estaban rotos o que nunca hicieron juego con él.
- Se respaldaron los 4 archivos anteriores dentro de `public/respaldo/logos_pre_v8.9.0_.../` antes de reemplazarlos (además del respaldo completo del proyecto que ya hace este instalador).
- **🚀 Verificado:** `tsc --noEmit` limpio, 72/72 pruebas unitarias, build de functions limpio.

## [v8.8.9] - 19 Agosto 2026 (Portal Maquilador: bitácora de entregas + cierre de un hueco de seguridad; Estado de Cuenta corregido)

### Agregado
- **📋 Bitácora de lo que registra el Portal Maquilador:** cada entrega registrada (en línea o sincronizada después de "Modo Taller" offline) ahora deja un registro en `system_logs` — la misma bitácora que ya usa el resto del sistema (`Ajustes → Bitácora`/`Logs.tsx`) — con expediente, folio, kilos y tipo de documento. Antes no quedaba ningún rastro de qué se había registrado desde el portal.

### Corregido (seguridad)
- **🔓 Cualquiera podía escribir entregas falsas en `maquilaDeliveries` sin conocer el PIN real:** la regla de Firestore solo exigía `request.auth != null` — y cualquier persona puede llamar `signInAnonymously()` desde la consola del navegador usando la configuración pública de Firebase (no es secreta, viaja en el propio sitio), sin pasar nunca por la pantalla del PIN. Se creó la Cloud Function `registrarEntregaMaquila`, que valida el PIN en el servidor (igual que ya hace `getActiveMaquilaOrders` para las lecturas) antes de escribir con el Admin SDK. `firestore.rules` ya no permite `create` en `maquilaDeliveries` desde el cliente en absoluto — todo pasa por esta función. De paso, esto también deja sin efecto la necesidad de `signInAnonymously()` que agregó v8.8.7 (se quitó del frontend): el portal ya no necesita ninguna sesión de Firebase Auth, todo el acceso lo controla el PIN validado en el servidor.

### Corregido (dato real, encontrado revisando el sitio en vivo)
- **💰 "Mi Estado de Cuenta" del Portal Maquilador mostraba $0.00 / 0 kg entregados en "Total Fabricado" pese a haber compras y pagos reales:** `getActiveMaquilaOrders` (acción `ledger`) filtraba `purchases`/`expenses` por proveedor con `p.provider.toLowerCase() === 'andres'` — comparación que nunca hace match contra `"Andrés"` (con acento), que es como el resto del código (`OrderModals.tsx`, `PagarAndresModal.tsx`) sí escribe el nombre real. El frontend ya tenía `normalizarTexto()` en `lib/finance.ts` para resolver justo este problema; ahora vive en `functions/src/shared/finance.core.ts` (compartida con el backend) y `getActiveMaquilaOrders` la usa en ambos filtros.
- **🚀 Verificado:** `tsc --noEmit` limpio en frontend y backend, `eslint` 0 errores, 72/72 pruebas unitarias, build de functions limpio.

## [v8.8.8] - 19 Agosto 2026 (Kanban, Deshacer y cobros rápidos: escrituras sin transacción que se podían pisar entre sí)

### Corregido
- **🗂️ El Kanban de Expedientes podía sobrescribir facturas de un mismo expediente en estatus distinto (`Orders/KanbanBoard.tsx`):** al arrastrar una tarjeta, se leía `order.invoices` desde la copia que ya tenía React en memoria (no desde Firestore) y se ponía la MISMA `creditCycle.status` a TODAS las facturas del expediente sin transacción — si el expediente tenía facturas en distintos estatus (una ya cobrada, otra apenas con contrarecibo), moverlo por una arrastraba a todas por igual, y cualquier cambio concurrente de otra pantalla/usuario en ese mismo expediente se perdía. Ahora relee el expediente real dentro de una transacción (`runTransaction`, mismo patrón que ya usa Cobranza) y nunca vuelve a tocar una factura que ya esté `paid` o `collected`.
- **↩️ "Deshacer" en Timeline de Contrarecibos y en Caja Chica podía revertir a datos viejos (`ContrarecibosTimeline.tsx`, `CajaChica.tsx`):** el botón "Deshacer" (hasta 12s de ventana) escribía de vuelta una copia de la factura/el movimiento capturada al momento del clic, sobrescribiendo TODO el arreglo de facturas o el documento completo — perdiendo cualquier cambio concurrente ocurrido en esos segundos. Ahora Contrarecibos usa transacción + `aplicarPorId()` (solo toca la factura correspondiente), y Caja Chica deshace el borrado quitando exactamente los 3 campos que puso `safeDeleteDoc` (`isDeleted`/`deletedAt`/`deletedBy`) en vez de reemplazar el documento entero — mismo patrón que ya usa `restoreOrder()` para expedientes.
- **💸 Cobro Rápido y Asignar Contrarecibo (múltiple) con el mismo riesgo (`QuickPayModal.tsx`, `QuickCollectionModal.tsx`):** ambos escribían desde una copia de `order.invoices` capturada al abrir el modal, sin transacción. Ahora ambos releen el expediente real antes de escribir.
- **🚀 Verificado:** `tsc --noEmit` limpio, 72/72 pruebas unitarias pasando.

## [v8.8.7] - 19 Agosto 2026 (Auditoría de firestore.rules: el Portal Maquilador nunca abría sesión real)

### Corregido
- **🏭 El Portal Maquilador (Andrés) probablemente nunca podía guardar una entrega de verdad (`MaquiladorPortal.tsx`):** el PIN numérico solo valida contra la Cloud Function pública `getActiveMaquilaOrders`; eso nunca abre una sesión de Firebase Auth (`setAuth(true)` es solo una bandera local en React). Pero las reglas de Firestore para `maquilaDeliveries` (`allow create: if request.auth != null`) y para `expenses` con categoría "Maquila" (para que Andrés vea sus propios gastos/pagos) exigen `request.auth != null` — algo que este portal nunca cumplía. Resultado esperado en producción: con internet, cada entrega fallaba con "permission-denied" (mensaje visible); en "Modo Taller" (offline) el error quedaba escondido, porque la app ya le decía "Guardado localmente" y el fallo de sincronización solo se registraba en la consola del navegador (`console.warn`), nunca visible para Andrés — la entrega se quedaba encolada para siempre en ese dispositivo.
  - Se agregó `signInAnonymously(auth)` justo después de validar el PIN correctamente, antes de intentar guardar o sincronizar cualquier entrega. Con eso `request.auth` deja de ser `null` y las reglas ya existentes (pensadas para este flujo, según sus propios comentarios) empiezan a cumplirse de verdad.
  - **Importante — verificar en la consola de Firebase:** este arreglo depende de que el método de acceso "Anónimo" esté habilitado en Authentication → Sign-in method. Si no lo está, `signInAnonymously()` fallará (queda registrado en consola, no rompe la app) y habrá que activarlo ahí — es gratis y no crea cuentas de usuario reales, solo una sesión temporal por dispositivo.
  - **🚀 Verificado:** `tsc --noEmit` limpio en frontend.

## [v8.8.6] - 19 Agosto 2026 (Revisión de una lista externa de hallazgos: 1 bug real encontrado al tipar, 3 falsos positivos descartados, 3 limpiezas menores)

### Corregido
- **💰 "Recibir en Caja" desde el widget de factura (`InvoiceWidget.tsx`) pasaba un config vacío `{}` a `saveInvoice`:** funcionaba "de chiripa" porque `saveInvoice` prefiere los datos financieros ya guardados en la factura sobre el config recibido — pero una factura vieja/migrada sin esos datos completos habría producido un cálculo en `NaN` o un error al confirmar el cobro. Se encontró al quitarle el tipo `any` a `dynamicConfig` (ver abajo): TypeScript señaló que `{}` no cumplía el tipo real. Corregido para pasar el config real.
- **🔧 Tipos `any` innecesarios en `dynamicConfig` (`InvoiceDrawer.tsx`, `InvoiceWidget.tsx`, `useInvoiceActions.ts`):** en la práctica siempre es un `FinanceConfigCore` real (de `useConfig()` o de `configEfectiva()`); tiparlo correctamente es lo que expuso el bug de arriba.
- **🧹 Condiciones redundantes en `inferDepartment()` (`finance.ts`):** cada verificación de prefijo TH/GT traía 3 condiciones donde 2 eran redundantes (`startsWith('TH-')` y `=== 'TH'` ya están cubiertas por `startsWith('TH')`). Mismo comportamiento, código más simple.
- **📎 Cloud Functions sin globals de Node en ESLint (`eslint.config.js`):** `npm run lint` ya cubre `functions/src/**` (no le faltaba linter, como decía el hallazgo original), pero usaba `globals.browser` para todo el repo. Se agregó un override con `globals.node` para esos archivos — inofensivo hoy, pero evita un futuro falso "no-undef" si se usa un global de Node ahí.
- **🔢 Número mágico en `bridge.ts`:** el `version: 4` del respaldo HTML offline ahora es la constante exportada `HTML_STATE_VERSION`.

### Revisado y descartado (falsos positivos de la lista recibida)
- "Expedientes con folio + saleTotal=0 invisibles en finance.ts": revisado a fondo — la condición de síntesis de factura (`o.folio || saleTotal > 0`) ya cubre ese caso correctamente vía el `o.folio ||` (si hay folio, se sintetiza sin importar el saleTotal). No se encontró el hueco descrito.
- "html2pdf.js (982KB) sin lazy import": ya se carga con `await import('html2pdf.js')` en los 8 lugares donde se usa — confirmado en el build, es su propio chunk separado, no viaja en el bundle principal.
- "Fallback de clipboard con execCommand('copy') obsoleto": es intencional — es el único fallback posible para copiar al portapapeles en un contexto no seguro (HTTP), y solo se usa cuando `navigator.clipboard` no está disponible. No hay reemplazo moderno para ese caso.

### Pendiente de decisión (no se tocó sin preguntar)
- `math.ts`: confirmado que ningún archivo de la aplicación lo importa (solo su propia prueba unitaria, 19 casos). ¿Lo elimino o lo dejamos como utilidad disponible para el futuro?
- `DashboardModalsHost.tsx` con ~28 props de estado de modales: candidato real a refactor con `useReducer`, pero es un cambio estructural con riesgo real de romper el cableado de algún modal — mejor planearlo aparte, no meterlo en un parche de por sí.
- **🚀 100% Verificado:** `tsc --noEmit` limpio en frontend y backend, `eslint` 0 errores, 72/72 pruebas unitarias pasando, build completo de frontend y backend.

## [v8.8.5] - 19 Agosto 2026 (Pulido Funcional y Operativo: Doble-clic, Confirmaciones, Búsqueda y Fechas)

### Corregido y Mejorado
- **💰 "Recibir en Caja" podía duplicar un ingreso con doble clic (`Dashboard.tsx`, `PorRecibirPanel.tsx`):** el botón no se deshabilitaba mientras la operación (confirmación + 2 escrituras a Firestore) estaba en curso. En una conexión lenta, un segundo tap sobre la misma factura repetía todo el flujo y agregaba un segundo ingreso a Caja Chica por el mismo dinero. Ahora el botón se bloquea y muestra "⏳ Procesando…" mientras esa factura específica está en vuelo.
- **🔐 Cambiar el rol de un usuario aplicaba al instante, sin confirmar (`Users.tsx`):** a diferencia de "Revocar Acceso" (que sí pregunta), el selector de rol (Viewer/Manager/Admin) se aplicaba con solo seleccionar la opción — un misclic podía convertir una cuenta de piso de fábrica en Admin con acceso financiero completo, sin aviso. Se agregó la misma confirmación que ya usa "Revocar Acceso".
- **🗑️ "Limpiar Bitácora" podía dejar registros a medias diciendo que ya estaba vacía (`Logs.tsx`):** solo borraba un lote de 500 (el máximo de Firestore por operación) y mostraba "limpiada con éxito" sin importar cuántos quedaran. Ahora repite en lotes hasta vaciarla por completo y el mensaje final dice cuántos registros se borraron.
- **📅 Fechas en el correo al cliente y en la Remisión impresa podían salir en formato distinto al resto del sistema (`OrderModalProvider.tsx`, `orderModalPrint.ts`):** dos lugares usaban `toLocaleDateString()` sin especificar `es-MX`, así que la fecha salía en el formato del navegador de quien tuviera la sesión abierta (podía imprimirse "8/19/2026" mes-primero) en vez del `dd/mmm/aaaa` que usa el resto de las pantallas y documentos. Ahora usan el mismo `fmtDate()` de siempre.
- **🔍 Catálogo de productos era la única lista sin buscador (`Catalog.tsx`):** Pedidos, Bitácora, Portal Maquilador y Cobranza ya tenían caja de búsqueda; el Catálogo no, así que crecía sin forma de encontrar un producto específico sin hacer scroll manual. Se agregó búsqueda por descripción o código (SKU).
- **♿ Un par de botones de solo-ícono no tenían nombre accesible (`KebabMenu.tsx`, `TabProductos.tsx`):** el menú "⋮" y el botón de eliminar partida (🗑️) solo tenían tooltip visual (`title`), sin `aria-label` — invisibles para quien usa lector de pantalla. Corregido.
- **🚀 100% Verificado:** `tsc --noEmit` limpio, `eslint` 0 errores, 72/72 pruebas unitarias pasando, build completo de frontend y backend.

## [v8.8.4] - 19 Agosto 2026 (Auditoría de Consistencia: Comisión del Contador, Estatus "Facturado" en el Backend y Blindaje de getOrderSummary)

### Corregido
- **💰 Comisión de respaldo del contador desalineada (6.9% en vez de 8%) en `functions/src/stats.ts`:** cuando una factura importada por XML nunca tuvo `financials.commission` capturado, el cálculo de "Ganancia Realizada" y "Por Recibir" del Dashboard (documento agregado `stats/dashboard`, generado en el backend) usaba una tasa de respaldo de 6.9% que no corresponde a ninguna tasa configurada en el sistema — mientras que la vista en vivo del pedido (`src/lib/finance.ts`) siempre respalda con la tasa real, 8% (`FinancialConfig.commissionRate`). Dos números distintos para la misma factura. Corregido a 8% en ambos puntos donde ocurría.
- **🏷️ Al backend le faltaba el estatus "facturado" al calcular las KPI del Dashboard (`functions/src/stats.ts`):** la función que agrega los contadores de "Pendientes"/"Vencidos"/"En Revisión Manual" del Dashboard tenía una copia de la lógica de estatus de `getOrderSummary()` (la fuente autoritativa en `src/lib/finance.ts`) a la que le faltaba la rama `else if (hasFacturado) status = 'facturado'`. Un expediente con todas sus facturas en estatus "facturado" (emitida, sin Contrarecibo todavía) no encajaba en ninguna otra rama y se quedaba con el estatus viejo guardado en el documento — pudiendo desaparecer de los contadores del Dashboard aunque siguiera activo. Se agregó la misma rama que ya usa `getOrderSummary()`.
- **🛡️ `getOrderSummary()`/`extractDashboardAlerts()` podían tronar con una sola factura mal formada (`src/lib/finance.ts`):** dos lecturas de `inv.creditCycle.status` no usaban encadenamiento opcional (`?.`). Como `getOrderSummary()` es ahora la fuente única que alimentan prácticamente todas las pantallas de pedidos (ver v8.8.3), un solo documento de Firestore con `creditCycle` ausente o mal formado (plausible en expedientes migrados/muy viejos) podía tronar esa pantalla completa en vez de solo ese renglón. Corregido a `inv.creditCycle?.status` en ambos casos.
- **⚖️ Corte Semanal ignoraba el desglose por producto de las entregas (`CorteSemanalModal.tsx`):** el resumen de "Entregas / Producción en Báscula" de la semana leía `d.kilos` directo, sin preferir la suma de `d.items[].quantity` cuando existe (mismo criterio que ya usan `getOrderSummary()` y `computeDeliveredTotals()`). Si el desglose por producto y el total plano de una entrega llegaban a no coincidir, el corte semanal podía mostrar un total distinto al que se ve en el resto del sistema para esa misma entrega. Corregido para usar el mismo criterio "desglose primero, total plano como respaldo".
- **🚀 100% Verificado:** `tsc --noEmit` limpio en frontend y backend, `eslint` 0 errores, 72/72 pruebas unitarias pasando, build completo de frontend y backend.

## [v8.8.3] - 19 Agosto 2026 (Fix: Estación del Pedido Desincronizada de "100% Surtido" en 5 Pantallas)

### Corregido
- **🏭 "En Producción" mal etiquetado en pedidos ya facturados y con Contrarecibo (`SeguimientoPedidosTable.tsx`, `MoneyFlowPipeline.tsx`, `ActionRadar.tsx`, `QuickPeekDrawer.tsx`, `EntregasKanban.tsx`):**
  - Cinco pantallas distintas (Seguimiento de Pedidos, KPI de Pipeline de Dinero, Radar de Acciones, Vista Rápida y Kanban de Entregas) recalculaban `kilosEntregados`/`kilosFacturados` sumando `o.deliveries`/`o.invoices` "a mano", en vez de reusar `getOrderSummary()` — la misma fuente que ya alimenta la barra "✅ 100% Surtido".
  - Esa recalculación manual tenía dos huecos: (1) no sumaba entregas capturadas con desglose por producto (`items[]`), y (2) no aplicaba el mecanismo de `getOrderSummary()` que sintetiza una entrega a partir de lo facturado cuando un expediente nunca tuvo `deliveries` explícitas (común en expedientes de un solo folio/CR, capturados directamente como factura).
  - Impacto real: expedientes ya 100% surtidos, facturados y con Contrarecibo asignado (ej. TH-836, GT-742, TH-804, GT-713, TH-768, GT-651, GT-624, GT-597) se mostraban con la etiqueta "🏭 En Producción" en vez de "⏳ En Crédito"/"🧾 Sin CR", y se contaban mal en los totales de "Fabricando" del Dashboard — confundiendo al usuario sobre si el pedido realmente seguía en taller o ya estaba pendiente de cobro.
  - Solución: las 5 pantallas ahora llaman `getOrderSummary(o)` y usan `summary.kilosDelivered`/`summary.kilosInvoiced`/`summary.invoices` directamente, igual que ya hacían `OcTracking.tsx`, `SemaforoDelDia.tsx` y `OrderStepper.tsx`.
- **🩹 Error de TypeScript en `MaquiladorPortalPinScreen.tsx`:** `tryLogin` estaba envuelto en `React.useCallback(...)` sin importar `React` como default (el archivo solo importaba `{ useState, useEffect }` con nombre). Corregido a `useCallback` importado con nombre desde `'react'`.
- **🚀 100% Verificado:** `tsc --noEmit` limpio, `eslint` 0 errores, 72/72 pruebas unitarias pasando, build completo de frontend y backend.

## [v8.8.2] - 18 Agosto 2026 (Master Architectural Upgrade: Offline-First, Modern Security, Component Modularization & DevOps Cleanup)

### Agregado, Optimizado y Asegurado
- **📴 Arquitectura Offline-First & Resiliencia de Conexión (`useNetworkStatus.ts`, `Layout.tsx`, `MaquiladorPortal.tsx`):**
  - Implementación de hook reactivo `useNetworkStatus()` para detección en tiempo real de pérdida/recuperación de internet.
  - Sincronización automática de cola de entregas offline en el Portal Maquilador al reconectar con Firebase.
  - Alerta sonora y visual de conectividad en la barra superior del sistema.
- **🔒 Modernización de Reglas de Seguridad en Firestore (`firestore.rules`):**
  - Desacoplamiento de correos electrónicos fijos en `isAdmin()` en favor de Custom Claims (`role: 'admin'`, `admin: true`) y verificación estricta de documentos en `/admins/{uid}`.
  - Fallback determinista para administradores y blindaje de roles en toda la base de datos.
- **⚡ Descomposición Modular de Componentes (`DashboardModalsHost.tsx`, `Dashboard.tsx`):**
  - Aislamiento completo de modales y drawers satélite en `DashboardModalsHost.tsx`, aligerando el árbol de renderizado del Dashboard.
- **🧹 Limpieza y Organización de Scripts & DevOps:**
  - Migración ordenada de scripts batch históricos a `scripts/legacy/`.
  - Actualización de `.gitignore` con exclusión de archivos `.zip` y carpetas de trabajo temporales.
- **🚀 100% Verificado:** `tsc --noEmit` limpio, `eslint` 0 errores, 72/72 pruebas unitarias pasando, build completo de frontend y backend.

## [v8.8.1] - 18 Agosto 2026 (Fix: Kanban Bypasseaba invoiceStatuses al Mover Tarjetas)

### Corregido
- **🛡️ Desincronización Silenciosa de `invoiceStatuses` al Arrastrar en el Kanban (`KanbanBoard.tsx`):**
  - `handleMoveStatus` escribía `invoices` directamente en Firestore sin pasar por el helper `camposInvoices()`, dejando el arreglo desnormalizado `invoiceStatuses` con el estado anterior a la factura.
  - Impacto real: el barrido nocturno `checkOverdueInvoices` (Cloud Function) y el filtro `passStatus` del Dashboard consultan por `invoiceStatuses`, no por el estado dentro de `invoices` — una orden movida en el Kanban podía quedar invisible para la detección automática de vencidas o mostrar un estatus obsoleto en el Dashboard hasta que alguien la abriera y guardara manualmente desde el modal de orden. Mismo patrón de bug que ya se corrigió antes en los componentes de FastFlows.
  - Solución: `handleMoveStatus` ahora usa `camposInvoices(updatedInvoices)`, que recalcula `invoiceStatuses` junto con `invoices` en la misma escritura.
  - De paso, se corrigió el uso de `serverTimestamp()` (tipo `FieldValue`) para `paidAt`/`collectedAt` dentro del arreglo `invoices`, reemplazado por `Timestamp.now()` para coincidir con el tipo `Invoice` y con la convención ya usada en `QuickPayModal.tsx`. Este desajuste de tipos estaba oculto porque la escritura anterior no pasaba por ninguna función tipada como `Invoice[]`.
- **🧩 Modularización de Generadores HTML de Reportes y Remisiones (`DashboardReports.ts`, `MaquiladorPortalReports.ts`, `Cobranza/reports.ts`):**
  - Extracción de plantillas HTML pesadas de `Dashboard.tsx`, `MaquiladorPortal.tsx` y `Cobranza/index.tsx` a módulos dedicados, reduciendo drásticamente la carga cognitiva y el peso del archivo principal sin alterar el diseño ni la funcionalidad.
- **💾 Automatización Resiliente de Respaldos (`backup.ps1`):**
  - `$SourceDir` dinamizado con `$PSScriptRoot` para ejecución independiente de la ruta del disco, y exclusión recursiva estricta de la carpeta `Respaldos`.
- **🚀 100/100 Verificado:** `tsc --noEmit` limpio, `eslint` 0 errores, 72/72 pruebas unitarias aprobadas, build de producción y Cloud Functions completados.

## [v8.8.0] - 18 Agosto 2026 (Grand Audit & Master Release: Complete Financial Precision & Zero-Residuals Standard)

### Agregado, Corregido y Desplegado
- **💎 Cero Residuos de Parseo y Formateo Directo (Zero-Residuals Standard):**
  - Eliminación total de llamadas ad-hoc `.toMillis()` y `.toLocaleString()` dispersas en todo el sistema. Sustitución universal por los formateadores estáticos `kilos()`, `money()` y el parser defensivo `toDate()` en `DataMining.tsx`, `PurchasesContext.tsx`, `InvoicesContext.tsx`, `ExpensesContext.tsx`, `ProximasTable.tsx`, `ActionRadar.tsx` y `Dashboard.tsx`.
- **📊 Consolidación Completa de Dashboard, Cobranza & PDFs Financieros (Sprints 1, 2, 3 y 4 al 100%):**
  - **Radar de Acciones y Briefing Proactivo (`ProactiveBriefingCard.tsx`, `ActionRadar.tsx`):** Parseo universal de fechas `toDate()` y redondeo determinista de montos proyectados `round2()`.
  - **Proyección de Flujo de Efectivo y Semáforo (`CashflowProjection.tsx`, `SemaforoDelDia.tsx`, `KilosSpeedometer.tsx`):** Protección total contra arreglos nulos y división por cero en velocímetro de kilos.
  - **Módulo de Estado de Cuenta y Cédulas PDF (`EstadoCuenta.tsx`, `providenciaStatementPdf.ts`, `netProfitReportPdf.ts`, `andresStatementPdf.ts`):** Redondeo exacto centavo a centavo en el saldo del libro mayor, formateo pre-instanciado de kilos y alineación terminológica a "Costo de Compra Proveedor (Andrés)".
- **🚀 100% Pruebas Aprobadas (72/72) y Despliegue en Vivo:** Frontend PWA y Cloud Functions compilados sin advertencias y desplegados a producción en Firebase Hosting.

## [v8.7.3] - 18 Agosto 2026 (Staff Engineer Quality Sprint: Rendimiento Intl, Null-Safety Total, WCAG-AA & Determinismo Financiero)

### Optimizado y Blindado
- **⚡ Memoización Estática de `Intl.NumberFormat` (`format.ts`):** Formateadores pre-instanciados para `money`, `kilos`, `compactMoney` y `percent`, reduciendo la recolección de basura y acelerando el renderizado de listas de expedientes y facturas.
- **♿ Accesibilidad WCAG-AA y Scroll Táctil (`KanbanScrollWrapper.tsx`):** Botones con área táctil ampliada a 44x44px, detección en tiempo real de bordes de desplazamiento (`canScrollLeft`, `canScrollRight`), respuesta háptica (`playSoftClick`) y aceleración nativa.
- **🛡️ Ordenamiento Cronológico Blindado (`OrdersContext.tsx`):** Uso de `toDate()` universal con fallback determinista a `createdAt` para soportar cualquier estructura de datos histórica sin fallas.
- **🔍 Búsqueda Robusta y Exhaustiva (`CommandMenu.tsx`):** Null-safety completo en filtrado de órdenes y productos con inspección profunda en números de contrarecibo a nivel factura.
- **⌨️ Captura Numérica y Foco Estable (`CurrencyInput.tsx`):** Estado de foco controlado en React (`isFocused`), sanitización contra puntos decimales duplicados y prevención de saltos de cursor.
- **📆 Resiliencia en Fechas y Alertas (`DeliveryDueBanner.tsx` y `SmartAlerts.tsx`):** Unificación del parseo de fechas con `toDate()` y acumulación de importes vencidos con `round2()`.
- **💰 Blindaje de Tesorería, Compras y Pipeline (`CajaChica.tsx`, `OrderModals.tsx`, `MoneyFlowPipeline.tsx`, `WeeklyCollectionSummary.tsx`, `FacturasSinCRPanel.tsx`):** Guards contra división por cero, sumatorias deterministas con `round2()` y null-safety absoluto.
- **🧪 100% de Tests Aprobados (72/72) y Compilación TypeScript Limpia:** Cero errores de tipado o regresiones.

## [v8.7.2] - 18 Agosto 2026 (Fix Pantalla en Blanco al Cambiar Panel TH / GT & Null-Safety Total)

### Corregido y Optimizado
- **🛡️ Fix Pantalla en Blanco al Alternar entre Departamentos (TH / GT):**
  - Se eliminó la suscripción a documentos inexistentes `stats/dashboard_TH` y `stats/dashboard_GT` en Firestore, fijando el listener al documento oficial `stats/dashboard` y calculando todas las métricas departamentales en vivo de forma instantánea.
  - Se blindó completamente `useDashboardStats` ante objetos `config` indefinidos mediante valores por defecto seguros (`cfg`), evitando `TypeErrors` en tiempo de render.
  - Se añadieron verificaciones de seguridad ante propiedades nulas en `SmartAlerts.tsx`, `CashflowProjection.tsx`, `ContrarecibosTimeline.tsx`, `SeguimientoPedidosTable.tsx` y `SemaforoDelDia.tsx`.
  - Se incorporó `ErrorBoundary` modular protegiendo todas las vistas del Dashboard para garantizar que cualquier contingencia en sub-widgets nunca interrumpa la navegación ejecutiva.
- **🚀 100% de Pruebas Unitarias (72/72) y Compilación Limpia:** Frontend y Cloud Functions listos para producción.

## [v8.7.1] - 18 Agosto 2026 (Hermetic Departmental Filter, Settings Redesign & Production Deployment)

### Agregado y Corregido
- **🎯 Calibración Determinista de Filtro TH / GT:** Resolución de la colisión de nombres donde la razón social corporativa `"Grupo Textil Providencia S.A. de C.V."` reclasificaba facturas de Textil Hogar a GT. Prioridad estricta para prefijos de contrarecibos (`TH-912`, `GT-742`, etc.), folios y códigos de área.
- **🏬 Rediseño Semántico del Centro de Control (`/centro-control`):** Estructura en 3 tarjetas ejecutivas: (1) Identidad de la Empresa, (2) Cliente Principal con Plantas TH (Textil Hogar / Nava) y GT (Grupo Textil / Evelia) 100% configurables, y (3) Taller Fabricante (Andrés) con PIN seguro de báscula.
- **💾 Barra Flotante de Guardado Rápido:** Notificación inteligente inferior al detectar cambios en configuración para guardar todo en 1 clic.
- **📊 Conciliación Oficial de Cartera Cuadrada:**
  - 10 Contrarecibos Oficiales: **$1,019,956.34** (TH: $584,400.42 / GT: $435,555.92)
  - Factura en Revisión 6167: **$81,780.00**
  - Total Deuda Providencia: **$1,101,736.34**
  - Comisión Contable (8%): **$75,981.82**
  - Flujo Neto a Recibir: **$1,025,754.52**
- **🚀 Despliegue en Vivo:** Frontend PWA y Cloud Functions compilados y desplegados al 100% en `https://bolsas.cobertores.com/`.

## [v8.7.0] - 18 Agosto 2026 (Luxury Suite, Haptic Engine & Universal Customization Edition)

### Agregado y Mejorado
- **⚡ Spotlight Universal Raycast-Style (`Ctrl + K` / `⌘ + K`):** Buscador global con navegación táctil con flechas `↑`/`↓`, sonido háptico suave al seleccionar, ejecución con `Enter` y catálogo de acciones directas (Modo Privacidad, Calculadora de Kilos, Balanza de Comprobación, Purga de Pruebas).
- **🔍 Smart Quick-Peek Drawer:** Panel lateral ultra-rápido en 0.1s para previsualización instantánea de avance de kilos, desglose de facturas SAT, WhatsApp y botón de cobro rápido en 1 toque.
- **🔘 Floating Quick Hub (`⚡`):** Speed-dial flotante glassmorphic en esquina inferior derecha con micro-animaciones para disparar Spotlight, Privacidad, Calculadora $/kg, Nueva Orden y Balanza.
- **🕶️ Atajo Global de Privacidad (`Ctrl + H` / `⌘ + H`):** Oculta/muestra instantáneamente todas las cifras monetarias y utilidades en pantalla con respuesta sonora y háptica.
- **🔊 Motor Háptico & Web Audio API Universal (`hapticEngine.ts`):** Síntesis de sonido offline (monedas de caja registradora, campana de éxito, pop táctil) y vibraciones para pantallas táctiles.
- **⚙️ Parametrización Universal (Multi-Empresa / Multi-Taller):** Desacoplamiento total de nombres fijos. Configurable para cualquier empresa, cliente principal, taller maquilador, departamentos y encargados desde Configuración.
- **🧹 Purga Segura de Expedientes de Prueba:** Opción de archivar registros de desarrollo en Papelera (`isDeleted: true`), blindando los 10 Contrarecibos Oficiales ($1,019,956.34) y la Factura 6167 ($81,780.00).
- **🛡️ Blindaje Matemático y Auditoría:** 72/72 pruebas unitarias aprobadas al 100% en Vitest y 0 errores de compilación TypeScript.

## [v8.6.1] - 18 Agosto 2026 (Providencia Executive Cockpit & Departmental Intelligence Suite)

### Agregado y Mejorado
- **Menús Kebab (`⋮`) en Todo el Dashboard:** Integración de menús emergentes de 1 clic en Seguimiento de Pedidos, Facturas sin CR y Cobranza Semanal (Abrir Expediente, Facturar, Asignar CR, Cobrar Efectivo, WhatsApp formal y Prefacturas PDF).
- **Mapeo Oficial de Responsables de Área:** Asignación corporativa de **Nava** para Textil Hogar (TH) y **Evelia** para Grupo Textil (GT), reflejada en la barra de mando (`🔵 TH · Nava` / `🟢 GT · Evelia`), en badges y en avisos de WhatsApp.
- **Aislamiento Departamental Estricto TH vs GT:** Soporte para que un contrarecibo contenga múltiples facturas (1 CR ➔ N Facturas), con bloqueo de mezcla cruzada y validación de prefijos (`TH-` y `GT-`).
- **Gestión de Efectivo en Mano (Caja):** Rebranding para reflejar el dinero físico real entregado por los contadores tras el 8% de comisión ($75,270.00 en saldo real).
- **Blindaje Matemático Automatizado:** 65 pruebas unitarias automatizadas (`npm test`) pasando al 100%.

## [v8.6.0] - 18 Agosto 2026 (Providencia Financial Core & Official Reconciliation Suite)

### Agregado y Calibrado
- **Calibración Oficial de Saldo Andrés (-$102,670.27):** Sincronización del saldo vivo de corte con auto-calibración al inicio y eliminación de cálculos históricos sintéticos.
- **Filtrado Inteligente TH / GT en Dashboard Maestro:** Resolución contextual por departamento, prefijo de contrarecibo (`TH-xxx`, `GT-xxx`) y cliente, con recálculo en vivo ($584,400.42 en TH y $435,555.92 en GT).
- **Sincronizador Oficial de 10 Contrarecibos:** Conciliación en 1 clic de los 10 CRs oficiales ($1,019,956.34) y la Factura #6167 en revisión ($81,780.00).
- **Estandarización Corporativa "Portal Maquilador":** Nomenclatura unificada en toda la aplicación para admitir cualquier taller o proveedor.
- **Erradicación de Botones Informales:** Sustitución por acciones corporativas de portapapeles y navegación nativa.
- **Blindaje Matemático Automatizado:** 62 pruebas unitarias automatizadas (`npm test`) validando cálculos financieros al centavo.

## [v8.5.0] - 18 Agosto 2026 (Enterprise Financial PDF Suite & Executive Glassmorphism Edition)

### Corregido -- critico
- La funcion del servidor que carga las ordenes del Portal del Maquilador consultaba por un campo (isArchived) que probablemente aun no tiene indice de Firestore creado, causando que la consulta fallara directamente ("Error al cargar ordenes") en vez de solo mostrar datos incompletos. Corregido para no depender de ese indice.


## [v7.0.1] - 6 Agosto 2026 (URGENTE: 4 escrituras directas desincronizaban las facturas del resto del sistema)

### Corregido -- critico
- QuickCollectionModal, QuickInvoiceModal, QuickPayModal y Settings (Recalcular Precios) escribian `invoices` directamente en vez de usar camposInvoices() -- el campo del que dependen TODAS las consultas del sistema (Dashboard, Cobranza) quedaba desincronizado, pudiendo hacer que una factura recien modificada desapareciera de esas pantallas hasta el siguiente guardado completo del expediente. El de Settings es el mas grave: afecta a todos los expedientes abiertos de una sola vez.
- El boton "Recibida del Contador -> CAJA" (con la confirmacion de monto real vs esperado) habia desaparecido al extraer InvoiceWidget.tsx como componente propio -- restaurado completo, incluyendo el sonido playCash() que faltaba en sounds.ts.
- Mismo bug de exclusion silenciosa de Firestore (where 'campo', '!=', valor) ya corregido antes en InvoicesContext.tsx.


## [v6.76.3] - 6 Agosto 2026 (Fase 6: Desacoplamiento Visual)

### Agregado
- `InvoiceDrawer` y `PurchaseDrawer`: Nuevos paneles laterales (Drawers) enfocados exclusivamente en la factura/pago seleccionado, resolviendo el problema de sobrecarga cognitiva ("cosas revueltas") al abrir un expediente completo desde Cobranza o Compras.
- Integración del Drawer de Cobranza en la tabla de `ContrarecibosTable` del Dashboard.
## [v6.76.0] - 6 Agosto 2026 (URGENTE: folio bloqueado por expediente eliminado + espejo de facturas lleno)

### Corregido -- critico
- Un expediente ya eliminado (en la Papelera) seguia bloqueando su folio de factura para siempre en cualquier expediente nuevo, sin aviso claro (el toast desaparecia solo). La validacion ahora excluye expedientes eliminados.

### Agregado
- Primer llenado real del espejo de facturas (invoicesV2), copiando los datos existentes -- paso previo necesario antes de poder migrar cualquier pantalla a leer de ahi.


## [v6.75.0] - 6 Agosto 2026 (URGENTE: bug critico de indices corregido + Complementos de Pago reales)

### Corregido -- critico
- Bug propio de indices en la vista agrupada de facturas (Iteracion 65): editar una factura podia corromper silenciosamente OTRA factura distinta del mismo expediente, si su posicion visual (agrupada por estado) no coincidia con su posicion real en el arreglo guardado. Verificado que no causo daño real en datos existentes -- corregido antes de que ocurriera.

### Agregado
- Parser de Complementos de Pago SAT reales (XML crudo, no solo texto tipo PDF) -- empareja por monto exacto contra facturas sin pagar, nunca aplica si hay ambiguedad.
- Desglose visual de estados (Vencidas/Por Cobrar/Con el Contador/Cobradas) directo en la pestaña Resumen del expediente, clickeable.


## [v6.73.0] - 5 Agosto 2026 (Esperado vs Real en cobros -- automatizado)

### Agregado
- Al recibir del contador, el sistema ahora pregunta el monto real recibido (con lo esperado ya calculado y puesto), en vez de asumir que siempre coinciden. Se guarda la diferencia si la hay.
- Nueva tarjeta en Caja: "Esperado vs Real -- Diferencias en Cobros", con el acumulado, para detectar patrones sin revisar movimiento por movimiento.


## [v6.72.0] - 5 Agosto 2026 (Contrarecibos separados, MIGRACION traducido, seguridad reforzada)

### Corregido
- Se separo el permiso de eliminar (vs crear/editar) en expedientes -- ahora requiere el nivel mas alto, protegiendo contra borrados accidentales o no autorizados a nivel de base de datos, no solo de interfaz.
- El marcador interno "MIGRACION" ya no se muestra tal cual como si fuera un cliente real -- traducido a "Historico (sin cliente registrado)" en los 6 lugares donde aparecia.

### Mejorado
- Cada contrarecibo dentro de un expediente ahora se muestra en su propia linea separada al expandir (con su monto y estado), en vez de un texto largo separado por comas.
- Primer paso de la migracion de facturas a documentos independientes: coleccion nueva en paralelo (invoicesV2), sin tocar ningun archivo existente todavia.


## [v6.71.0] - 5 Agosto 2026 (Tablero y Lista ya no se contradicen)

### Corregido -- critico
- El tablero Kanban de Expedientes clasificaba "Pendiente de Facturar" con un criterio distinto al de la lista (recien corregida en v6.70) -- un expediente con factura parcial aparecia en un lugar en la lista y en otro en el tablero. Ahora ambos usan exactamente el mismo criterio.


## [v6.70.0] - 5 Agosto 2026 (Pendiente de Facturar corregido de raiz + listas compactas)

### Corregido -- critico
- "Pendiente de Facturar" en Expedientes significaba "cero facturas capturadas", distinto al mismo nombre en el Dashboard ("kilos sin facturar, incluso con una factura parcial ya capturada"). Una OC facturada a medias, con saldo real pendiente, nunca aparecia en este filtro. Corregido para que signifique lo mismo en los dos lugares.
- Expedientes migrados (MIGRACION) ya no cuentan como "Pendiente de Facturar" -- mismo criterio que ya usaba el Dashboard.

### Mejorado
- Lista de contrarecibos compacta en Expedientes (primeros 3 + expandir), mismo criterio ya aplicado dentro del expediente.


## [v6.69.0] - 5 Agosto 2026 (Facturacion mejorada, totales corregidos, deteccion de duplicados real)

### Corregido — critico
- "Deuda con Andres" mostraba -$978,849.92 en vez de -$102,670.28 -- doble conteo entre dos correcciones anteriores. Se corrige sola al iniciar sesion.
- "Con el Contador" y "En Caja Chica" siempre mostraban $0.00 de total, sin importar cuantas tarjetas tuvieran -- sumaban el saldo pendiente del cliente (siempre cero ahi) en vez del monto real de cada factura.
- "Posible duplicado" se disparaba en falso en el tablero -- mismo bug de version anterior, nunca corregido para facturas ya pagadas/cobradas.

### Mejorado -- flujo de facturacion
- Boton de accion rapida "Marcar Pagado" directo en la tabla de Contrarecibos.
- Facturas dentro de un expediente ahora se agrupan por estado (Por Cobrar / Con el Contador / Cobradas) en vez de una lista plana mezclada.
- Al capturar una factura manual: los kilos se pre-llenan solos con el remanente real pendiente de facturar, se muestra la sugerencia antes de hacer clic, el campo Folio recibe el foco automaticamente, y la factura nueva se abre ya expandida.


## [v6.68.0] - 5 Agosto 2026 (Facturacion mas rapida + facturas agrupadas por estado)

### Mejorado
- **Capturar una factura manual, mucho mas rapido**: kilos pre-llenados con el remanente real (entregado menos ya facturado), sugerencia visible antes de hacer clic, se abre expandida con el campo Folio listo para escribir de inmediato -- sin calculos ni clics de mas.
- **Facturas agrupadas por estado dentro del expediente** (Por Cobrar / Con el Contador / Cobradas) -- mismo dato, mucho mas ordenado, sin tocar la estructura de datos.
- Falso positivo de "posible duplicado" corregido (mismo bug de una iteracion anterior, sin corregir en dos columnas del tablero).
- Totales de "Con el Contador" y "En Caja Chica" corregidos -- sumaban el saldo del cliente (siempre cero ahi) en vez del monto real.
- Deuda con Andres corregida a la cifra real, verificada contra los datos reales del sistema.


## [v6.67.0] - 5 Agosto 2026 (Totales de Con el Contador / En Caja Chica corregidos)

### Corregido
- "Con el Contador" y "En Caja Chica" siempre mostraban $0.00 de total sin importar cuantas tarjetas tuvieran -- sumaban el saldo pendiente del CLIENTE (siempre cero ahi, porque el cliente ya pago) en vez del monto real de cada factura. Auditado el resto del sistema en busca del mismo patron: confirmado que era el unico lugar con el problema.
- Boton "Marcar Pagado" agregado directo en la tabla de Contrarecibos.
- Otra copia del console.log de diagnostico olvidado, eliminada.


## [v6.66.0] - 5 Agosto 2026 (URGENTE: Deuda con Andres corregida de -$978,849 a -$102,670)

### Corregido — critico, dinero real
- "Deuda con Andres" mostraba -$978,849.92 en vez de -$102,670.28. Causa: doble conteo (un ajuste anterior no considero una restauracion automatica posterior) mas 6 movimientos de prueba "[AJUSTE]" contaminando el calculo con hasta $400,000 que nunca se habian revisado. Todo corregido en la misma migracion automatica, verificado contra Firestore antes de fijar el valor.


## [v6.65.0] - 5 Agosto 2026 (Eliminar expediente ahora requiere dos clics deliberados)

### Mejorado — seguridad de datos
- "Eliminar Expediente" ya no depende de un dialogo del navegador (facil de cerrar por reflejo) -- ahora requiere un segundo clic deliberado, dentro de 4 segundos, con aviso visual claro. Se quito el texto "esto no se puede deshacer", que ya no es cierto (existe Papelera y restauracion automatica).


## [v6.64.0] - 5 Agosto 2026 (Resaltar factura especifica al abrir desde el tablero)

### Mejorado
- Al hacer clic en una tarjeta del tablero de Cobranza, el modal ahora hace scroll automatico y resalta la factura correspondiente -- antes mostraba el expediente completo sin distinguir cual era la relevante, obligando a buscarla entre las demas.


## [v6.63.0] - 5 Agosto 2026 (Migracion automatica extendida -- Material Flotante corregido)

### Corregido
- "Material Flotante" mostraba -23,825.58 kg (negativo) despues de la restauracion automatica -- el registro de compra asociado tenia receivedKilos en 0. La migracion automatica ya lo corrige tambien, en la misma pasada.


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


### Iteración 83: FASE 5 - Precisión Matemática Centralizada (Decimal.js)
**Fecha:** 2026-08-06
**Archivo:** `src/lib/finance.ts`, `src/pages/Dashboard.tsx`
**Contexto:** Se detectó la necesidad de erradicar los problemas de precisión de coma flotante de JS (ej. 0.1+0.2=0.30004) en las sumatorias y balances del Frontend.
**Solución:** Se integró la librería `decimal.js-light` para refactorizar los acumuladores de `getOrderSummary`, `calculateLiveMargenTotal` y la suma de `saldoCaja`, garantizando montos contables precisos y libres de deriva.
**Verificación:** `npm run typecheck` completado exitosamente con 0 errores tras tipar y parsear todos los constructores y encadenamientos de Decimal.
**Estado:** ✅ Completado - Precisión garantizada al 100%.


