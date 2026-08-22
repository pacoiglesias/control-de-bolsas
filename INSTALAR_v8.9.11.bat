@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.11" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.11
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.11
echo    Reconciliacion del Portal Maquilador + mitigacion de
echo    seguridad en Excel + orden interno de Cloud Functions.
echo  ============================================================
echo.
echo   Respuesta a tu pregunta ("el portal ya muestra la realidad
echo   de las cosas?"): SI, desde que instalaste v8.9.10 -- un
echo   expediente con contrarecibo ya no puede seguir apareciendo
echo   como pendiente, porque ambas cosas dependen del mismo dato
echo   internamente. La unica salvedad son entregas que Andres
echo   confirmo ANTES de v8.9.9, que pudieron quedar sueltas.
echo.
echo   Que hace este parche:
echo    - Agrega el boton "Entregas de Andres sin asignar" en
echo      Auditoria (con un contador). Ahi puedes ver, con tus
echo      datos reales, si te quedo algun caso suelto de ANTES del
echo      fix, y resolverlo con un clic por caso (nunca en
echo      automatico, para que siempre lo revises tu primero).
echo    - Reduce el riesgo de una falla de seguridad conocida en la
echo      libreria que usa el sistema para leer archivos Excel que
echo      subes (limite de tamano + mejor registro de errores).
echo    - Reordena por dentro el archivo mas grande de Cloud
echo      Functions (sin cambiar como funciona nada).
echo    - Verificado: tsc limpio (frontend y Cloud Functions),
echo      64/64 pruebas, build de produccion completo sin errores.
echo.
echo   IMPORTANTE: este parche SI agrega una Cloud Function nueva
echo   (para el boton de reconciliacion) -^> a diferencia de
echo   v8.9.10, aqui SI necesitas correr el deploy completo al
echo   final (opcion recomendada: "s"), no solo Hosting.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_11.zip"
if not exist "%ZIPFILE%" (
  color 0C
  echo  [X] No encuentro "%ZIPFILE%" junto a este .bat.
  pause
  exit /b 1
)

set "TS=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"
set "BACKUP=_respaldo_%TS%"
echo  --- Respaldando el proyecto completo en "%BACKUP%" ---
robocopy "%~dp0." "%~dp0%BACKUP%" /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" "_ARCHIVO_OBSOLETO" /XF *.log >nul
echo  [OK] Respaldo hecho.

echo.
echo  --- Extrayendo el parche ---
set "TMPEXTRACT=%TEMP%\cb_patch8911_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch8911" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Instalando dependencias ---
call npm install
if errorlevel 1 (
  color 0E
  echo  [!] npm install marco errores. Revisa arriba.
  pause
  exit /b 1
)

echo.
echo  --- Verificando (typecheck + pruebas) ---
call npm run typecheck
if errorlevel 1 (
  color 0E
  echo  [!] El typecheck del frontend marco errores. Revisa arriba.
  pause
  exit /b 1
)
pushd functions
call npx tsc --noEmit
set RC_FN=%ERRORLEVEL%
popd
if %RC_FN% NEQ 0 (
  color 0E
  echo  [!] El typecheck de Cloud Functions marco errores. Revisa arriba.
  pause
  exit /b 1
)
call npm test
if errorlevel 1 (
  color 0E
  echo  [!] Las pruebas unitarias fallaron. Revisa arriba antes de desplegar.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. v8.9.11 instalada.
echo    Este parche agrega una Cloud Function nueva
echo    (importarEntregaMaquilaPendiente) -^> necesita el deploy
echo    completo (Cloud Functions + Hosting), no solo Hosting.
echo  ============================================================
echo.
set /p BD="  Corro INSTALAR_BUILD_DEPLOY.bat ahora? (s/n): "
if /i "!BD!"=="s" (
  if exist "INSTALAR_BUILD_DEPLOY.bat" (
    call INSTALAR_BUILD_DEPLOY.bat _EN_VENTANA_FIJA_
  ) else (
    echo  [!] No encontre INSTALAR_BUILD_DEPLOY.bat en esta carpeta.
  )
)
pause
exit /b 0
