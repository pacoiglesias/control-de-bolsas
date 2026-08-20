@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.0
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.0
echo    Logo e iconos: 4 versiones distintas regadas en el
echo    proyecto (una de ellas literalmente rota) -- unificadas.
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Arregla public/logo.png (era una captura de pantalla de
echo      una tabla, no un logo -- se usaba como respaldo del logo
echo      y como icono de pestana del navegador).
echo    - Reemplaza el icono de la app / PWA (favicon, apple-touch-
echo      icon, iconos de "agregar a inicio") por uno hecho a partir
echo      de tu logo real (el sello "ED" en denim), en vez del icono
echo      generico verde/azul que traia antes.
echo    - Tu logo grande de siempre (logo.jpg, el que subes desde
echo      Ajustes) NO se toca -- sigue igual.
echo.
cd /d "%~dp0"

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_0.zip"
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
echo  [OK] Respaldo hecho (incluye tus logos actuales, por si acaso).

echo.
echo  --- Extrayendo el parche ---
set "TMPEXTRACT=%TEMP%\cb_patch890_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch890" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Verificando (typecheck + pruebas) ---
call npm run typecheck
if errorlevel 1 (
  color 0E
  echo  [!] El typecheck marco errores. Revisa arriba.
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
echo    LISTO. v8.9.0 instalada.
echo    Este parche SI necesita un build + deploy de hosting para
echo    que el favicon y los iconos nuevos se vean en produccion
echo    (son archivos estaticos, no alcanza con guardar).
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
