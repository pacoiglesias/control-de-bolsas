@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas ERP - Despliegue robusto
color 0B
cls
echo.
echo  ============================================================
echo    DESPLIEGUE ROBUSTO - Control Bolsas ERP
echo  ============================================================
echo.
echo   Este script NO BORRA NADA. Publica en produccion los commits
echo   locales ya verificados.
echo.
echo   Que hace, en orden:
echo     1. Verifica tu sesion de Firebase.
echo     2. Fija el proyecto correcto.
echo     3. Actualiza firebase-tools a la ultima version.
echo     4. Instala dependencias solo si hacen falta (mas rapido en
echo        despliegues repetidos) y corre las pruebas de la formula
echo        financiera -- si algo cambio el resultado de los calculos
echo        de dinero, NO se despliega nada.
echo     5. git push.
echo     6. Build + Hosting/Firestore/Storage.
echo     7. Cloud Functions, con el limite de descubrimiento ampliado
echo        a 60 segundos y reintento automatico si falla.
echo.
echo   Todo el detalle tecnico queda en DEPLOY_LOG.txt, por si algo
echo   falla y hay que revisar el mensaje completo.
echo.
pause

cd /d "%~dp0"
set "LOGFILE=%~dp0DEPLOY_LOG.txt"
echo ============================================================ > "%LOGFILE%"
echo  DEPLOY - Control Bolsas ERP >> "%LOGFILE%"
echo  Inicio: %date% %time% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

if not exist "firebase.json" (
  color 0C
  echo.
  echo   [ERROR] No estas en la carpeta del proyecto.
  echo.
  pause
  exit /b 1
)

echo.
echo  ------------------------------------------------------------
echo   Paso 1/7: verificando sesion de Firebase...
echo  ------------------------------------------------------------
call firebase login:list >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No hay sesion activa o expiro. Abriendo el navegador para
  echo   iniciar sesion de nuevo...
  echo.
  call firebase login --reauth
  if errorlevel 1 (
    echo.
    echo   [ERROR] No se pudo iniciar sesion en Firebase. No se puede
    echo   continuar sin esto. Cierra esta ventana, corre manualmente
    echo   "firebase login" y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
  )
) else (
  echo   Sesion activa encontrada.
)

echo.
echo  ------------------------------------------------------------
echo   Paso 2/7: fijando el proyecto correcto...
echo  ------------------------------------------------------------
call firebase use control-de-bolsas-89c88
if errorlevel 1 (
  echo.
  echo   [AVISO] "firebase use" devolvio un error, PERO si arriba ya
  echo   viste el mensaje "Now using project control-de-bolsas-89c88"
  echo   quiere decir que el proyecto SI quedo bien seleccionado -- el
  echo   error de despues es un bug conocido y generico de firebase-tools:
  echo   "Error: An unexpected error has occurred" -- no impide
  echo   continuar, porque el archivo .firebaserc ya quedo escrito con
  echo   el proyecto correcto. Este script sigue adelante.
  echo.
)

echo.
echo  ------------------------------------------------------------
echo   Paso 3/7: actualizando firebase-tools...
echo  ------------------------------------------------------------
echo --- Paso 3/7: npm install -g firebase-tools --- >> "%LOGFILE%"
call npm install -g firebase-tools >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  echo   [AVISO] No se pudo actualizar firebase-tools. Se sigue con
  echo   la version ya instalada.
) else (
  echo   OK.
)

echo.
echo  ------------------------------------------------------------
echo   Paso 4/7: dependencias y pruebas de la formula financiera...
echo  ------------------------------------------------------------
if exist "node_modules" (
  echo   node_modules ya existe, se omite reinstalar -- mas rapido.
  echo   Si acabas de cambiar package.json, borra la carpeta
  echo   node_modules una vez y vuelve a correr este script.
) else (
  echo   Instalando dependencias del proyecto -- la primera vez esto
  echo   puede tardar varios minutos, no cierres la ventana aunque
  echo   no veas movimiento...
  call npm install >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    color 0C
    echo.
    echo   [ERROR] No se pudieron instalar las dependencias del
    echo   proyecto. Revisa DEPLOY_LOG.txt.
    echo.
    pause
    exit /b 1
  )
  echo   OK.
)

if exist "functions\node_modules" (
  echo   functions\node_modules ya existe, se omite reinstalar.
) else (
  echo   Instalando dependencias de functions...
  call npm --prefix functions install >> "%LOGFILE%" 2>&1
  if errorlevel 1 (
    color 0C
    echo.
    echo   [ERROR] No se pudieron instalar las dependencias de
    echo   functions. Revisa DEPLOY_LOG.txt.
    echo.
    pause
    exit /b 1
  )
  echo   OK.
)

echo   Corriendo pruebas de la formula financiera...
call npm test >> "%LOGFILE%" 2>&1
if errorlevel 1 (
  color 0C
  echo.
  echo   [ERROR] Las pruebas fallaron. NO se despliega nada.
  echo   Algo cambio el resultado de los calculos de dinero -- revisa
  echo   DEPLOY_LOG.txt antes de continuar.
  echo.
  pause
  exit /b 1
)
echo   OK: calculos verificados.

echo.
echo  ------------------------------------------------------------
echo   Paso 5/7: subiendo commits a GitHub...
echo  ------------------------------------------------------------
git push
if errorlevel 1 (
  echo.
  echo   [AVISO] git push fallo. Revisa el mensaje de arriba -- puede
  echo   ser que falte "git pull" primero. El despliegue de abajo
  echo   puede seguir de todas formas.
  echo.
  pause
)

echo.
echo  ------------------------------------------------------------
echo   Paso 6/7: build + publicar Hosting/Firestore/Storage...
echo  ------------------------------------------------------------
call npm run deploy:hosting
if errorlevel 1 (
  echo.
  echo   [ERROR] Este paso SI es critico -- no se publico el sitio.
  echo   Revisa el mensaje de arriba.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    Hosting publicado. Los cambios de hoy ya estan en vivo.
echo  ============================================================
echo.

echo.
echo  ------------------------------------------------------------
echo   Paso 7/7: publicar Functions, timeout ampliado, intento 1...
echo  ------------------------------------------------------------
set FUNCTIONS_DISCOVERY_TIMEOUT=60
call npm run deploy:functions
if errorlevel 1 (
  echo.
  echo   [AVISO] Intento 1 de Functions fallo. Esperando 15 segundos
  echo   y reintentando una vez mas antes de rendirse...
  echo.
  timeout /t 15 /nobreak >nul
  echo  ------------------------------------------------------------
  echo   Paso 7/7: publicar Functions, intento 2...
  echo  ------------------------------------------------------------
  call npm run deploy:functions
  if errorlevel 1 (
    echo.
    echo   [AVISO] Functions no se pudo publicar en 2 intentos, PERO
    echo   el sitio del Paso 6 SI quedo publicado -- no se perdio nada.
    echo.
    echo   Si el error sigue diciendo "Cannot determine backend
    echo   specification" o "Timeout", intenta:
    echo     - Cierra antivirus/firewall momentaneamente y reintenta
    echo       "npm run deploy:functions" a mano.
    echo     - Si el error NO es de timeout, copialo de DEPLOY_LOG.txt
    echo       y compartelo para revisar el codigo de functions/.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  ============================================================
echo    LISTO. Hosting y Functions publicados en produccion.
echo  ============================================================
echo.
pause
