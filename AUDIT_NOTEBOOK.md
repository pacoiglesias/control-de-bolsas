# 📓 AUDIT NOTEBOOK — Control Bolsas ERP

Este documento es la bitácora viva de la Auditoría de Automejora Continua del sistema Control Bolsas ERP. Cada hallazgo, optimización, parche de seguridad y refactorización queda registrado aquí con fecha, archivo afectado, diagnóstico y resolución.

**Leyenda de estados:** ✅ Resuelto · 🔧 En curso · 🔴 Pendiente (detectado, sin corregir) · ↩️ Regresión (se resolvió antes y volvió)

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
