@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas v5 - Instalacion inicial
color 0E
echo.
echo  ============================================================
echo    CONTROL BOLSAS v5 - INSTALACION INICIAL (una sola vez)
echo  ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encontre Node.js. Instalalo desde https://nodejs.org (version 20 LTS^)
  echo      y vuelve a ejecutar este archivo.
  pause & exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo  [OK] Node.js %%v

where firebase >nul 2>nul
if errorlevel 1 (
  echo  [..] Instalando Firebase CLI de forma global...
  call npm install -g firebase-tools
  if errorlevel 1 ( color 0C & echo  [X] Fallo la instalacion del Firebase CLI. & pause & exit /b 1 )
)
echo  [OK] Firebase CLI listo

if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo.
  echo  [!] Cree el archivo .env a partir de .env.example
  echo      ABRELO AHORA y pega los datos de tu proyecto Firebase.
  notepad .env
)

if not exist ".firebaserc" (
  copy ".firebaserc.example" ".firebaserc" >nul
  echo.
  echo  [!] Cree .firebaserc — escribe ahi el ID de tu proyecto Firebase.
  notepad .firebaserc
)

echo.
echo  [..] Instalando dependencias del frontend...
call npm install
if errorlevel 1 ( color 0C & echo  [X] Fallo npm install. & pause & exit /b 1 )

echo  [..] Instalando dependencias del backend...
call npm --prefix functions install
if errorlevel 1 ( color 0C & echo  [X] Fallo npm install en functions. & pause & exit /b 1 )

echo.
echo  [..] Verificando la sesion de Firebase...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [!] Necesitas iniciar o renovar sesion. Se abrira el navegador.
  call firebase login --reauth
  call firebase projects:list >nul 2>nul
  if errorlevel 1 ( color 0C & echo  [X] La sesion no quedo valida. & pause & exit /b 1 )
)
echo  [OK] Sesion valida
call firebase use control-de-bolsas-89c88 >nul 2>nul
if errorlevel 1 ( echo  [!] Elige el proyecto: & call firebase use --add )

echo.
echo  ============================================================
echo    FALTAN DOS COSAS, en este orden:
echo.
echo      1. La clave de Gemini  --^>  CONFIGURAR_CLAVE_GEMINI.bat
echo      2. Tu usuario administrador ^(README, paso 4^)
echo.
echo    Luego: INSTALL_AND_DEPLOY.bat
echo    Si algo no cuadra: DIAGNOSTICO.bat te dice que falta.
echo  ============================================================
echo.
set /p IRCLAVE="  Configuro la clave de Gemini ahora? (s/n): "
if /i "%IRCLAVE%"=="s" call CONFIGURAR_CLAVE_GEMINI.bat
pause
