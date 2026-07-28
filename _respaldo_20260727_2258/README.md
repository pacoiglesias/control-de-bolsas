# Control Bolsas v5.0 — Master Track

ERP web para el control de compra, venta y cobranza de bolsa. Las órdenes de compra
se suben en PDF, una Cloud Function las lee con Gemini y el sistema calcula solo el
flujo neto, el ciclo de crédito y la cobranza.

**Stack:** React 18 + Vite + TypeScript · Firebase (Auth, Firestore, Storage, Functions 2ª gen) · Genkit + Gemini

---

## 1. Qué trae

| Módulo | Qué hace |
|---|---|
| **Login** | Correo y contraseña. Solo entra quien tenga documento en `admins/{uid}`. |
| **Panel** | Total vendido, ganancia neta, te deben, vencido, cobrado, pendientes de captura. Gráfica de vendido contra cobrado por mes. |
| **Subir órdenes** | Drag & drop de PDFs a Storage con barra de progreso. Cada archivo se cruza en vivo con la orden que creó la IA. |
| **Órdenes** | Tabla en tiempo real con colores por estado, filtros, buscador, totales y exportación a CSV. Clic en un renglón abre la ficha editable. |
| **Cobranza** | Antigüedad de saldos por cliente (aún no vence / 1-30 / 31-60 / 61-90 / +90) y lista priorizada de qué cobrar primero. |
| **Respaldo local** | Baja tus datos metidos dentro del HTML offline, o súbelos de regreso desde el HTML. Puente en los dos sentidos. |
| **Configuración** | Edita precio de venta, costo, comisión, IVA y días de crédito en `config/financials`. Incluye recálculo masivo de órdenes abiertas. |

## 2. Reglas financieras

```
subtotal = kilos × salePricePerKg
factura  = subtotal + IVA          ← esto es lo que le cobras al cliente
costo    = kilos × costPricePerKg
comisión = (subtotal o factura) × commissionRate    según commissionBase
neto     = subtotal − costo − comisión
```

Valores por omisión: venta $47.00/kg, costo $42.00/kg, comisión 6.9% sobre el subtotal,
IVA 16%, crédito 30 días.
Viven en `config/financials` y los leen **tanto el frontend como la Cloud Function**.
La fórmula está duplicada a propósito en `src/lib/finance.ts` y en `functions/src/index.ts`:
si cambias una, cambia la otra.

Estados del ciclo: `pending` → `paid`, o `overdue` cuando el job diario detecta que se
pasó la fecha. `manual_review` es el estado de rescate cuando la IA no pudo leer el PDF.

## 3. Puesta en marcha

### Paso 1 — Crear el proyecto en Firebase
1. Crea el proyecto en <https://console.firebase.google.com>.
2. Sube el proyecto al **plan Blaze**. Cloud Functions de 2ª generación no corre en el plan gratuito.
3. Activa **Authentication → Sign-in method → Correo/contraseña**.
4. Crea la base **Firestore** (modo producción) y el bucket de **Storage**.

### Paso 2 — Ejecutar `SETUP.bat`
Instala Node, Firebase CLI y dependencias, y te abre `.env` y `.firebaserc` para que
pegues los datos de tu proyecto.

### Paso 3 — Cargar la llave de Gemini
```bat
CONFIGURAR_CLAVE_GEMINI.bat
```
Hace todo: valida el CLI, renueva la sesión si venció, selecciona el proyecto, guarda la clave
cifrada en Secret Manager y redespliega las funciones. La llave se saca de
<https://aistudio.google.com/apikey>.

**La clave nunca va en `.env` ni en ningún archivo del repositorio.** El `.env` solo lleva
variables `VITE_*`, y Vite las incrusta en el JavaScript que se descarga al navegador:
cualquiera con las herramientas de desarrollador las vería.

**Si alguna vez expones una clave** (un chat, una captura, un commit), dala de baja en AI Studio
y genera otra. Rotarla toma diez segundos; una clave filtrada consume tu cuota a tu costa.

