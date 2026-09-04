# Informe Analítico de Auditoría — ERP Control Bolsas
**Fecha:** 3 de septiembre de 2026
**Contexto operativo confirmado:** sistema de bajo volumen (≈10 facturas/mes). Este dato reordena las prioridades frente a una auditoría genérica de "escala Enterprise" — se explica en cada sección dónde cambia y por qué.

---

## Cómo leer este informe

Cada hallazgo tiene la misma estructura: **qué encontré → por qué pasa (causa raíz) → qué tan grave es en tu escala real → qué hacer**. No es una lista de "buenas prácticas genéricas" — cada punto está anclado a un archivo y, donde fue posible, a una línea de código o a un documento real que me compartiste.

Archivos leídos a fondo para este informe: `firestore.rules`, `storage.rules`, `functions/src/index.ts`, `functions/src/ai/extractor.ts`, `functions/src/handlers/uploadProcessing.ts`, `src/context/OrdersContext.tsx`, `src/lib/finance.ts`, `src/lib/auditEngine.ts`, `src/lib/autoHealEngine.ts`, `src/lib/bankReceiptParser.ts`, `src/components/GenAIReader.tsx`, `src/components/MigrationTools.tsx`, `src/components/QuickCrModal.tsx`, `src/pages/ControlCenter.tsx`, `src/hooks/*`, estructura completa de `src/pages`, `src/lib` y `src/components`, más toda la documentación en `docs/`.
No leídos a fondo (quedan como siguiente paso, sección 7): `src/pages/OcTracking.tsx`, `src/pages/AuditSync.tsx`, `src/pages/Settings.tsx`, `functions/src/handlers/maquilaPortal.ts`, `functions/src/stats.ts`, la mayoría de `src/components/*`.

---

## 1. El hallazgo más importante: un patrón, no un bug suelto

Encontré la misma anomalía **tres veces, en tres archivos distintos**, cada vez con más consecuencia que la anterior. Vale la pena verlo como *un solo problema estructural* en vez de tres bugs separados, porque la causa raíz es la misma decisión de diseño repetida.

### 1.1 `src/context/OrdersContext.tsx` — datos reales hardcodeados en el hook de lectura
Dentro de la suscripción que alimenta las nueve pantallas del sistema, hay bloques de +200 líneas que, para folios específicos (`120267114114`, `12026439713`), **reemplazan en cada render** los items, entregas, facturas y montos con valores literales escritos en el código: montos exactos, UUIDs de CFDI, fechas.
- **Causa raíz:** en algún momento esos dos expedientes tenían datos corruptos o duplicados en Firestore, y en vez de corregirlos en la base de datos, se corrigieron "a la salida" — interceptando la lectura y forzando el valor correcto en memoria.
- **Efecto colateral verificado en esta misma sesión:** el contrarecibo **GT-874 / factura 6193** que me compartiste como documento real hoy coincide exactamente con el valor hardcodeado. Es decir, ahora mismo no hay conflicto — pero el día que ese dato cambie legítimamente (Providencia corrige un monto, se detecta un error real), **la corrección hecha desde la interfaz se revertirá sola en la próxima recarga**, porque el código la vuelve a sobreescribir. Nadie va a entender por qué "no se guardó el cambio".

### 1.2 `src/lib/auditEngine.ts` — el motor de auditoría "detecta" un número mágico
La función `runContinuousAutoAudit` (el motor que calcula el score de salud del sistema) contiene esto literalmente:
```ts
const rawHist = typeof cfg.historicalDebtAndres === 'number' ? cfg.historicalDebtAndres : 103411.84;
const histDebt = (rawHist > 500000 || Math.abs(rawHist - 1227839.35) < 10) ? 103411.84 : rawHist;
```
Traducido: *"si el saldo histórico de Andrés (el maquilador) es mayor a $500,000, o es específicamente $1,227,839.35, ignóralo y usa $103,411.84 en su lugar."* Y además genera una alerta visible ("✅ Saldo auto-corregido") felicitándose de haberlo hecho.
- **Causa raíz:** en algún punto el cálculo crudo (`totalPagado − totalPurchasesCost`) dio un resultado erróneo de $1,227,839.35 por un bug ya corregido, y en vez de arreglar el cálculo o migrar el dato una sola vez, se dejó una regla permanente que **fuerza cualquier saldo futuro que se parezca a ese error viejo, o que simplemente sea "muy grande", de vuelta a un número fijo del pasado.**
- **Por qué es más grave que 1.1:** esto no es una corrección de datos de lectura — es un **motor de auditoría que decide qué es "correcto" comparando contra un número codificado**, no contra una regla de negocio real. Si en un futuro el saldo real y legítimo con Andrés efectivamente supera $500,000 (por ejemplo, un mes con mucho volumen y pagos pendientes), el sistema que se supone debe **avisarte de anomalías** te va a decir, incorrectamente, que todo está bien y que "ya se corrigió solo".

