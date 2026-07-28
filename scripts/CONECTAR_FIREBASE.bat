@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Conectar con Firebase
color 0B
cls
echo.
echo  ============================================================
echo    CONECTAR ESTA COMPUTADORA CON FIREBASE
echo  ============================================================
echo.
echo  Corre esto cada vez que veas:
echo    "Authentication Error: Your credentials are no longer valid"
echo.
echo  Es solo la sesion del Firebase CLI, que caduca sola cada
echo  cierto tiempo. No tiene nada que ver con tu clave de Gemini
echo  ni con tu proyecto.
echo.

where firebase >nul 2>nul
if errorlevel 1 (
  echo  [..] Instalando el Firebase CLI...
  call npm install -g firebase-tools
  if errorlevel 1 (
    color 0C
    echo  [X] Fallo. Abre la terminal COMO ADMINISTRADOR y corre:
    echo      npm install -g firebase-tools
    pause & exit /b 1
  )
)

echo  [..] Cerrando la sesion vieja...
call firebase logout >nul 2>nul

echo.
echo  [..] Se abrira el navegador. Elige la cuenta de Google
echo       donde vive el proyecto control-de-bolsas-89c88.
echo.
call firebase login --reauth
if errorlevel 1 (
  color 0C
  echo  [X] No se completo el inicio de sesion.
  echo      Si el navegador no abrio, copia la URL que salio arriba
  echo      y pegala a mano en Chrome.
  pause & exit /b 1
)

echo.
echo  [..] Validando...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] La sesion sigue sin validar. Puede ser el proxy de tu red
  echo      o un antivirus bloqueando la conexion.
  pause & exit /b 1
)

call firebase use control-de-bolsas-89c88 >nul 2>nul
if errorlevel 1 (
  echo  [!] No pude seleccionar el proyecto. Elige de la lista:
  call firebase use --add
)

color 0A
echo.
echo  ============================================================
echo    CONECTADO
for /f "tokens=*" %%p in ('firebase use 2^>nul') do echo    %%p
echo.
echo    Ya puedes correr INSTALL_AND_DEPLOY.bat
echo  ============================================================
pause