### Paso 4 — Crear tu usuario administrador
1. Authentication → **Agregar usuario** con tu correo y contraseña.
2. Copia el **UID** que aparece en la lista.
3. Firestore → **Iniciar colección** con ID `admins`, y dentro un documento cuyo
   **ID sea ese UID**. Ponle un campo cualquiera, por ejemplo `email` (texto) con tu correo.

Sin ese documento nadie entra: es la puerta de todo el sistema, y las reglas de
Firestore y Storage la verifican del lado del servidor, no solo en la interfaz.

### Paso 5 — Desplegar
```bat
INSTALL_AND_DEPLOY.bat
```
Compila, revisa tipos, respalda en GitHub y sube hosting, funciones, reglas e índices.
Al final imprime la URL pública.

## 4. Scripts incluidos

| Archivo | Para qué |
|---|---|
| `SETUP.bat` | Instalación inicial, una sola vez. Renueva la sesión de Firebase si venció. |
| `CONFIGURAR_CLAVE_GEMINI.bat` | Guarda la clave de Gemini en Secret Manager y redespliega. Resuelve solo la sesión caducada, el proyecto y las APIs. |
| `DIAGNOSTICO.bat` | Revisa 12 puntos del entorno y te dice exactamente qué falta. Corre esto primero cuando algo falle. |
| `DEV.bat` | Levanta el servidor local en `localhost:5173`. |
| `INSTALL_AND_DEPLOY.bat` | Compila + respalda en git + despliega. Renueva la sesión solo si hace falta. |
| `PUSH_TO_GIT.bat` | Solo el respaldo en GitHub. Ya viene apuntado a `pacoiglesias/control-de-bolsas`. |

### Si aparece "Authentication Error: Your credentials are no longer valid"

Es la sesión del Firebase CLI, que caduca cada cierto tiempo. No tiene nada que ver con la
clave de Gemini ni con tu proyecto. Los scripts ya lo detectan y renuevan solos; a mano sería:

```bat
firebase login --reauth
```

## 5. Estructura

```
src/
  lib/        firebase.ts · types.ts · finance.ts · format.ts
  context/    AuthContext.tsx · ToastContext.tsx
  hooks/      useOrders.ts (onSnapshot) · useConfig.ts
  components/ Layout.tsx · ui.tsx
  pages/      Login · Dashboard · Upload · Orders · OrderModal · Cobranza · Respaldo · Settings
  lib/bridge.ts             traduccion app <-> HTML en los dos sentidos
public/respaldo/control-bolsas-offline.html   el sistema HTML completo, offline
functions/src/index.ts    parseUploadedPDF · checkOverdueInvoices · reprocessOrder
firestore.rules · storage.rules · firestore.indexes.json
```

## 6. Correcciones al backend original

Estas cinco cosas iban a fallar en producción y ya están arregladas en `functions/src/index.ts`:

1. **`defineSecret().value()` en el ámbito del módulo.** En funciones de 2ª generación el
   secreto solo está montado durante la ejecución. Al llamarlo al cargar el módulo, Genkit
   se inicializaba sin llave. Ahora `genkit()` se construye dentro del handler.
2. **Sin filtro de ruta.** `onObjectFinalized` se disparaba con *cualquier* objeto del bucket.
   Ahora solo procesa `uploads/` y solo `application/pdf`.
3. **Sin idempotencia.** Un reintento de la función creaba una orden duplicada. Ahora el ID del
   documento es un hash de la ruta del archivo, con `set(..., {merge:true})`.
4. **El fallback perdía el motivo.** `manual_review` se guardaba sin explicación. Ahora guarda
   `aiError` y la interfaz lo muestra.
5. **`checkOverdueInvoices` sin índice ni límite de lote.** La consulta compuesta necesita índice
   (ya viene en `firestore.indexes.json`) y los lotes se parten de 400 en 400 por el tope de 500
   escrituras de Firestore.

También se guardan `saleTotal`, `costTotal` y `commission` desglosados, no solo `netCashFlow`:
sin ese desglose, la pantalla de cobranza no puede saber cuánto te deben.

**Modelo de Gemini:** el código usa `googleai/gemini-2.0-flash`. Gemini 1.5 Flash está en
proceso de retiro para proyectos nuevos. Es una constante `MODEL` al inicio del archivo;
verifica en la documentación de Google cuál está vigente y cámbiala ahí.

