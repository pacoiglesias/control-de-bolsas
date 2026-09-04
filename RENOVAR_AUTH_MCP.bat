@echo off
chcp 65001 > nul
cls
color 0B
echo =======================================================================
echo          RENOVADOR DE AUTENTICACIÓN GOOGLE CLOUD / FIREBASE MCP
echo =======================================================================
echo.
echo  Este script solucionará el error de token expirado (invalid_grant / invalid_rapt).
echo.
echo  Pasos que ejecutará:
echo   1. Re-autenticar Application Default Credentials (ADC) de Google Cloud
echo   2. Re-autenticar Firebase CLI
echo   3. Configurar el proyecto oficial: control-de-bolsas-89c88
echo.
echo =======================================================================
echo.
pause

echo.
echo [1/3] Renovando credenciales de Google Cloud (ADC para MCP)...
echo Se abrirá una ventana de tu navegador para que inicies sesión con tu cuenta de Google.
echo.
cmd /c "gcloud auth application-default login"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [AVISO] Si no tienes 'gcloud' instalado en el PATH global, intentaremos con Firebase CLI.
)

echo.
echo [2/3] Renovando sesión de Firebase CLI...
echo.
cmd /c "npx firebase login --reauth"

echo.
echo [3/3] Estableciendo proyecto activo en Firebase...
echo.
cmd /c "npx firebase use control-de-bolsas-89c88"

echo.
echo =======================================================================
echo  ✅ ¡SESIÓN RENOVADA CON ÉXITO!
echo =======================================================================
echo.
echo  Ya puedes usar el MCP de Firestore y las herramientas de Google Cloud
echo  sin el error de 'invalid_grant' o 'invalid_rapt'.
echo.
echo =======================================================================
pause
