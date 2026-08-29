@echo off
title Renovacion de Autenticacion MCP
cd /d "%~dp0"
echo =======================================================================
echo     RENOVANDO CREDENCIALES DE GOOGLE CLOUD Y FIREBASE MCP
echo =======================================================================
echo.
echo Paso 1: Renovando Google Cloud ADC...
echo Se abrira tu navegador para autorizar la cuenta.
echo.
call gcloud auth application-default login
echo.
echo Paso 2: Renovando Firebase CLI...
call npx firebase login --reauth
echo.
echo Paso 3: Fijando proyecto control-de-bolsas-89c88...
call npx firebase use control-de-bolsas-89c88
echo.
echo =======================================================================
echo  LISTO! Ya puedes volver a usar el servidor MCP de Firestore.
echo =======================================================================
pause
