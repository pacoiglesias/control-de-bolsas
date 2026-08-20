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
REM FIX: aqui decia GOOGLE_GENAI_API_KEY, pero el codigo real
REM (functions/src/ai/extractor.ts, defineSecret) espera un secreto
REM llamado GEMINI_API_KEY. Con el nombre viejo, este script guardaba la
REM clave en un secreto que la funcion nunca lee -- el lector de PDFs con
REM IA se quedaba sin clave real aunque este script dijera "LISTO".
call firebase functions:secrets:set GEMINI_API_KEY
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
