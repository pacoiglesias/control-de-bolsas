@echo off
chcp 65001 >nul
title Control Bolsas - Instalar dependencias (primera vez en esta carpeta)
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR DEPENDENCIAS
echo    (correr una sola vez en una carpeta nueva, ej. C:\pacoputo)
echo  ============================================================
echo.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro Node.js instalado. Instalalo desde https://nodejs.org
  pause
  exit /b 1
)

echo  --- Dependencias de la raiz ---
call npm ci
if errorlevel 1 (
  echo  [!] npm ci fallo. Intento con npm install...
  call npm install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de la raiz.
    pause
    exit /b 1
  )
)

echo.
echo  --- Dependencias de functions ---
call npm --prefix functions ci
if errorlevel 1 (
  echo  [!] npm ci de functions fallo. Intento con npm install...
  call npm --prefix functions install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de functions.
    pause
    exit /b 1
  )
)

color 0A
echo.
echo  ============================================================
echo    LISTO. Dependencias instaladas.
echo    Ahora si puedes correr los INSTALAR_v8.8.X.bat pendientes,
echo    y despues INSTALAR_BUILD_DEPLOY.bat.
echo  ============================================================
pause
exit /b 0