### 1.3 `src/lib/autoHealEngine.ts` — una función que **reescribe la base de datos real** con un snapshot congelado
Esta es la más seria de las tres. `autoHealAndPurgeErpDatabase()`:
- Contiene un arreglo `OFFICIAL_ACTIVE_CRS` con **8 contrarecibos completos** (folios, kilos, montos, fechas de emisión y vencimiento) codificados como constante, con fecha de corte visible en los datos (el más reciente es del 24 de agosto de 2026).
- Cuando se ejecuta, hace un `writeBatch` real contra Firestore: **inyecta esos 8 documentos** (con `merge: true`, excluyendo `status`/`creditCycle`/`invoices`/`collection` del nivel raíz para no pisar lo que ya esté cobrado) y **sobreescribe `config/financials.historicalDebtAndres` a $103,411.84 sin condición.**
- **Por qué importa incluso a tu escala pequeña:** esta función es una fotografía de tu contabilidad tomada en un momento específico, convertida en código. Si alguien la ejecuta hoy (3 de septiembre) pensando que es una herramienta de "limpieza" o "sanación" genérica —el nombre de la función lo sugiere fuertemente— **va a reescribir 8 expedientes reales con datos de hace más de una semana** y **va a resetear el saldo de Andrés a un número que ya puede no ser el correcto**, sin preguntar y sin forma fácil de deshacerlo salvo restaurando un respaldo.
- **Confirmé además** que no vive sola: `src/components/MigrationTools.tsx` es una herramienta hermana, con un botón real en la interfaz ("⚠️ EJECUTAR MIGRACIÓN REAL") que mueve facturas completas de `purchaseOrders` a una colección `invoices` nueva, con `writeBatch` directo. Tiene protección de confirmación (`confirmDialog`) — mejor que `autoHealEngine.ts`, que no vi que tenga ninguna. **No confirmé si `autoHealAndPurgeErpDatabase` tiene un botón visible en Settings.tsx** (no llegué a leer ese archivo a fondo); es el primer punto que verificaría si fuera tú.

### La lectura de conjunto
No es que el sistema tenga "código de mala calidad" en el sentido usual. Es que, cada vez que apareció un dato corrupto real, la solución fue **escribir una excepción permanente en el código para ese caso puntual**, en vez de corregir el dato una sola vez en Firestore y borrar la excepción. Con 10 facturas al mes, cada expediente pesa mucho — exactamente el tipo de sistema donde este patrón es más peligroso, no menos: cuando algo no cuadre dentro de 3 meses, vas a perder tiempo buscando el error en tus datos cuando en realidad el error está en una condición `if` de hace semanas que ya nadie recuerda.

**Recomendación concreta y única para las tres:** hacer un solo barrido — localizar cada número/folio hardcodeado de este tipo en el código (`OrdersContext.tsx`, `auditEngine.ts`, `autoHealEngine.ts`, y confirmar si hay más en `Settings.tsx` o `Compras.tsx`), verificar contra Firestore que el valor hardcodeado y el valor real ya coincidan, escribir el valor correcto directamente en Firestore si no coincide, y **borrar la excepción del código**. Es trabajo de una sola sesión, no un rediseño.

---

## 2. Seguridad — sólido en lo estructural, con huecos puntuales

