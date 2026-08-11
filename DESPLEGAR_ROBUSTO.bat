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
echo   locales ya verificados (build limpio, tsc sin errores).
echo.
echo   Diferencias contra el .bat anterior:
echo     1. Verifica tu sesion de Firebase ANTES de empezar (si
echo        expiro, te pide reautenticarte antes de intentar nada).
echo     2. Fija el proyecto correcto (control-de-bolsas-89c88) por
echo        si la CLI quedo apuntando a otro.
echo     3. Sube el tiempo limite del "descubrimiento" de Functions
echo        de 10 segundos (el valor por defecto de Firebase) a 60 --
echo        esto es lo que causaba el error "Cannot determine backend
echo        specification. Timeout after 10000" que viste. Ademas, el
echo        codigo del lector de IA (Gemini) ya se corrigio para
echo        cargar su libreria SOLO cuando de verdad se usa, en vez
echo        de cargarla siempre que se revisan las funciones -- esa
echo        libreria es pesada y era la causa mas probable del timeout.
echo     4. Reintenta el deploy de Functions automaticamente una vez
echo        mas si el primer intento falla por timeout.
echo.
pause

cd /d "%~dp0"

echo.
echo  ------------------------------------------------------------
echo   Paso 1/6: verificando sesion de Firebase...
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
echo   Paso 2/6: fijando el proyecto correcto...
echo  ------------------------------------------------------------
call firebase use control-de-bolsas-89c88
if errorlevel 1 (
  echo.
  echo   [ERROR] No se pudo seleccionar el proyecto
  echo   control-de-bolsas-89c88. Revisa que tu cuenta tenga acceso.
  echo.
  pause
  exit /b 1
)

echo.
echo  ------------------------------------------------------------
echo   Paso 3/6: subiendo commits a GitHub...
echo  ------------------------------------------------------------
git push
if errorlevel 1 (
  echo.
  echo   [AVISO] git push fallo. Revisa el mensaje de arriba (puede
  echo   ser que falte "git pull" primero). El despliegue de abajo
  echo   puede seguir de todas formas.
  echo.
  pause
)

echo.
echo  ------------------------------------------------------------
echo   Paso 4/6: build + publicar Hosting/Firestore/Storage...
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
echo   Paso 5/6: publicar Functions (intento 1, timeout ampliado)...
echo  ------------------------------------------------------------
set FUNCTIONS_DISCOVERY_TIMEOUT=60
call npm run deploy:functions
if errorlevel 1 (
  echo.
  echo   [AVISO] Intento 1 de Functions fallo. Reintentando una vez
  echo   mas antes de rendirse -- a veces el primer intento falla por
  echo   una descarga en frio de dependencias y el segundo si pasa...
  echo.
  echo  ------------------------------------------------------------
  echo   Paso 6/6: publicar Functions (intento 2)...
  echo  ------------------------------------------------------------
  call npm run deploy:functions
  if errorlevel 1 (
    echo.
    echo   [AVISO] Functions no se pudo publicar en 2 intentos, PERO
    echo   el sitio del Paso 4 SI quedo publicado -- no se perdio nada.
    echo.
    echo   Si el error sigue diciendo "Cannot determine backend
    echo   specification" o "Timeout", intenta:
    echo     - Cierra antivirus/firewall momentaneamente y reintenta
    echo       "npm run deploy:functions" a mano.
    echo     - Corre: npm install -g firebase-tools   (por si esta
    echo       desactualizado^)
    echo     - Si el error es otro (no timeout^), copialo y compartelo
    echo       para revisar el codigo de functions/.
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
