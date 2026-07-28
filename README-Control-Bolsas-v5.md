# Control Bolsas v5.2 — Master Track

ERP web para el control de compra, venta y cobranza de bolsa. Las órdenes de compra
se suben en PDF, una Cloud Function las lee con Gemini y el sistema calcula solo el
flujo neto, el ciclo de crédito y la cobranza.

**Stack:** React 18 + Vite + TypeScript · Firebase (Auth, Firestore, Storage, Functions 2ª gen) · Genkit + Gemini

---

## 1. Qué trae

| Módulo | Qué hace |
|---|---|
| **Login** | Correo y contraseña. Solo entra quien tenga documento en `admins/{uid}`. |
| **Panel** | Total vendido, ganancia neta, te deben, vencido, cobrado, pendientes de captura. Gráfica de vendido contra cobrado por mes (interactiva con Recharts). |
| **Subir órdenes** | Drag & drop de PDFs a Storage con barra de progreso. Cada archivo se cruza en vivo con la orden que creó la IA. |
| **Órdenes (Expedientes)** | Tabla en tiempo real con colores, filtros, totales y CSV. Clic en un renglón abre la ficha del Expediente con pestañas (Resumen, Entregas Parciales, Facturas Parciales). |
| **Cobranza** | Antigüedad de saldos por cliente (aún no vence / 1-30 / 31-60 / 61-90 / +90) y lista priorizada de qué cobrar primero. |
| **Configuración** | Edita precio de venta, costo, comisión y días de crédito en `config/financials`. Incluye recálculo masivo de órdenes abiertas. |

## 2. Reglas financieras

```
venta    = kilos × salePricePerKg
costo    = kilos × costPricePerKg
comisión = venta × commissionRate
neto     = venta − costo − comisión
```

Valores por omisión: venta $47.00/kg, costo $42.00/kg, comisión 6.9%, crédito 30 días.
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
Abre `PANEL_DE_CONTROL.bat` y elige la opción `6. Configurar Clave de Gemini AI`.
La llave se saca de <https://aistudio.google.com/apikey>.

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
| `SETUP.bat` | Instalación inicial, una sola vez. |
| `DEV.bat` | Levanta el servidor local en `localhost:5173`. |
| `INSTALL_AND_DEPLOY.bat` | Compila + respalda en git + despliega a producción. |
| `PUSH_TO_GIT.bat` | Solo el respaldo en GitHub, con mensaje de commit. |

## 5. Estructura

```
src/
  lib/        firebase.ts · types.ts · finance.ts · format.ts
  context/    AuthContext.tsx · ToastContext.tsx
  hooks/      useOrders.ts (onSnapshot) · useConfig.ts
  components/ Layout.tsx · ui.tsx
  pages/      Login · Dashboard · Upload · Orders · OrderModal · Cobranza · Settings
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

## 7. Lo que este sistema todavía no modela

El backend trabaja con una orden = un PDF = un monto. Del flujo real de tu operación quedan fuera:

- **El fabricante.** No hay compras, anticipos ni recepciones parciales, así que
  *"pedí 1,000 kg y me entregaron 900"* no se puede registrar todavía.
- **Contrarecibos como paso propio.** El campo existe en la ficha, pero el plazo de crédito
  arranca desde la emisión de la factura, no desde que el cliente acepta el contrarecibo.
- **Caja.** No hay flujo de efectivo ni saldo bancario.

Todo eso ya está resuelto en el sistema HTML v4.2. El siguiente paso natural es subir ese
modelo a Firestore: colección `pedidos` como columna vertebral y `purchaseOrders` colgando
de ella. La base de datos y las reglas ya están preparadas para crecer así.
