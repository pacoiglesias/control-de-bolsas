@echo off
color 0B
title Control Maestro - ERP Bolsas Providencia
chcp 65001 >nul

:menu
cls
echo =======================================================
echo     PANEL DE CONTROL MAESTRO - ERP BOLSAS PROVIDENCIA
echo =======================================================
echo Desarrollado por Paco Iglesias (c) 2026
echo.
echo Seleccione una opcion:
echo.
echo   1. Instalar / Reparar Sistema (npm install)
echo   2. Probar Sistema Localmente (npm run dev)
echo   3. Construir y Subir a Produccion Manualmente (firebase deploy)
echo   4. Salir
echo.
echo =======================================================
set /p opcion="Opcion: "

if "%opcion%"=="1" goto instalar
if "%opcion%"=="2" goto probar
if "%opcion%"=="3" goto subir
if "%opcion%"=="4" goto salir

echo Opcion invalida.
timeout /t 2 >nul
goto menu

:instalar
cls
echo =======================================================
echo Instalando y verificando dependencias...
echo =======================================================
call npm install
cd functions
call npm install
cd ..
echo.
echo ¡Instalacion completada!
pause
goto menu

:probar
cls
echo =======================================================
echo Iniciando servidor local de pruebas...
echo Presiona CTRL + C para detenerlo cuando termines.
echo =======================================================
call npm run dev
pause
goto menu

:subir
cls
echo =======================================================
echo Compilando y subiendo el sistema a Produccion...
echo =======================================================
REM FIX: esta opcion llamaba "npm run deploy" directo -- sin typecheck,
REM sin pruebas, sin el orden correcto (reglas antes que Cloud Functions
REM antes que Hosting), y sin el ajuste de FUNCTIONS_DISCOVERY_TIMEOUT que
REM evita el error "Timeout after 10000" al desplegar Cloud Functions desde
REM Windows con antivirus activo. Si alguna vez el deploy fallaba de forma
REM rara usando esta opcion del menu, esa era la causa mas probable. Ahora
REM usa el mismo script robusto que ya usan los instaladores de parches.
if exist "INSTALAR_BUILD_DEPLOY.bat" (
  call INSTALAR_BUILD_DEPLOY.bat
) else (
  echo  [!] No encontre INSTALAR_BUILD_DEPLOY.bat -- uso el metodo anterior.
  call npm run deploy
)
echo.
echo ¡Despliegue finalizado!
pause
goto menu

:salir
exit
