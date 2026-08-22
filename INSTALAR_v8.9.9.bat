@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.9" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.9
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.9
echo    Fix critico Portal Maquilador + Auditoria "Staff Engineer"
echo    completa (Sprints 1-4, aprobados en bloque).
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - CORRIGE EL BUG QUE REPORTASTE: cuando Andres confirmaba
echo      una entrega en el Portal Maquilador, el sistema la
echo      anotaba en una bitacora aparte pero nunca en el
echo      expediente real -^> por eso los kilos entregados no se
echo      registraban y un expediente ya entregado ^(con su
echo      contrarecibo^) seguia apareciendo como pendiente.
echo    - Saldo con Andres: Caja Chica y "Pagar a Andres" ahora
echo      usan exactamente la misma formula (antes podian mostrar
echo      numeros distintos para lo mismo).
echo    - Seguridad: se reforzo la limpieza de texto en todos los
echo      recibos/estados de cuenta/comprobantes que se imprimen o
echo      descargan como PDF.
echo    - Ya no se sobreescribe la deuda historica con Andres por
echo      accidente cada vez que se abre el Dashboard.
echo    - "Recalcular Indicadores" ya no resucita expedientes que
echo      archivaste a proposito.
echo    - Pantalla de Ordenes mas ligera (escanear PDF ya no pesa
echo      para quien no lo usa).
echo    - Portal Maquilador mas legible (mejor contraste de texto,
echo      pensado para usarse en campo con luz solar).
echo    - Accesibilidad: selector de rol y ventanas emergentes
echo      ahora funcionan bien con teclado.
echo    - Limpieza interna: dependencia muerta eliminada, utilidad
echo      matematica sin uso archivada (no borrada).
echo    - Verificado: tsc limpio, eslint 0 errores, 61/61 pruebas,
echo      build de produccion completo sin errores (frontend y
echo      Cloud Functions).
echo.
echo   IMPORTANTE: este parche tambien actualiza firestore.rules,
echo   storage.rules y firestore.indexes.json (unifica las listas
echo   de correos "dueno" y quita 2 indices sin uso). Esos cambios
echo   NO toman efecto hasta que corras el build+deploy completo
echo   al final de este script (opcion recomendada: "s").
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_9.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch899_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch899" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Archivando codigo muerto (nunca se borra, solo se mueve) ---
REM src\lib\math.ts nunca se usaba en ningun lado (confirmado por busqueda
REM en todo el repo) y tenia una forma de redondear distinta a round2(),
REM la fuente real de verdad -- una trampa para quien lo usara por error
REM pensando que era "el" helper de redondeo. Se archiva, no se borra,
REM por la regla de "nunca elimines nada sin mi consentimiento".
if exist "src\lib\math.ts" (
  if not exist "_ARCHIVO_OBSOLETO\src\lib" mkdir "_ARCHIVO_OBSOLETO\src\lib"
  move /Y "src\lib\math.ts" "_ARCHIVO_OBSOLETO\src\lib\math.ts" >nul
  echo  [OK] src\lib\math.ts archivado en _ARCHIVO_OBSOLETO\src\lib\math.ts
)
if exist "src\lib\__tests__\math.test.ts" (
  if not exist "_ARCHIVO_OBSOLETO\src\lib\__tests__" mkdir "_ARCHIVO_OBSOLETO\src\lib\__tests__"
  move /Y "src\lib\__tests__\math.test.ts" "_ARCHIVO_OBSOLETO\src\lib\__tests__\math.test.ts" >nul
  echo  [OK] src\lib\__tests__\math.test.ts archivado en _ARCHIVO_OBSOLETO\src\lib\__tests__\math.test.ts
)

echo.
echo  --- Instalando dependencias (recharts se quito, @types/file-saver cambio de lugar) ---
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
echo    LISTO. v8.9.9 instalada.
echo    Este parche toca Cloud Functions, firestore.rules,
echo    storage.rules y firestore.indexes.json ademas del
echo    frontend -^> necesita build + deploy completo (Reglas +
echo    Indices + Cloud Functions + Hosting), no solo Hosting.
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
