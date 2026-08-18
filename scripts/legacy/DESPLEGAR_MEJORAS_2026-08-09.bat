@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas ERP - Publicar mejoras 2026-08-09
color 0B
cls
echo.
echo  ============================================================
echo    PUBLICAR MEJORAS - Control Bolsas ERP (actualizado 08-10)
echo  ============================================================
echo.
echo   Este script NO BORRA NADA. Publica en produccion los 3
echo   commits locales que estan listos y ya verificados:
echo.
echo     1. 76832a5 - Contraste de SmartAlerts, proyeccion 30d neta,
echo        migracion de espejo movida a Firestore.
echo     2. 0b21c3a - ConfirmModal reemplaza los 28 window.confirm(),
echo        modo oscuro corregido en los 3 tableros Kanban, nueva
echo        alerta de margen anomalo por factura.
echo     3. d66a536 - Documentacion (AUDIT_NOTEBOOK.md), no toca
echo        codigo de la app.
echo.
echo   [AVISO IMPORTANTE] El intento de deploy anterior (mismo dia)
echo   quedo A MEDIAS: el "git push" si subio, pero el build se
echo   interrumpio con Ctrl+C antes de terminar, asi que NADA de
echo   lo de arriba llego a produccion todavia. Si esta ventana
echo   pide "Terminar el trabajo por lotes (S/N)?", contesta N o
echo   simplemente NO cierres esta ventana ni presiones Ctrl+C
echo   mientras dice "building for production..." -- el build
echo   completo tarda un par de minutos, es normal que tarde.
echo.
echo   Verificado antes de este script: tsc -b (0 errores),
echo   vite build y functions build, los tres exitosos.
echo.
echo   NOTA: tu proyecto tiene ademas otros archivos modificados
echo   sin terminar (ej. src/lib/finance.ts, package.json) que
echo   este script NO toca ni incluye -- solo publica los 3
echo   commits ya hechos arriba.
echo.
echo   Pasos que va a ejecutar, en orden:
echo     1. git push               (sube los 3 commits a GitHub)
echo     2. deploy de Hosting/Firestore/Storage (lo de hoy: UI,
echo        modo oscuro, alertas -- NO depende de Functions)
echo     3. deploy de Functions POR SEPARADO (si falla, NO se
echo        deshace lo publicado en el paso 2)
echo.
echo   [POR QUE SEPARADO] El intento anterior fallo en Functions
echo   ("Cannot determine backend specification. Timeout") y eso
echo   tumbo TODO el deploy junto, incluyendo Hosting -- aunque el
echo   build del sitio ya habia terminado bien. Separando los pasos,
echo   un problema de Functions (que nadie toco hoy) ya no bloquea
echo   publicar el resto.
echo.
pause

cd /d "%~dp0"

echo.
echo  ------------------------------------------------------------
echo   Paso 1/3: subiendo commits a GitHub...
echo  ------------------------------------------------------------
git push
if errorlevel 1 (
  echo.
  echo   [AVISO] git push fallo. Revisa el mensaje de arriba
  echo   (puede ser que falte iniciar sesion en git, o que haya
  echo   cambios nuevos en GitHub que primero necesites traer con
  echo   "git pull"^). El despliegue de abajo puede seguir de todas
  echo   formas si solo quieres publicar sin subir a GitHub todavia.
  echo.
  pause
)

echo.
echo  ------------------------------------------------------------
echo   Paso 2/3: build + publicar Hosting/Firestore/Storage...
echo  ------------------------------------------------------------
call npm run deploy:hosting
if errorlevel 1 (
  echo.
  echo   [ERROR] Este paso SI es critico -- no se publico el sitio.
  echo   Revisa el mensaje de arriba. Si dice algo de "firebase
  echo   login" o "reauth", corre:
  echo.
  echo       firebase login --reauth
  echo.
  echo   y vuelve a ejecutar este archivo.
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
echo   Paso 3/3: publicar Functions (por separado)...
echo  ------------------------------------------------------------
call npm run deploy:functions
if errorlevel 1 (
  echo.
  echo   [AVISO] Functions no se pudo publicar, PERO el sitio del
  echo   Paso 2 SI quedo publicado -- no se perdio nada de hoy.
  echo.
  echo   Si el error dice "Cannot determine backend specification"
  echo   o "Timeout", las causas mas comunes son:
  echo     - El Firewall de Windows o un antivirus esta bloqueando
  echo       la conexion local (localhost/127.0.0.1) que la propia
  echo       terminal de Firebase usa para revisar tus funciones.
  echo       Prueba desactivar momentaneamente el antivirus o
  echo       permitir "node.exe" en el Firewall de Windows.
  echo     - firebase-tools desactualizado: corre
  echo         npm install -g firebase-tools
  echo       y vuelve a intentar.
  echo     - A veces es un problema pasajero de conexion -- simplemente
  echo       vuelve a correr:  npm run deploy:functions
  echo   No es nada que se haya roto en el codigo -- no se toco
  echo   ningun archivo de functions/ en esta tanda de mejoras.
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    LISTO. Hosting y Functions publicados en produccion.
echo  ============================================================
echo.
pause
