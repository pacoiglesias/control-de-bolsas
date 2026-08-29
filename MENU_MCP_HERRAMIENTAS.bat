@echo off
chcp 65001 > nul
:MENU
cls
color 0A
echo =======================================================================
echo              CONTROL DE BOLSAS ERP - CENTRO DE CONTROL MCP
echo =======================================================================
echo.
echo   [1] 🔑 Renovar Autenticación Google Cloud / Firebase (Corregir error RAPT)
echo   [2] 🚀 Compilar y Desplegar a Producción (Build + Deploy)
echo   [3] 🧪 Ejecutar Pruebas Unitarias Financieras (104 Tests)
echo   [4] 📦 Sincronizar Cambios con GitHub (Git Status / Pull / Push)
echo   [5] 🚪 Salir
echo.
echo =======================================================================
set /p opt="Selecciona una opción (1-5): "

if "%opt%"=="1" goto AUTH
if "%opt%"=="2" goto DEPLOY
if "%opt%"=="3" goto TESTS
if "%opt%"=="4" goto GIT
if "%opt%"=="5" goto EXIT

echo Opción inválida.
timeout /t 2 > nul
goto MENU

:AUTH
cls
color 0B
echo =======================================================================
echo          RENOVANDO CREDENCIALES DE GOOGLE CLOUD Y FIREBASE
echo =======================================================================
echo.
echo [1/3] Renovando Google Cloud ADC (Requerido por el servidor MCP)...
cmd /c "gcloud auth application-default login"
echo.
echo [2/3] Renovando Firebase CLI...
cmd /c "npx firebase login --reauth"
echo.
echo [3/3] Fijando proyecto 'control-de-bolsas-89c88'...
cmd /c "npx firebase use control-de-bolsas-89c88"
echo.
echo ✅ Autenticación renovada con éxito.
pause
goto MENU

:DEPLOY
cls
color 0E
echo =======================================================================
echo                    COMPILACIÓN Y DESPLIEGUE
echo =======================================================================
echo.
echo [1/2] Compilando proyecto...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Error en la compilación. Despliegue cancelado.
    pause
    goto MENU
)
echo.
echo [2/2] Desplegando a Firebase Hosting y Firestore...
call npx firebase deploy --only hosting,firestore,storage
echo.
echo ✅ Despliegue completado.
pause
goto MENU

:TESTS
cls
color 0D
echo =======================================================================
echo                  PRUEBAS UNITARIAS FINANCIERAS
echo =======================================================================
echo.
call npx vitest run src/lib/__tests__
pause
goto MENU

:GIT
cls
color 0F
echo =======================================================================
echo                    ESTADO DE CONTROL DE VERSIONES
echo =======================================================================
echo.
git status
echo.
pause
goto MENU

:EXIT
exit
