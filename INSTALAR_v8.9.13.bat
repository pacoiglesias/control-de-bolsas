@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.13" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.13
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.13
echo    Flujo de contrarecibos a detalle: estado del portal
echo    del cliente (Generado / En Proceso de Pago / Sin Numero).
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Nuevo boton "Sincronizar con el Portal del Cliente" en
echo      Cobranza: pegas (Ctrl+V) la tabla que copias del portal
echo      de Providencia y el sistema la reconoce, te muestra una
echo      vista previa de que va a cambiar, y actualiza SOLO el
echo      estatus del portal -- nunca montos ni kilos, y nunca
echo      crea expedientes nuevos por su cuenta.
echo    - Ese estatus (Generado / En Proceso de Pago / Sin Numero /
echo      Pagado) ahora se ve como insignia junto al numero de CR
echo      en la factura, la tabla de contrarecibos, la linea de
echo      tiempo y el tablero Kanban de Cobranza.
echo    - El Pipeline Operativo desglosa "Con Contrarecibo" en
echo      Generado vs En Proceso de Pago, en vez de mezclarlos.
echo    - De paso se termino de corregir el precio/IVA "quemado"
echo      en el codigo (43 / 1.16) en 8 archivos mas, incluyendo
echo      el generador de Prefactura PDF.
echo    - No requiere ningun secreto ni configuracion nueva --
echo      el campo nuevo nace vacio en todos tus expedientes.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_13.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch8913_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch8913" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Instalando dependencias (raiz) ---
call npm install
if errorlevel 1 (
  color 0E
  echo  [!] npm install marco errores. Revisa arriba.
  pause
  exit /b 1
)

echo.
echo  --- Instalando dependencias (Cloud Functions) ---
REM Este parche no agrega dependencias nuevas a functions/, pero el paso
REM se deja siempre presente desde v8.9.12 -- no asumir que el install
REM de la raiz cubre ambos package.json (ver leccion documentada en
REM AUDIT_NOTEBOOK.md, entrada 2026-08-22).
pushd functions
call npm install
set RC_FNI=%ERRORLEVEL%
popd
if %RC_FNI% NEQ 0 (
  color 0E
  echo  [!] npm install dentro de functions marco errores. Revisa arriba.
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
echo    LISTO. v8.9.13 instalada.
echo    Solo cambia Hosting (no hay Cloud Functions nuevas ni
echo    secretos nuevos) -- el deploy es rapido.
echo    Para empezar a usar el estado del portal: abre Cobranza,
echo    boton "Sincronizar con el Portal del Cliente", y pega
echo    ahi la tabla que copies del portal de Providencia.
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
