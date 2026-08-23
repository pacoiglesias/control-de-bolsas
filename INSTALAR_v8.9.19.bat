@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.19" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.19
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.19
echo    Flujo de contrarecibos a detalle: estado del portal
echo    del cliente (Generado / En Proceso de Pago / Sin Numero).
echo  ============================================================
echo.
echo   IMPORTANTE -- este parche reemplaza al v8.9.13 (NO lo
echo   instales si todavia no lo has hecho, o si tu proyecto quedo
echo   a medias por el typecheck fallido de ese parche). Este
echo   v8.9.19 se construyo desde cero sobre tu codigo real v8.9.18
echo   -- no sobre la copia vieja que causo el problema la vez
echo   pasada -- y quedo verificado con typecheck (raiz y Cloud
echo   Functions), lint, 89 pruebas unitarias y build completo
echo   antes de entregarse.
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
echo    - Se termino de corregir el precio/IVA "quemado" (43 /
echo      1.16) en los ultimos sitios pendientes: Prefactura PDF,
echo      Auditoria (AuditSync) y Sincronizador Oficial.
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

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_19.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch8919_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch8919" "%~dp0." /E /IS /IT >nul
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
echo  --- Verificando (typecheck + lint + pruebas) ---
call npm run typecheck
if errorlevel 1 (
  color 0C
  echo  [!] El typecheck del frontend marco errores. Revisa arriba.
  echo      NO corras INSTALAR_BUILD_DEPLOY.bat. Avisame.
  pause
  exit /b 1
)
pushd functions
call npx tsc --noEmit
set RC_FN=%ERRORLEVEL%
popd
if %RC_FN% NEQ 0 (
  color 0C
  echo  [!] El typecheck de Cloud Functions marco errores. Revisa arriba.
  echo      NO corras INSTALAR_BUILD_DEPLOY.bat. Avisame.
  pause
  exit /b 1
)
call npm run lint
if errorlevel 1 (
  color 0E
  echo  [!] El lint marco errores. Revisa arriba.
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
echo    LISTO. v8.9.19 instalada y verificada (typecheck, lint,
echo    89 pruebas unitarias).
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
