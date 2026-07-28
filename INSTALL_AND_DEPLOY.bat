@echo off
chcp 65001 >nul
title Control Bolsas v5 - Compilar y desplegar
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo    CONTROL BOLSAS v5 - DESPLIEGUE A PRODUCCION
echo  ============================================================
echo.

if not exist ".env" (
  color 0C
  echo  [X] Falta el archivo .env. Ejecuta primero SETUP.bat
  pause & exit /b 1
)
if not exist ".firebaserc" (
  color 0C
  echo  [X] Falta .firebaserc con el ID de tu proyecto. Ejecuta SETUP.bat
  pause & exit /b 1
)

echo  [0/5] Verificando la sesion de Firebase...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [!] Tu sesion vencio. Se abrira el navegador para renovarla.
  call firebase login --reauth
  call firebase projects:list >nul 2>nul
  if errorlevel 1 ( color 0C & echo  [X] La sesion no quedo valida. & pause & exit /b 1 )
)
call firebase use control-de-bolsas-89c88 >nul 2>nul
echo  [OK] Sesion valida - proyecto control-de-bolsas-89c88

echo.
echo  [1/5] Instalando dependencias...
call npm install || goto :fallo
call npm --prefix functions install || goto :fallo

echo.
echo  [2/5] Revisando tipos de TypeScript...
call npm run typecheck || goto :fallo

echo.
echo  [3/5] Compilando el frontend...
call npm run build || goto :fallo

echo.
echo  [4/5] Respaldando en GitHub...
if exist ".git" (
  git add .
  git commit -m "deploy: %DATE% %TIME%"
  git push
  if errorlevel 1 echo  [!] No se pudo hacer push. Continuo con el despliegue.
) else (
  echo  [!] Esta carpeta todavia no es un repositorio git.
  set /p INITGIT="      Lo conecto ahora con pacoiglesias/control-de-bolsas? (s/n): "
  if /i "!INITGIT!"=="s" (
    git init
    git branch -M main
    git remote add origin https://github.com/pacoiglesias/control-de-bolsas.git
    git add .
    git commit -m "deploy inicial: %DATE%"
    git push -u origin main
    if errorlevel 1 echo  [!] No se pudo hacer push. Continuo con el despliegue.
  ) else (
    echo      Me lo salto. Usa PUSH_TO_GIT.bat cuando quieras.
  )
)

echo.
echo  [5/5] Desplegando a Firebase (hosting + functions + reglas^)...
set FALLOS=0

echo.
echo    -- Reglas e indices de Firestore --
call firebase deploy --only firestore
if errorlevel 1 (
  set /a FALLOS+=1
  echo    [X] Firestore fallo. Probablemente falta crear la base de datos.
  set "URLFIRESTORE=1"
) else ( echo    [OK] Firestore )

echo.
echo    -- Reglas de Storage --
call firebase deploy --only storage
if errorlevel 1 (
  set /a FALLOS+=1
  echo    [X] Storage fallo. Falta darle "Comenzar" en la consola.
  set "URLSTORAGE=1"
) else ( echo    [OK] Storage )

echo.
echo    -- Cloud Functions --
echo    [..] Compilando y probando que las funciones carguen antes de subirlas...
call npm --prefix functions run build
set FIREBASE_CONFIG={"projectId":"control-de-bolsas-89c88","storageBucket":"control-de-bolsas-89c88.firebasestorage.app"}
set GCLOUD_PROJECT=control-de-bolsas-89c88
pushd functions
node -e "const k=Object.keys(require('./lib/index.js')); if(!k.length) process.exit(1); console.log('    [OK] '+k.length+' funciones: '+k.join(', '));" 2>nul
set PRUEBACARGA=%ERRORLEVEL%
popd
set FIREBASE_CONFIG=
set GCLOUD_PROJECT=
if not "!PRUEBACARGA!"=="0" (
  echo    [X] Las funciones no cargan. No tiene caso subirlas asi.
  echo        Corre REPARAR_FUNCTIONS.bat
  set /a FALLOS+=1
  set "URLREPARAR=1"
  goto :saltarfunctions
)
call firebase deploy --only functions
if errorlevel 1 (
  set /a FALLOS+=1
  echo    [X] Functions fallo. Revisa plan Blaze y la clave de Gemini.
  set "URLBLAZE=1"
) else ( echo    [OK] Functions )
:saltarfunctions