## 7. El respaldo local en HTML (módulo 04)

El sistema HTML no se jubiló: es la red de seguridad. Vive en
`public/respaldo/control-bolsas-offline.html` y se despliega junto con la app, así que
también está en línea en `https://<tu-dominio>/respaldo/control-bolsas-offline.html`.

**De la app al HTML**

| Opción | Para qué |
|---|---|
| **Descargar HTML** | Un solo archivo con tus datos ya adentro. Doble clic y funciona sin internet: pedidos, compras al fabricante, entregas, caja, cobranza, reportes e impresión. |
| **Descargar JSON** | Para un HTML que ya usas y tiene capturas tuyas. Al abrirlo eliges **Fusionar**: actualiza lo que coincide y deja intacto lo tuyo. |
| **Guardar snapshot** | Deja el estado completo en `snapshots/latest` por si pierdes el archivo. |

**Del HTML a la app**

En el HTML: *Descargar respaldo (.json)* → en la app: *Respaldo local → Elegir archivo*.
Se unen **por folio**: lo existente se actualiza en cobranza, lo nuevo se crea, nada se borra.
Lo que la app todavía no modela (pedidos, fabricante, entregas, caja) se guarda completo en
`snapshots/fromHtml` en vez de perderse.

**Qué viaja y qué no**

- Órdenes, montos, fechas, contrarecibo y cobranza: en los dos sentidos.
- Comisión: viaja **ya calculada** y marcada como manual, para que el HTML no la recalcule con otra base y te salgan dos números distintos.
- Kilos: de la app al HTML sí; de regreso se estiman desde el importe y quedan marcados como estimados.
- PDFs: se quedan en Storage.

**Aviso sobre `file://`:** algunos navegadores bloquean el guardado local cuando abres un
archivo con doble clic. El HTML lo detecta y te lo avisa con una franja roja arriba. En Chrome
y Edge funciona; en ventana privada no. Si te topas con eso, ábrelo desde la URL de Hosting.

## 8. Alineación de fórmulas entre los dos sistemas

Había una discrepancia real: el backend calculaba la comisión sobre `kilos × 47` (sin IVA) y el
HTML sobre el importe **con** IVA. Para 3,000 kg eso son $9,729 contra $11,285.64 — casi
$1,600 de diferencia en una sola orden.

Ya quedó explícito y configurable en los dos lados:

- La app tiene `ivaRate` y `commissionBase` en Configuración, y guarda `invoiceTotal` (lo que
  realmente le cobras al cliente) además del subtotal.
- El HTML tiene **Comisión sobre importe: con IVA / sin IVA**.
- La ganancia neta se calcula sobre el **subtotal**, no sobre el total: el IVA lo cobras y lo
  enteras, no es tuyo. Meterlo en la ganancia infla el resultado.

Por omisión ambos quedaron en *subtotal*. Si contabilidad te la cobra sobre el total facturado,
cámbialo en Configuración y presiona *Recalcular órdenes abiertas*.

## 9. Lo que este sistema todavía no modela

El backend trabaja con una orden = un PDF = un monto. Del flujo real de tu operación quedan fuera:

- **El fabricante.** No hay compras, anticipos ni recepciones parciales, así que
  *"pedí 1,000 kg y me entregaron 900"* no se puede registrar todavía.
- **Contrarecibos como paso propio.** El campo existe en la ficha, pero el plazo de crédito
  arranca desde la emisión de la factura, no desde que el cliente acepta el contrarecibo.
- **Caja.** No hay flujo de efectivo ni saldo bancario.

Todo eso sí está resuelto en el HTML offline que viene incluido, y por eso el puente existe:
mientras la nube no modele el pedido completo, el HTML es donde llevas ese control. El
siguiente paso natural es subir ese modelo a Firestore: colección `pedidos` como columna
vertebral y `purchaseOrders` colgando de ella. Las reglas ya están preparadas para crecer así.

**Proyecto:** `control-de-bolsas-89c88` · **Repo:** `github.com/pacoiglesias/control-de-bolsas`
Ambos ya vienen configurados en `.firebaserc` y `PUSH_TO_GIT.bat`.
