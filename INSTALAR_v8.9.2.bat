@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.2
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.2
echo    Auditoria completa: seguridad, un borrado automatico
echo    oculto de expedientes, y consistencia del Kanban.
echo  ============================================================
echo.
echo   IMPORTANTE: este parche modifica firestore.rules y dos
echo   Cloud Functions (recalcDashboardStats, parseDocumentData,
echo   getActiveMaquilaOrders, registrarEntregaMaquila). Necesita
echo   un deploy completo despues de instalarlo -- este script te
echo   lo va a ofrecer al final.
echo.
cd /d "%~dp0"

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_2.zip"
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
robocopy "%~dp0." "%~dp0%BACKUP%" /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" /XF *.log >nul
echo  [OK] Respaldo hecho.

echo.
echo  --- Extrayendo el parche ---
set "TMPEXTRACT=%TEMP%\cb_patch892_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch892" "%~dp0." /E /IS /IT >nul
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
echo    LISTO. v8.9.2 instalada.
echo    Este parche SI necesita desplegarse (reglas + funciones)
echo    para que los arreglos de seguridad queden activos de verdad.
echo  ============================================================
echo.
set /p BD="  Corro INSTALAR_BUILD_DEPLOY.bat ahora? (s/n): "
if /i "!BD!"=="s" (
  if exist "INSTALAR_BUILD_DEPLOY.bat" (
    call INSTALAR_BUILD_DEPLOY.bat
  ) else (
    echo  [!] No encontre INSTALAR_BUILD_DEPLOY.bat en esta carpeta.
  )
)
pause
exit /b 0