echo.
echo    -- Hosting ^(la pagina web^) --
call firebase deploy --only hosting
if errorlevel 1 (
  set /a FALLOS+=1
  echo    [X] Hosting fallo.
) else ( echo    [OK] Hosting - tu sistema ya esta en linea )

if !FALLOS! GTR 0 goto :fallodeploy

echo.
color 0A
echo  ============================================================
echo    DESPLIEGUE COMPLETO
echo    Tu sistema ya esta en linea. La URL aparece arriba,
echo    en la linea "Hosting URL".
echo  ============================================================
pause
exit /b 0

:fallodeploy
color 0C
echo.
echo  ============================================================
echo    !FALLOS! de 4 partes no se pudieron desplegar.
echo    Lo que si subio ya esta funcionando; falta lo marcado con [X].
echo.
if defined URLSTORAGE (
  echo    STORAGE: entra a la consola y dale "Comenzar" una vez.
  echo             Es un boton, no se puede automatizar.
)
if defined URLFIRESTORE echo    FIRESTORE: falta crear la base de datos ^(modo produccion^).
if defined URLREPARAR (
  echo    FUNCTIONS: la carpeta functions\node_modules quedo incompleta.
  echo               Corre REPARAR_FUNCTIONS.bat ^(no toca tu codigo^).
)
if defined URLBLAZE (
  echo    FUNCTIONS: revisa que el proyecto este en plan Blaze
  echo               y que la clave de Gemini este cargada.
)
echo.
set /p ABRIRC="  Te abro la guia paso a paso de la consola? (s/n): "
if /i "!ABRIRC!"=="s" (
  call PREPARAR_CONSOLA.bat
  exit /b 1
)
echo.
echo    Referencia rapida:
echo.
echo    "Authentication Error / credentials no longer valid"
echo       --^>  corre CONECTAR_FIREBASE.bat y vuelve a intentar
echo.
echo    "Assertion failed: resolving hosting target"
echo       --^>  es consecuencia del error de arriba: sin sesion
echo            valida no puede resolver el proyecto
echo.
echo    "Your project must be on the Blaze plan"
echo       --^>  https://console.firebase.google.com/project/control-de-bolsas-89c88/usage/details
echo.
echo    "Secret GOOGLE_GENAI_API_KEY does not exist"
echo       --^>  corre CONFIGURAR_CLAVE_GEMINI.bat
echo.
echo    "Firebase Storage has not been set up"
echo       --^>  corre PREPARAR_CONSOLA.bat, paso 3
echo.
echo    "Site not found" o "no site name"
echo       --^>  falta crear Hosting: consola, menu Hosting, "Comenzar" 
echo  ============================================================
echo.
echo    Duda general: corre DIAGNOSTICO.bat
pause
exit /b 1

:fallo
color 0C
echo.
echo  ============================================================
echo    ALGO FALLO. Lee el error de arriba.
echo    Errores mas comunes:
echo      - Falta la clave de Gemini  --^>  corre CONFIGURAR_CLAVE_GEMINI.bat
echo      - El plan del proyecto no es Blaze ^(Functions lo exige^)
echo      - Variables VITE_ vacias en .env
echo.
echo    Corre DIAGNOSTICO.bat: revisa los 12 puntos y te dice cual falla.
echo    Si el error dice "credentials": CONECTAR_FIREBASE.bat
echo  ============================================================
pause
exit /b 1
