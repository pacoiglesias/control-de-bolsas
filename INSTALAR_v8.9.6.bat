@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.6" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.6
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.6
echo    Auditoria de seguridad e integridad de datos: los 3
echo    niveles aprobados (criticos, integridad de datos,
echo    rendimiento y pruebas).
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Auditoria: "Purgar Duplicados" y "Archivar" ya no
echo      borraban permanente ni checaban el rol -^> ahora archivan
echo      (recuperable) y solo un administrador puede hacerlo.
echo    - Caja Chica: el saldo real de efectivo salio del
echo      documento publico que necesita leer Login, a uno privado.
echo    - Saldo con Andres: la formula vivia copiada TRES veces
echo      (Dashboard, Compras-^>Andres, Portal Maquilador) -^> ahora
echo      es una sola funcion compartida, con 8 pruebas nuevas.
echo    - Un hook fantasma con el mismo nombre que el real se
echo      archivo (no se borro) a _ARCHIVO_OBSOLETO\.
echo    - Dashboard ya lee costo/comision reales de Configuracion
echo      en vez de valores fijos (42 / 8%%).
echo    - Facturacion Rapida y Asignar CR ahora usan transacciones.
echo    - Catalogo y Lista de Precios: borrar ya exige el nivel
echo      mas alto de permiso, igual que expedientes y facturas.
echo    - xlsx (429 KB) ya no se descarga hasta que se usa, en las
echo      4 pantallas que lo cargaban de forma fija.
echo    - Verificado: tsc limpio, eslint 0 errores, 80/80 pruebas
echo      (8 nuevas), build de produccion completo sin errores.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_6.zip"
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
echo  --- Archivando hook duplicado (src\hooks\useDashboardStats.ts) ---
REM No se borra nada -- se MUEVE al mismo lugar donde ya vive todo lo
REM obsoleto de este proyecto (ver _ARCHIVO_OBSOLETO\docs\, creado antes
REM por ARCHIVAR_DOCS_OBSOLETOS.bat). El parche trae la version archivada
REM (con nota explicando por que) y la sobreescribe ahi mismo al aplicarse.
if exist "src\hooks\useDashboardStats.ts" (
  if not exist "_ARCHIVO_OBSOLETO\src\hooks" mkdir "_ARCHIVO_OBSOLETO\src\hooks" >nul 2>nul
  move /Y "src\hooks\useDashboardStats.ts" "_ARCHIVO_OBSOLETO\src\hooks\useDashboardStats.ts" >nul
  echo  [OK] Movido a _ARCHIVO_OBSOLETO\src\hooks\useDashboardStats.ts ^(no se borro^).
) else (
  echo  [i] Ya no estaba en src\hooks -- nada que mover.
)

echo.
echo  --- Extrayendo el parche ---
set "TMPEXTRACT=%TEMP%\cb_patch896_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch896" "%~dp0." /E /IS /IT >nul
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
echo    LISTO. v8.9.6 instalada.
echo    Este parche toca reglas de Firestore (firestore.rules) y
echo    Cloud Functions ademas del frontend -^> necesita build +
echo    deploy completo (Hosting + Functions + Rules), no solo
echo    Hosting.
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
