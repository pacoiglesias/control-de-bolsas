@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.4" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.4
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.4
echo    CRITICO: "Saldo con Andres" del Dashboard decia
echo    -$1,289,709.62 cuando el numero real es +$40,800.00 --
echo    reportado en vivo y corregido.
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - El Dashboard y Compras -^> Andres mostraban dos numeros
echo      distintos para el mismo saldo (diferencia de
echo      $1,330,509.62). El Dashboard nunca leia el ajuste de
echo      deuda historica que calibraste en Ajustes y usaba en su
echo      lugar un valor fijo de hace semanas.
echo    - Ya corregido para que ambas pantallas lean exactamente el
echo      mismo dato. Verificado: tsc limpio, 72/72 pruebas.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_4.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch894_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch894" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

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
echo    LISTO. v8.9.4 instalada.
echo    Este parche SI necesita build + deploy de Hosting para que
echo    el numero correcto se vea en produccion (es un cambio de
echo    codigo del frontend, no alcanza con guardar el archivo).
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
