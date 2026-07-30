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

echo  --- 1/6 Dependencias ---
REM npm ci en vez de npm install: reinstala exactamente lo que dice el
REM package-lock.json. Si una actualizacion cambio las dependencias, npm
REM install podria dejar el arbol viejo y el build fallaria de formas raras.
call npm ci
if errorlevel 1 (
  echo  [!] npm ci fallo. Intento con npm install...
  call npm install
)
call npm --prefix functions ci
if errorlevel 1 (
  echo  [!] npm ci de functions fallo. Intento con npm install...
  call npm --prefix functions install
)

echo.
echo  --- 2/6 Pruebas de la formula financiera ---
call npm test
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] Las pruebas fallaron. NO se despliega nada.
  echo      Algo cambio el resultado de los calculos de dinero.
  pause ^& exit /b 1
)
echo  [OK] Calculos verificados

echo.
echo  --- 3/6 Compilando ---
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
echo  --- 4/6 Reglas e indices ---
call firebase deploy --only firestore:rules,firestore:indexes,storage
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue de reglas. Me detengo aqui.
  pause & exit /b 1
)

echo.
echo  --- 5/6 Cloud Functions ---
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
echo  --- 6/6 Hosting ---
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
