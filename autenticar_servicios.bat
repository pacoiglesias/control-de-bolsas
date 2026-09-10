@echo off
chcp 65001 >nul
title Asistente Visual de Autenticacion - Firebase y Google Cloud Firestore
color 0B

:MENU
cls
echo ===============================================================================
echo        ASISTENTE VISUAL DE AUTENTICACION - CONTROL DE BOLSAS ERP
echo ===============================================================================
echo.
echo   Este asistente renueva de forma automatica y guiada tus credenciales
echo   para solucionar los errores de sesion expirada:
echo.
echo     * Google Cloud / Firestore MCP: invalid_grant / invalid_rapt
echo     * Firebase CLI: Your credentials are no longer valid (--reauth)
echo.
echo   Proyecto Configurado: control-de-bolsas-89c88 (PROD)
echo.
echo -------------------------------------------------------------------------------
echo   [1] AUTENTICACION COMPLETA (Google Cloud + Firebase)  [RECOMENDADO]
echo   [2] Solo Google Cloud ADC (Resuelve error invalid_rapt de Firestore MCP)
echo   [3] Solo Firebase CLI (Resuelve firebase login --reauth)
echo   [4] Autenticar Completo y Desplegar de Inmediato a Produccion
echo   [5] Verificar Estado Actual de Cuentas Conectadas
echo   [0] Salir
echo -------------------------------------------------------------------------------
echo.
set /p OPCION="Selecciona una opcion [1, 2, 3, 4, 5 o 0]: "

if "%OPCION%"=="1" goto AUTH_ALL
if "%OPCION%"=="2" goto AUTH_GCLOUD
if "%OPCION%"=="3" goto AUTH_FIREBASE
if "%OPCION%"=="4" goto AUTH_AND_DEPLOY
if "%OPCION%"=="5" goto CHECK_STATUS
if "%OPCION%"=="0" goto SALIR

echo.
echo Opcion no valida. Presiona cualquier tecla para reintentar...
pause >nul
goto MENU

:AUTH_ALL
cls
echo.
echo ===============================================================================
echo  PASO 1 DE 2: Autenticacion de Google Cloud (Application Default Credentials)
echo ===============================================================================
echo.
echo  [!] Se abrira una ventana en tu navegador web.
echo  [!] Inicia sesion con la cuenta administradora de Google Cloud.
echo  [!] Haz clic en Permitir para renovar las credenciales ADC de Firestore MCP.
echo.
pause
echo.
echo Conectando con Google Cloud...
call gcloud auth application-default login
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error al autenticar con Google Cloud ADC.
    echo Revisa tu conexion a internet o los permisos de tu cuenta.
    echo.
    pause
    goto MENU
)

echo.
echo Configurando proyecto oficial de produccion: control-de-bolsas-89c88...
call gcloud config set project control-de-bolsas-89c88

echo.
echo ===============================================================================
echo  PASO 2 DE 2: Autenticacion en Firebase CLI
echo ===============================================================================
echo.
echo  [!] Se abrira nuevamente el navegador para autenticar el Firebase CLI.
echo  [!] Concede los permisos a Firebase CLI.
echo.
pause
echo.
echo Conectando con Firebase...
call firebase login --reauth
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error al autenticar con Firebase CLI.
    echo.
    pause
    goto MENU
)

echo.
echo Seleccionando entorno de produccion...
call firebase use prod

echo.
echo ===============================================================================
echo  AUTENTICACION COMPLETADA CON EXITO!
echo ===============================================================================
echo  Tus credenciales de Google Cloud ADC y Firebase han sido renovadas.
echo  Firestore MCP y el CLI de despliegue estan 100%% operativos.
echo.
pause
goto MENU

:AUTH_GCLOUD
cls
echo.
echo ===============================================================================
echo  Renovando Credenciales de Google Cloud ADC (Firestore MCP)
echo ===============================================================================
echo.
echo  [!] Se abrira el navegador para renovar el token OAuth2 ADC.
echo.
pause
echo.
call gcloud auth application-default login
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error al renovar credenciales ADC de Google Cloud.
    pause
    goto MENU
)
call gcloud config set project control-de-bolsas-89c88
echo.
echo Google Cloud ADC renovado con exito.
pause
goto MENU

:AUTH_FIREBASE
cls
echo.
echo ===============================================================================
echo  Renovando Credenciales de Firebase CLI
echo ===============================================================================
echo.
echo  [!] Se abrira tu navegador para iniciar sesion en Firebase CLI.
echo.
pause
echo.
call firebase login --reauth
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error al autenticar en Firebase CLI.
    pause
    goto MENU
)
call firebase use prod
echo.
echo Firebase CLI autenticado y configurado en entorno prod.
pause
goto MENU

:AUTH_AND_DEPLOY
cls
echo.
echo ===============================================================================
echo  MODO COMPLETO: AUTENTICAR Y DESPLEGAR A PRODUCCION
echo ===============================================================================
echo.
echo  Iniciando renovacion de Google Cloud ADC...
call gcloud auth application-default login
call gcloud config set project control-de-bolsas-89c88

echo.
echo  Iniciando renovacion de Firebase CLI...
call firebase login --reauth
call firebase use prod

echo.
echo ===============================================================================
echo  Iniciando Despliegue a Produccion (deploy:prod)...
echo ===============================================================================
echo.
call npm run deploy:prod
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================================================
    echo   DESPLIEGUE A PRODUCCION EXITOSO!
    echo   La aplicacion ya esta en linea y actualizada.
    echo ===============================================================================
) else (
    echo.
    echo Ocurrio un inconveniente durante el despliegue. Revisa los mensajes arriba.
)
echo.
pause
goto MENU

:CHECK_STATUS
cls
echo.
echo ===============================================================================
echo  ESTADO ACTUAL DE CONEXIONES Y CUENTAS
echo ===============================================================================
echo.
echo [1] Cuentas de Google Cloud:
call gcloud auth list
echo.
echo [2] Proyecto Google Cloud Activo:
call gcloud config get-value project
echo.
echo [3] Cuentas de Firebase CLI:
call firebase login:list
echo.
echo [4] Proyecto Firebase Activo:
call firebase use
echo.
echo ===============================================================================
pause
goto MENU

:SALIR
cls
echo.
echo Hasta luego!
timeout /t 2 >nul
exit /b 0