@echo off
chcp 65001 >nul
title Panel de Control - Bolsas v5
color 0B

:menu
cls
echo ========================================================
echo               PANEL DE CONTROL - BOLSAS V5
echo ========================================================
echo.
echo  1. Iniciar servidor de desarrollo (DEV)
echo  2. Compilar, Respaldar y Subir a Produccion (DEPLOY)
echo  3. Respaldar en GitHub solamente (PUSH)
echo  4. Configurar nueva instalacion (SETUP)
echo  5. Diagnosticar problemas (DIAGNOSTICO)
echo  6. Configurar Clave de Gemini AI
echo  7. Salir
echo.
echo ========================================================
set /p opcion="Elige una opcion (1-7): "

if "%opcion%"=="1" (
    call scripts\DEV.bat
    goto menu
)
if "%opcion%"=="2" (
    call scripts\INSTALL_AND_DEPLOY.bat
    pause
    goto menu
)
if "%opcion%"=="3" (
    call scripts\PUSH_TO_GIT.bat
    pause
    goto menu
)
if "%opcion%"=="4" (
    call scripts\SETUP.bat
    pause
    goto menu
)
if "%opcion%"=="5" (
    call scripts\DIAGNOSTICO.bat
    pause
    goto menu
)
if "%opcion%"=="6" (
    call scripts\CONFIGURAR_CLAVE_GEMINI.bat
    pause
    goto menu
)
if "%opcion%"=="7" (
    exit
)
goto menu
