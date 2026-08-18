@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title Deploy Completo - ERP Bolsas Providencia
cd /d "%~dp0"
set LOGFILE=%~dp0DEPLOY_LOG_2026-08-09.txt

REM ============================================================
REM  DEPLOY COMPLETO - Control Bolsas ERP
REM  Hace TODO lo necesario para publicar en un solo doble-clic:
REM    0. Verifica que Node/npm/git esten disponibles
REM    1. Actualiza firebase-tools (evita el error "Cannot
REM       determine backend specification. Timeout" que a veces
REM       da una version vieja de firebase-tools al desplegar
REM       Functions)
REM    2. git push (sube el codigo a GitHub)
REM    3. npm run deploy:hosting (build completo + Hosting,
REM       Firestore rules/indexes, Storage rules)
REM    4. npm run deploy:functions, con UN reintento automatico
REM       si el primer intento falla (los bloqueos de firewall/
REM       antivirus a veces son solo en la primera conexion)
REM  Todo el detalle queda en DEPLOY_LOG_2026-08-09.txt, y al
REM  final se muestra un resumen en esta misma ventana (no se
REM  cierra sola -- hay que presionar una tecla para salir).
REM ============================================================

echo ============================================================ > "%LOGFILE%"
echo  DEPLOY COMPLETO - Control Bolsas ERP >> "%LOGFILE%"
echo  Inicio: %date% %time% >> "%LOGFILE%"
echo ============================================================ >> "%LOGFILE%"

cls
echo ============================================================
echo  DEPLOY COMPLETO - Control Bolsas ERP
echo  Esto puede tardar unos minutos. No cierres esta ventana.
echo  Detalle completo en: DEPLOY_LOG_2026-08-09.txt
echo ============================================================
echo.

REM --- Paso 0/4: verificar herramientas necesarias ---------------
echo [0/4] Verificando Node, npm y git...
echo. >> "%LOGFILE%"
echo --- Paso 0/4: Verificacion de herramientas --- >> "%LOGFILE%"

where node >nul 2>&1
if errorlevel 1 (
  echo   X Node.js no esta instalado o no esta en el PATH.
  echo Node.js no encontrado. Instalalo desde https://nodejs.org y vuelve a intentar. >> "%LOGFILE%"
  goto :fallo_temprano
)

where npm >nul 2>&1
if errorlevel 1 (
  echo   X npm no esta disponible.
  echo npm no encontrado ^(deberia venir con Node.js^). >> "%LOGFILE%"
  goto :fallo_temprano
)

where git >nul 2>&1
if errorlevel 1 (
  echo   X git no esta instalado o no esta en el PATH.
  echo git no encontrado. Instalalo desde https://git-scm.com y vuelve a intentar. >> "%LOGFILE%"
  goto :fallo_temprano
)

echo   OK: Node, npm y git disponibles.
echo Node, npm y git verificados correctamente. >> "%LOGFILE%"

REM --- Paso 1/4: actualizar firebase-tools ------------------------
echo.
echo [1/4] Actualizando firebase-tools (evita errores de version vieja)...
echo. >> "%LOGFILE%"
echo --- Paso 1/4: npm install -g firebase-tools --- >> "%LOGFILE%"
for /f "delims=" %%v in ('call firebase --version 2^>nul') do set FIREBASE_VERSION_ANTES=%%v
echo Version de firebase-tools ANTES: %FIREBASE_VERSION_ANTES% >> "%LOGFILE%"
call npm install -g firebase-tools >> "%LOGFILE%" 2>&1
set FBTOOLS_EXIT=%errorlevel%
for /f "delims=" %%v in ('call firebase --version 2^>nul') do set FIREBASE_VERSION_DESPUES=%%v
echo Version de firebase-tools DESPUES: %FIREBASE_VERSION_DESPUES% >> "%LOGFILE%"
if %FBTOOLS_EXIT% EQU 0 (
  echo   OK: firebase-tools %FIREBASE_VERSION_DESPUES%
) else (
  echo   ! No se pudo actualizar firebase-tools ^(seguimos con la version actual: %FIREBASE_VERSION_ANTES%^)
  echo AVISO: npm install -g firebase-tools termino con codigo %FBTOOLS_EXIT%. Se continua con la version ya instalada. >> "%LOGFILE%"
)

REM --- Paso 2/4: git push ------------------------------------------
echo.
echo [2/4] Subiendo codigo a GitHub (git push)...
echo. >> "%LOGFILE%"
echo --- Paso 2/4: git push --- >> "%LOGFILE%"
git push >> "%LOGFILE%" 2>&1
set GIT_EXIT=%errorlevel%
echo git push termino con codigo %GIT_EXIT% >> "%LOGFILE%"
if %GIT_EXIT% EQU 0 (
  echo   OK: codigo subido a GitHub.
) else (
  echo   ! git push fallo ^(codigo %GIT_EXIT%^) -- revisa el log. Se continua de todos modos con el deploy.
)

