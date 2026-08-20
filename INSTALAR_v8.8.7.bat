@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.8.7
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.8.7
echo    Portal Maquilador: sesion anonima real para que las
echo    entregas y consultas de gastos SI lleguen a Firestore.
echo  ============================================================
echo.
cd /d "%~dp0"

set "ZIPFILE=PARA-CLAUDE_parche_v8_8_7.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch887_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch887" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Verificando (typecheck) ---
call npm run typecheck
if errorlevel 1 (
  color 0E
  echo  [!] El typecheck marco errores. Revisa arriba antes de compilar/desplegar.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. v8.8.7 instalada.
echo  ============================================================
echo.
echo   IMPORTANTE: entra a la consola de Firebase, Authentication -^>
echo   Sign-in method, y confirma que "Anonimo" este habilitado.
echo   Si no lo esta, el arreglo de este parche no puede funcionar
echo   hasta que lo actives ahi (es gratis, no crea usuarios reales).
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
