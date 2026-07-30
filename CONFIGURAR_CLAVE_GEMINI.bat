@echo off
chcp 65001 >nul
title Control Bolsas - Clave de Gemini
color 0B
cls
echo.
echo  ============================================================
echo    CONFIGURAR LA CLAVE DE GEMINI (lectura de PDFs)
echo  ============================================================
echo.
echo   La clave se guarda como SECRETO en Google Cloud, no en un
echo   archivo. Nunca queda en el repositorio ni en el respaldo.
echo.
echo   Si no tienes una: https://aistudio.google.com/apikey
echo.
cd /d "%~dp0"

where firebase >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] Firebase CLI no instalado. Corre CONECTAR_FIREBASE.bat primero.
  pause & exit /b 1
)

echo  [..] A continuacion pega la clave y presiona Enter.
echo       No se va a ver mientras la escribes: es normal.
echo.
call firebase functions:secrets:set GOOGLE_GENAI_API_KEY
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo guardar la clave.
  pause & exit /b 1
)

echo.
echo  [!] IMPORTANTE: la clave nueva no aplica hasta volver a
echo      desplegar las funciones.
echo.
set /p D="  Despliego las funciones ahora? (s/n): "
if /i "%D%"=="s" (
  call npm --prefix functions run build
  call firebase deploy --only functions
)

color 0A
echo.
echo  ============================================================
echo    LISTO.
echo  ============================================================
pause
exit /b 0