### 2.1 Lo que está bien (para que quede constancia clara)
Las reglas de `firestore.rules` y `storage.rules` no son plantillas genéricas — corrigen amenazas reales y las documentan: dominios completos con admin automático e irrevocable, sesiones anónimas inyectando entregas falsas sin PIN, el PIN del portal maquilador filtrándose por vivir en un documento público. La verificación de `email_verified`, el saneamiento server-side (`sanitizePurchaseOrder`) y la bitácora append-only con verificación de identidad y `serverTimestamp()` son decisiones correctas y ya están hechas.

### 2.2 Falta validación de esquema en la entrada de IA (P1)
`functions/src/ai/extractor.ts` (`extractDocumentData`) llama a Gemini, pide un JSON con `responseSchema`, y hace `JSON.parse(response.text)` **sin ninguna validación posterior** antes de devolverlo al cliente o escribirlo en Firestore. La documentación (`SISTEMA_ACTUAL.md`) afirma explícitamente que existe *"validación de Zod en `functions/src/index.ts`"* — no encontré Zod en ningún archivo de `functions/src` que revisé.
- **Impacto real:** si Gemini devuelve, por ejemplo, `total: "cuarenta y tres mil"` en vez de un número (los modelos de lenguaje ocasionalmente "narran" en vez de devolver el tipo exacto pedido, sobre todo con documentos de mala calidad de escaneo), ese valor entra tal cual al expediente. Mitigado parcialmente porque todo PDF vía `parseUploadedPDF` cae en `creditCycle.status = "manual_review"` y un humano lo revisa antes de facturar — es una buena red de seguridad ya existente — pero **la revisión humana confía en que los campos al menos tengan el tipo correcto para mostrarse bien en la interfaz**, y hoy nada lo garantiza.
- **Recomendación:** una validación mínima con Zod (o incluso a mano, 15 líneas) de tipos antes de escribir el documento: `total` y `subtotal` deben ser `number` finito, `conceptos` debe ser arreglo, etc. Si falla, cae al mismo camino de "expediente vacío en revisión manual" que ya existe para cuando la IA falla del todo.

### 2.3 Confirmar el alcance de `autoHealAndPurgeErpDatabase` y `MigrationTools` (P0 operativo, no técnico)
Ligado a la sección 1.3: antes de seguir usando el sistema día a día, vale la pena que confirmes **quién puede ver y ejecutar** estas dos herramientas (¿viven detrás del rol `admin` únicamente? ¿están en una pestaña visible o hay que navegar directo a una ruta?). No es una vulnerabilidad de "hacker externo" — es un riesgo de **error humano con un botón etiquetado de forma optimista** ("Herramienta de Sanación", "Migración de Facturas").

---

## 3. Procesamiento de documentos — validado contra tus documentos reales

Esto lo probé directamente con los 4 documentos que me compartiste antes, cruzándolos contra el código real de ingestión:

| Documento | Ruta de entrada | ¿Se procesa? | Detalle |
|---|---|---|---|
| OC PDF (43/9753) | `GenAIReader` → `parseDocumentData` (Gemini) o Storage → `parseUploadedPDF` | ✅ Sí | Formato reconocido; el prompt de extracción está literalmente calibrado con folios de este mismo formato (`12026439713`, `120267114114` como ejemplos en las instrucciones al modelo). |
| Comprobantes BBVA Net Cash (2 PDFs) | Existe `src/lib/bankReceiptParser.ts`, calibrado con este layout exacto | ✅ Sí, con límite conocido | El parser reconoce el formato con precisión (hasta tiene "GRUPO TEXTIL PROVIDENCIA" / "ELEMENTAL DENIM" como valores por defecto, señal de que se construyó con este documento en mente). **Límite real:** el comprobante bancario no trae número de factura ni de CR — el sistema puede leer monto/fecha/cuentas, pero **no puede vincular automáticamente el pago a una factura concreta.** Eso se captura a mano. |
| Dos "Ver contrarecibo" (HTML de Providencia) | — | ❌ No, tal cual | Ni `GenAIReader` (solo acepta `application/pdf`, `image/jpeg`, `image/png`) ni `storage.rules` (solo `application/pdf`, `application/xml`, `text/xml`) aceptan `.html`. **Camino real:** imprimir a PDF antes de subir, o capturar a mano con `QuickCrModal` (ya existe en la interfaz, con detección de duplicados vía `findDuplicateContrarecibo`). |