REM FIX 2026-08-10: Hosting y Functions se publican por separado.
REM Antes "npm run deploy" hacia ambos en un solo intento -- si
REM Functions fallaba (como paso el 09/08, "Cannot determine
REM backend specification. Timeout"), TODO el deploy se cancelaba,
REM incluyendo Hosting, aunque el build ya hubiera terminado bien.
REM Asi, si Functions falla, el sitio (Hosting) ya quedo en vivo.

REM --- Paso 3/4: build + deploy Hosting/Firestore/Storage ----------
echo.
echo [3/4] Compilando y publicando Hosting, Firestore y Storage...
echo. >> "%LOGFILE%"
echo --- Paso 3/4: npm run deploy:hosting (build + Hosting/Firestore/Storage) --- >> "%LOGFILE%"
call npm run deploy:hosting >> "%LOGFILE%" 2>&1
set HOSTING_EXIT=%errorlevel%
echo npm run deploy:hosting termino con codigo %HOSTING_EXIT% >> "%LOGFILE%"

if not %HOSTING_EXIT% EQU 0 (
  echo   X FALLO -- nada se publico. Revisa DEPLOY_LOG_2026-08-09.txt
  echo. >> "%LOGFILE%"
  echo RESULTADO: FALLO en Hosting -- nada se publico. Revisa el log de arriba. Si menciona "firebase login" o "reauth", corre en una terminal: firebase login --reauth  y luego vuelve a ejecutar este archivo. >> "%LOGFILE%"
  echo Fin: %date% %time% >> "%LOGFILE%"
  goto :resumen_final
)
echo   OK: Hosting, Firestore y Storage publicados.

REM --- Paso 4/4: deploy Functions, con un reintento automatico -----
echo.
echo [4/4] Publicando Functions (intento 1 de 2)...
echo. >> "%LOGFILE%"
echo --- Paso 4/4: npm run deploy:functions (intento 1) --- >> "%LOGFILE%"
call npm run deploy:functions >> "%LOGFILE%" 2>&1
set FUNCTIONS_EXIT=%errorlevel%
echo npm run deploy:functions (intento 1) termino con codigo %FUNCTIONS_EXIT% >> "%LOGFILE%"

if not %FUNCTIONS_EXIT% EQU 0 (
  echo   ! Intento 1 fallo. Esperando 15 segundos y reintentando ^(a veces el bloqueo del firewall es solo en la primera conexion^)...
  echo. >> "%LOGFILE%"
  echo Intento 1 de Functions fallo. Esperando 15s y reintentando... >> "%LOGFILE%"
  timeout /t 15 /nobreak >nul
  echo --- Paso 4/4: npm run deploy:functions (intento 2) --- >> "%LOGFILE%"
  call npm run deploy:functions >> "%LOGFILE%" 2>&1
  set FUNCTIONS_EXIT=%errorlevel%
  echo npm run deploy:functions (intento 2) termino con codigo %FUNCTIONS_EXIT% >> "%LOGFILE%"
)

if %FUNCTIONS_EXIT% EQU 0 (
  echo   OK: Functions publicadas.
) else (
  echo   X Functions siguio fallando tras 2 intentos.
)

echo. >> "%LOGFILE%"
echo Fin: %date% %time% >> "%LOGFILE%"

if %FUNCTIONS_EXIT% EQU 0 (
  echo. >> "%LOGFILE%"
  echo RESULTADO: EXITO TOTAL. Hosting y Functions publicados en produccion. >> "%LOGFILE%"
) else (
  echo. >> "%LOGFILE%"
  echo RESULTADO: PARCIAL. Hosting SI quedo publicado ^(los cambios de hoy ya estan en vivo^). Functions fallo tras 2 intentos -- revisa el log de arriba. Si dice "Cannot determine backend specification" o "Timeout", suele ser el Firewall/antivirus bloqueando la conexion local de la terminal. Ya se intento actualizar firebase-tools automaticamente al inicio de este script ^(ver Paso 1/4 arriba en el log^). Puedes reintentar solo este paso corriendo: npm run deploy:functions >> "%LOGFILE%"
)

goto :resumen_final

:fallo_temprano
echo. >> "%LOGFILE%"
echo RESULTADO: FALLO -- faltan herramientas basicas, no se intento el deploy. >> "%LOGFILE%"
echo Fin: %date% %time% >> "%LOGFILE%"
echo.
echo ============================================================
echo  No se pudo continuar: revisa el mensaje de arriba.
echo ============================================================
pause
exit /b 1

:resumen_final
echo.
echo ============================================================
echo  RESUMEN
echo ============================================================
if %HOSTING_EXIT% EQU 0 (
  echo  Hosting / Firestore / Storage : PUBLICADO
) else (
  echo  Hosting / Firestore / Storage : FALLO
)
if defined FUNCTIONS_EXIT (
  if %FUNCTIONS_EXIT% EQU 0 (
    echo  Functions                     : PUBLICADO
  ) else (
    echo  Functions                     : FALLO ^(reintentado 2 veces^)
  )
) else (
  echo  Functions                     : NO SE INTENTO ^(Hosting fallo primero^)
)
echo.
echo  Detalle completo en: DEPLOY_LOG_2026-08-09.txt
echo ============================================================
echo.
pause
exit /b %FUNCTIONS_EXIT%
