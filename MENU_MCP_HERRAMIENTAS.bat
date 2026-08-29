@echo off
setlocal EnableDelayedExpansion
title Control de Bolsas ERP - MCP Tools
cd /d "%~dp0"

:MENU
cls
echo =======================================================================
echo              CONTROL DE BOLSAS ERP - CENTRO DE CONTROL MCP
echo =======================================================================
echo.
echo   [1] Renovar Autenticacion Google Cloud y Firebase (Corregir error RAPT)
echo   [2] Compilar y Desplegar a Produccion (Build + Deploy)
echo   [3] Ejecutar Pruebas Unitarias Financieras (104 Tests)
echo   [4] Sincronizar Cambios con GitHub (Git Status)
echo   [5] Salir
echo.
echo =======================================================================
set "opt="
set /p opt="Selecciona una opcion (1-5): "

if "%opt%"=="1" goto AUTH
if "%opt%"=="2" goto DEPLOY
if "%opt%"=="3" goto TESTS
if "%opt%"=="4" goto GIT
if "%opt%"=="5" goto SALIR

echo.
echo Opcion invalida. Intenta nuevamente.
echo.
pause
goto MENU

:AUTH
cls
echo =======================================================================
echo          RENOVANDO CREDENCIALES DE GOOGLE CLOUD Y FIREBASE
echo =======================================================================
echo.
echo [1/3] Renovando Google Cloud ADC (Requerido por servidor MCP)...
echo (Se abrira el navegador para iniciar sesion)
echo.
cmd /c "gcloud auth application-default login"
echo.
echo [2/3] Renovando sesion de Firebase CLI...
cmd /c "npx firebase login --reauth"
echo.
echo [3/3] Fijando proyecto 'control-de-bolsas-89c88'...
cmd /c "npx firebase use control-de-bolsas-89c88"
echo.
echo Autenticacion renovada con exito.
echo.
pause
goto MENU

:DEPLOY
cls
echo =======================================================================
echo                    COMPILACION Y DESPLIEGUE
echo =======================================================================
echo.
echo [1/2] Compilando proyecto...
call npm run build
if errorlevel 1 (
    echo.
    echo Error en la compilacion. Despliegue cancelado.
    echo.
    pause
    goto MENU
)
echo.
echo [2/2] Desplegando a Firebase Hosting y Firestore...
call npx firebase deploy --only hosting,firestore,storage
echo.
echo Despliegue completado con exito.
echo.
pause
goto MENU

:TESTS
cls
echo =======================================================================
echo                  PRUEBAS UNITARIAS FINANCIERAS
echo =======================================================================
echo.
call npx vitest run src/lib/__tests__
echo.
pause
goto MENU

:GIT
cls
echo =======================================================================
echo                    ESTADO DE CONTROL DE VERSIONES
echo =======================================================================
echo.
git status
echo.
pause
goto MENU

:SALIR
exit /b 0