### 3.1 Hallazgo adicional al revisar el prompt de extracción (P2, informativo)
El esquema que le pides a Gemini (`extractDocumentData`) sí incluye un campo `tipoDocumento` que puede valer `contrarecibo` o `remision`, no solo `orden_compra`/`factura` — es decir, **el modelo de IA ya sabe clasificar esos dos tipos de documento**. Lo que no confirmé (no llegué a leer `OrderModal` ni el flujo de `GenAIReader.onDataExtracted` en detalle) es si la interfaz **hace algo útil** cuando `tipoDocumento === 'contrarecibo'` o `'remision'`, o si esas dos clasificaciones se calculan y luego se ignoran. Si se ignoran, es una mejora barata: ya tienes la clasificación gratis, solo falta la acción (autocompletar `QuickCrModal` con lo extraído, por ejemplo) — **y resolvería exactamente el hueco de la fila anterior** (subir el HTML impreso a PDF y que rellene el número de CR solo).

---

## 4. Arquitectura y escalabilidad — recalibrado a tu volumen real

Con ~10 facturas/mes, la mayoría de mis hallazgos de escalabilidad de la primera auditoría bajan de prioridad. Los dejo aquí solo para que quede registrado el razonamiento, no como pendientes urgentes:

| Hallazgo | Severidad original | Severidad real a tu escala | Por qué |
|---|---|---|---|
| Backup nocturno en 1 solo documento Firestore (límite 1 MiB) | P0 | **P2** | A ~120 facturas/año tardarías décadas en acercarte al límite. |
| `limit(1000)` sin orden determinista en `OrdersContext.tsx` | P0 | **P2** | Llegar a 1000 expedientes a este ritmo también toma décadas. |
| Todo el libro mayor viaja al navegador de cualquier `viewer` | P0 | **Pregunta de negocio, no técnica** | El volumen de datos es trivial; lo que queda es decidir si un `viewer` debería ver *todo* el histórico financiero o solo lo suyo — eso depende de quién tenga ese rol hoy. |

**Lo que no cambia de severidad pase lo que pase con el volumen** es la sección 1 completa (datos hardcodeados) — porque ese riesgo no es de volumen, es de **dónde vive la verdad**, y con pocos expedientes cada uno importa más, no menos.

### 4.1 Archivos grandes que sí vale la pena vigilar (P1)
`OcTracking.tsx` y `AuditSync.tsx` (62 KB cada uno), `Settings.tsx` (48 KB). No los audité línea por línea, pero por tamaño son casi con certeza componentes que mezclan datos, lógica y presentación. A tu escala el motivo para dividirlos no es rendimiento — es que **tú (o quien mantenga esto) eres la única persona que va a tener que re-entender ese archivo completo dentro de unos meses** para hacer un cambio pequeño. Partir por responsabilidad (como ya está bien hecho en `MaquiladorPortal*`, que sí está separado en Tab/Screen/Reports) reduce ese costo.

### 4.2 `systemChangelog.ts` (121 KB) dentro del bundle (P2)
Si este archivo es el historial de versiones convertido a datos de TypeScript para mostrarse en la UI, confirma que se carga con `import()` dinámico (lazy) y no en el bundle principal — si no, cada persona que abre el sistema descarga 121 KB de historial de cambios que probablemente nunca consulta.

---

## 5. Documentación — el riesgo silencioso

Cinco documentos, cinco números de versión distintos, todos vigentes al mismo tiempo:

| Archivo | Versión declarada |
|---|---|
| `package.json` | v9.1.0 |
| `CHANGELOG.md` (entrada más reciente) | v8.9.38 |
| `docs/SISTEMA_ACTUAL.md` | v8.9.15 |
| `README.md` | v8.7.0 |
| `docs/FICHA_TECNICA.md` | v5.7.0 |

