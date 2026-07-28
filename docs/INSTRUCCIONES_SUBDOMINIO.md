# Cómo conectar bolsas.cobertores.com

Para que tu aplicación cargue en tu propio subdominio de manera segura (con candado HTTPS) sigue estos pasos:

## Paso 1: Configurar en Firebase
1. Entra a tu consola de Firebase: [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Abre tu proyecto `control-de-bolsas`.
3. En el menú de la izquierda, entra a **Hosting**.
4. Haz clic en el botón **"Add custom domain"** (Agregar dominio personalizado).
5. Escribe tu subdominio exactamente así: `bolsas.cobertores.com` y dale continuar.
6. Firebase te proporcionará unos registros DNS (usualmente un **TXT** para verificar propiedad y luego uno o dos **A** records con direcciones IP, ej. `199.36.158.100`). **No cierres esta ventana.**

## Paso 2: Configurar en tu Proveedor (GoDaddy, Hostgator, Cloudflare, etc)
1. Entra al panel de control donde compraste o administras el dominio `cobertores.com`.
2. Ve a la sección de **"DNS"** o **"Administración de Zona DNS"**.
3. Haz clic en **Agregar nuevo registro** (Add Record).
4. Crea el registro según lo que te pidió Firebase:
   - **Tipo:** `A` (o el que te pida Firebase)
   - **Nombre / Host / Alias:** `bolsas`
   - **Valor / Apunta a / Data:** *(Pega la dirección IP que te dio Firebase)*
   - **TTL:** Déjalo en Automático, o 1/2 hora.
5. Guarda los cambios. *(Si Firebase te pide primero un TXT, haz el mismo proceso pero eligiendo Tipo TXT).*

## Paso 3: Esperar
- En la consola de Firebase dale clic a "Finalizar" o "Verificar".
- A veces el internet tarda desde 5 minutos hasta un par de horas en esparcir la nueva regla por el mundo (se llama propagación DNS). 
- Firebase dirá "Pending" por un rato. Cuando termine, te pondrá el certificado de seguridad verde automáticamente y podrás entrar a `https://bolsas.cobertores.com`.

> [!NOTE]
> Esto es 100% independiente. Modificar o agregar este registro `bolsas` **no va a tocar, dañar ni alentar** a `www.cobertores.com` ni a `ventas.cobertores.com`. Son carriles de autopista distintos.
