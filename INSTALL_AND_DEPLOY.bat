@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Construir y Desplegar
color 0B
cls
echo.
echo  ============================================================
echo    CONSTRUIR Y DESPLEGAR
echo  ============================================================
echo.
echo   Orden del despliegue (importante, no lo cambies):
echo     1. Reglas e indices   - la seguridad primero
echo     2. Cloud Functions    - el backend
echo     3. Hosting            - la interfaz al final
echo.
echo   Si el frontend subiera antes que las reglas, habria unos
echo   segundos en que la app nueva pega contra reglas viejas.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto.
  pause & exit /b 1
)
if not exist ".env" (
  color 0C
  echo  [X] Falta el archivo .env. Corre DIAGNOSTICO.bat.
  pause & exit /b 1
)

echo  --- 1/5 Dependencias ---
if not exist "node_modules" call npm install
if not exist "functions\node_modules" call npm --prefix functions install

echo.
echo  --- 2/5 Compilando ---
call npm run build
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] La compilacion fallo. NO se despliega nada.
  echo      Lee el error de arriba: casi siempre es un error de tipos.
  pause & exit /b 1
)
echo  [OK] Compilado

echo.
echo  --- 3/5 Reglas e indices ---
call firebase deploy --only firestore:rules,firestore:indexes,storage
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue de reglas. Me detengo aqui.
  pause & exit /b 1
)

echo.
echo  --- 4/5 Cloud Functions ---
call firebase deploy --only functions
if errorlevel 1 (
  color 0E
  echo  [!] Fallo el despliegue de funciones.
  echo      Si el error menciona la clave GOOGLE_GENAI_API_KEY,
  echo      corre CONFIGURAR_CLAVE_GEMINI.bat.
  set /p C="  Continuo con el frontend de todos modos? (s/n): "
  if /i not "!C!"=="s" (pause & exit /b 1)
)

echo.
echo  --- 5/5 Hosting ---
call firebase deploy --only hosting
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue del frontend.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    DESPLIEGUE COMPLETO
echo    https://control-de-bolsas-69.web.app
echo.
echo    REGLA DE ORO: despues de desplegar, SIEMPRE
echo      1. git add / commit / push
echo      2. pwsh .\backup.ps1
echo  ============================================================
echo.
set /p G="  Corro PUSH_TO_GIT.bat ahora? (s/n): "
if /i "!G!"=="s" (
  if exist "PUSH_TO_GIT.bat" (call PUSH_TO_GIT.bat) else (echo  [!] No encontre PUSH_TO_GIT.bat)
)
pause
exit /b 0