Esto no es cosmético: tu propio `docs/SISTEMA_ACTUAL.md` incluye un "Prompt Maestro para IA" pensado explícitamente para que una IA futura entienda el sistema sin perder avances. Si esa IA lee `FICHA_TECNICA.md` primero, va a operar sobre una foto del sistema de hace varias versiones mayores (comisión al 6.9% en vez del 8% actual, por ejemplo — ambos números aparecen en distintos documentos como si fueran el valor vigente).

**Recomendación:** una sola fuente de verdad (`package.json`), y que el resto de los documentos digan "ver versión en package.json" en vez de repetir el número. Barato de hacer, alto impacto en evitar que una futura sesión de IA (o tú mismo en 6 meses) parta de una premisa incorrecta.

También noté también inconsistencia de cifras dentro del propio código: `functions/src/index.ts` tiene `costPricePerKg: 38` como default, pero un comentario en el mismo archivo dice *"2026-08-10: bajó de 47 a 43"* refiriéndose al precio de **venta**, y `docs/FICHA_TECNICA.md` usa **47** como precio de venta de ejemplo en sus fórmulas, mientras `docs/MANUAL_TECNICO_Y_ARQUITECTURA.md` usa **43**. Son documentos de ejemplo, no config real, pero refuerzan el mismo problema: nadie puede confiar en un número de estos documentos sin verificarlo contra el código.

---

## 6. Resumen priorizado (con tu escala real en mente)

### P0 — Hacer primero, no depende del volumen de datos
1. **Auditar y eliminar los tres casos de datos hardcodeados** (sección 1): `OrdersContext.tsx`, `auditEngine.ts`, `autoHealEngine.ts`. Verificar contra Firestore, corregir el dato real si hace falta, borrar la excepción del código.
2. **Confirmar el alcance real de `autoHealAndPurgeErpDatabase` y `MigrationTools`**: ¿tienen botón visible?, ¿detrás de qué rol?, ¿alguien podría ejecutarlos por error pensando que son mantenimiento rutinario?

### P1 — Recomendado, sin urgencia inmediata
3. Agregar validación mínima de tipos (Zod o manual) a la salida de `extractDocumentData` antes de persistir en Firestore.
4. Decidir si vale la pena conectar la clasificación `contrarecibo`/`remision` que el modelo de IA ya calcula, para poder subir los PDFs impresos del portal de Providencia y que autocompleten `QuickCrModal`.
5. Partir `OcTracking.tsx`, `AuditSync.tsx` y `Settings.tsx` cuando alguien tenga que tocarlos por otra razón — no como proyecto aparte.

### P2 — Cuando haya tiempo, no urgente a tu escala
6. Unificar el número de versión en un solo lugar.
7. Confirmar que `systemChangelog.ts` se cargue de forma perezosa.
8. Trocear el backup de medianoche o moverlo a Cloud Storage (previsión a largo plazo, no urgencia).
9. Ordenar de forma determinista la consulta de `purchaseOrders` (previsión a largo plazo).

---

## 7. Lo que queda pendiente de revisar (para ser honesto sobre el alcance)

No llegué a leer a fondo: `src/pages/Settings.tsx` (donde probablemente vive el botón de `autoHealAndPurgeErpDatabase`, si existe), `src/pages/OcTracking.tsx` y `AuditSync.tsx` completos, `functions/src/handlers/maquilaPortal.ts`, `functions/src/stats.ts`, y la mayoría de `src/components/`. Dado que el hallazgo #1 de este informe (datos hardcodeados) apareció en los tres archivos más distintos que audité, **el siguiente lugar lógico donde buscar más casos del mismo patrón es `Settings.tsx` y `Compras.tsx`** — ambos manejan configuración financiera y cuentas con el proveedor, que es exactamente el tipo de dato que ya vimos hardcodeado dos veces.

Si quieres, ese es el siguiente paso natural: confirmar dónde vive el botón de `autoHealAndPurgeErpDatabase` y revisar `Settings.tsx`/`Compras.tsx` en busca de más números o folios fijos en el código.
