@echo off
setlocal EnableExtensions
title Control de Bolsas ERP - Consola de Operaciones Engine
color 0A

REM Si se pasa opcion por argumento (ej. app_engine.bat 1), se salta el menu
if not "%~1"=="" (
    set "OPCION=%~1"
    goto ROUTE_OPCION
)

:MENU
cls
echo ===============================================================================
echo       CONTROL DE BOLSAS ERP - CONSOLA DE OPERACIONES Y APP ENGINE
echo ===============================================================================
echo   Empresa: Elemental Denim S.A. de C.V.
echo   Proyecto Firebase: control-de-bolsas-89c88 (PROD)
echo   Version del Sistema: v9.15.3 Enterprise
echo ===============================================================================
echo.
echo   [1] VERIFICACION Y PRUEBAS (Vitest + TypeScript + Build)
echo   [2] DESPLIEGUE COMPLETO A PRODUCCION (Hosting + Functions + Rules)
echo   [3] DESPLIEGUE RAPIDO (Solo Hosting Frontend)
echo   [4] DESPLIEGUE A GOOGLE APP ENGINE (gcloud app deploy)
echo   [5] SINCRONIZAR Y COMBINAR CON GITHUB (origin/main)
echo   [6] LEVANTAR ENTORNO LOCAL (npm run dev)
echo   [7] ASISTENTE DE AUTENTICACION (Google Cloud + Firebase)
echo   [0] Salir
echo.
echo ===============================================================================
set "OPCION="
set /p "OPCION=Selecciona una opcion [0-7]: "

:ROUTE_OPCION
if defined OPCION set "OPCION=%OPCION: =%"

if "%OPCION%"=="1" goto VERIFY
if "%OPCION%"=="2" goto DEPLOY_ALL
if "%OPCION%"=="3" goto DEPLOY_HOSTING
if "%OPCION%"=="4" goto DEPLOY_APPENGINE
if "%OPCION%"=="5" goto SYNC_GIT
if "%OPCION%"=="6" goto DEV_SERVER
if "%OPCION%"=="7" goto AUTH_HELPER
if "%OPCION%"=="0" goto SALIR

echo.
echo Opcion no valida.
ping 127.0.0.1 -n 2 >nul
goto MENU

:VERIFY
cls
echo ===============================================================================
echo  PASO 1: Ejecutando Pruebas Unitarias de Integridad (Vitest)
echo ===============================================================================
call npx vitest run src/lib/__tests__
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Las pruebas unitarias fallaron.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo [OK] Pruebas unitarias aprobadas.
echo.
echo ===============================================================================
echo  PASO 2: Verificacion de Tipos TypeScript (tsc --noEmit)
echo ===============================================================================
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error de tipos TypeScript detectado.
    if "%~1"=="" pause
    goto MENU
)
echo [OK] Sin errores de TypeScript.
echo.
echo ===============================================================================
echo  PASO 3: Compilacion del Frontend (Vite) y Cloud Functions (tsc)
echo ===============================================================================
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error al compilar el proyecto.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo [EXITO] Sistema 100%% verificado y compilado.
if "%~1"=="" pause
if not "%~1"=="" exit /b 0
goto MENU

:DEPLOY_ALL
cls
echo ===============================================================================
echo  DESPLIEGUE COMPLETO: Hosting + Firestore + Storage + Cloud Functions
echo ===============================================================================
echo.
echo Verificando build previo...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] La compilacion fallo. Despliegue cancelado.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo Desplegando todo a Firebase (control-de-bolsas-89c88)...
call npx firebase deploy --only hosting,firestore,storage,functions
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Error al desplegar a Firebase.
    echo Si tus credenciales expiraron, usa la opcion [7] del menu o ejecuta autenticar_servicios.bat.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo [EXITO] Despliegue completo terminado correctamente en produccion.
if "%~1"=="" pause
if not "%~1"=="" exit /b 0
goto MENU

:DEPLOY_HOSTING
cls
echo ===============================================================================
echo  DESPLIEGUE RAPIDO: Solo Hosting Frontend
echo ===============================================================================
echo.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error de compilacion.
    if "%~1"=="" pause
    goto MENU
)
call npx firebase deploy --only hosting
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error al desplegar hosting.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo [EXITO] Hosting actualizado.
if "%~1"=="" pause
if not "%~1"=="" exit /b 0
goto MENU

:DEPLOY_APPENGINE
cls
echo ===============================================================================
echo  DESPLIEGUE A GOOGLE APP ENGINE (gcloud app deploy)
echo ===============================================================================
echo.
echo Compilando bundle de produccion...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Error de compilacion.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo Desplegando a Google App Engine usando app.yaml...
call gcloud app deploy app.yaml --project=control-de-bolsas-89c88 --quiet
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Fallo gcloud app deploy.
    echo Asegurate de tener instalado Google Cloud SDK y haber ejecutado gcloud auth login.
    if "%~1"=="" pause
    goto MENU
)
echo.
echo [EXITO] Despliegue en Google App Engine finalizado.
if "%~1"=="" pause
if not "%~1"=="" exit /b 0
goto MENU

:SYNC_GIT
cls
echo ===============================================================================
echo  SINCRONIZACION CON GITHUB (origin/main)
echo ===============================================================================
echo.
echo 1. Verificando estado del repositorio...
git status -s
echo.
echo 2. Descargando ramas remotas...
git fetch origin
echo.
echo 3. Ultimos commits en origin/main:
git log --oneline -n 5 origin/main
echo.
set "DO_MERGE="
set /p "DO_MERGE=Deseas combinar los cambios de origin/main ahora? [S/N]: "
if defined DO_MERGE set "DO_MERGE=%DO_MERGE: =%"
if /i "%DO_MERGE%"=="S" (
    git merge origin/main --no-edit
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo [AVISO] Ocurrio un conflicto al combinar. Revisa los archivos.
    ) else (
        echo.
        echo [OK] Combinacion exitosa.
    )
)
if "%~1"=="" pause
if not "%~1"=="" exit /b 0
goto MENU

:DEV_SERVER
cls
echo ===============================================================================
echo  INICIANDO SERVIDOR LOCAL DE DESARROLLO (Vite)
echo ===============================================================================
echo  Presiona Ctrl + C en cualquier momento para detener el servidor.
echo.
call npm run dev
goto MENU

:AUTH_HELPER
cls
if exist "autenticar_servicios.bat" (
    call autenticar_servicios.bat
) else (
    echo No se encontro autenticar_servicios.bat
    if "%~1"=="" pause
)
goto MENU

:SALIR
echo.
echo Finalizando consola de control.
exit /b 0
