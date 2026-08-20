@echo off
chcp 65001 >nul
title Control Bolsas - OBSOLETO, usa INSTALAR_BUILD_DEPLOY.bat
color 0E
cls
echo.
echo  ============================================================
echo    ESTE SCRIPT QUEDO OBSOLETO
echo  ============================================================
echo.
echo   INSTALL_AND_DEPLOY.bat hacia lo mismo que
echo   INSTALAR_BUILD_DEPLOY.bat, pero mas viejo e incompleto:
echo     - No corria typecheck ni ESLint antes de desplegar.
echo     - No verificaba/renovaba tu sesion de Firebase.
echo     - No traia el arreglo del timeout de Cloud Functions
echo       ni reintentos si el CLI de Firebase fallaba solo.
echo     - Tenia un error de sintaxis que rompia su propio freno
echo       de seguridad: si las pruebas fallaban, el script debia
echo       detenerse, pero un "^&" de mas lo dejaba seguir de
echo       largo y desplegar de todos modos.
echo.
echo   Te mando derecho a INSTALAR_BUILD_DEPLOY.bat, que es el
echo   que se sigue manteniendo.
echo.
cd /d "%~dp0"
if exist "INSTALAR_BUILD_DEPLOY.bat" (
  pause
  call INSTALAR_BUILD_DEPLOY.bat
) else (
  echo  [X] No encontre INSTALAR_BUILD_DEPLOY.bat en esta carpeta.
  pause
)
exit /b 0
