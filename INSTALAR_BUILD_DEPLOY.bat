@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar, Compilar y Desplegar
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR + BUILD + DEPLOY  -  Control Bolsas ERP
echo  ============================================================
echo.
echo   Este script deja el sistema listo de punta a punta:
echo     1. Dependencias (raiz y functions)
echo     2. Typecheck (tsc --noEmit, raiz y functions)
echo     3. Pruebas unitarias (formulas financieras)
echo     4. Lint (ESLint)
echo     5. Build (tsc -b + vite build + functions build)
echo     6. Deploy: Reglas/Indices -^> Cloud Functions -^> Hosting
echo.
echo   No borra nada. Solo instala, compila y despliega lo que ya
echo   esta en esta carpeta.
echo.

cd /d "%~dp0"

REM ---------- 0. Verificaciones basicas ----------
if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause & exit /b 1
)
if not exist ".env" (
  color 0C
  echo  [X] Falta el archivo .env. Corre DIAGNOSTICO.bat primero.
  pause & exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro Node.js instalado. Instalalo desde https://nodejs.org
  pause & exit /b 1
)
where firebase >nul 2>nul
if errorlevel 1 (
  color 0E
  echo  [!] No encuentro el CLI de firebase en PATH ^(firebase-tools^).
  echo      Si el deploy falla mas abajo, instalalo con:
  echo        npm install -g firebase-tools
  echo.
)

echo  --- 1/6 Dependencias ---
REM npm ci en vez de npm install: reinstala exactamente lo que dice el
REM package-lock.json. Si npm ci falla ^(por ejemplo el lock no esta
REM sincronizado^), se cae a npm install para no dejar al usuario varado.
call npm ci
if errorlevel 1 (
  echo  [!] npm ci fallo. Intento con npm install...
  call npm install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de la raiz.
    pause & exit /b 1
  )
)
call npm --prefix functions ci
if errorlevel 1 (
  echo  [!] npm ci de functions fallo. Intento con npm install...
  call npm --prefix functions install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de functions.
    pause & exit /b 1
  )
)
echo  [OK] Dependencias instaladas

echo.
echo  --- 2/6 Typecheck ^(tsc --noEmit^) ---
call npm run typecheck
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] El typecheck del frontend fallo. NO se despliega nada.
  pause & exit /b 1
)
pushd functions
call npx tsc --noEmit
set RC_FN_TSC=!ERRORLEVEL!
popd
if !RC_FN_TSC! NEQ 0 (
  color 0C
  echo.
  echo  [X] El typecheck de Cloud Functions fallo. NO se despliega nada.
  pause & exit /b 1
)
echo  [OK] Typecheck limpio ^(frontend y functions^)

echo.
echo  --- 3/6 Pruebas unitarias ^(formulas financieras^) ---
call npm test
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] Las pruebas fallaron. NO se despliega nada.
  echo      Algo cambio el resultado de los calculos de dinero.
  pause & exit /b 1
)
echo  [OK] Pruebas verificadas

echo.
echo  --- 4/6 Lint ^(ESLint^) ---
call npm run lint
if errorlevel 1 (
  color 0E
  echo.
  echo  [!] ESLint encontro errores. Revisa arriba antes de continuar.
  set /p CONTINUAR_LINT="  Continuo de todos modos con el build/deploy? (s/n): "
  if /i not "!CONTINUAR_LINT!"=="s" (pause & exit /b 1)
) else (
  echo  [OK] Lint limpio
)

echo.
echo  --- 5/6 Compilando ^(tsc -b + vite build + functions build^) ---
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
echo  --- 6/6 Deploy a Firebase ---
echo   Orden del despliegue ^(importante, no lo cambies^):
echo     a^) Reglas e indices   - la seguridad primero
echo     b^) Cloud Functions    - el backend
echo     c^) Hosting            - la interfaz al final
echo   Si el frontend subiera antes que las reglas, habria unos
echo   segundos en que la app nueva pega contra reglas viejas.
echo.

echo  --- 6a. Reglas e indices ---
call firebase deploy --only firestore:rules,firestore:indexes,storage
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue de reglas. Me detengo aqui.
  pause & exit /b 1
)

echo.
echo  --- 6b. Cloud Functions ---
call firebase deploy --only functions
if errorlevel 1 (
  color 0E
  echo  [!] Fallo el despliegue de funciones.
  echo      Si el error menciona la clave GOOGLE_GENAI_API_KEY,
  echo      corre CONFIGURAR_CLAVE_GEMINI.bat.
  set /p CONTINUAR_FN="  Continuo con el frontend de todos modos? (s/n): "
  if /i not "!CONTINUAR_FN!"=="s" (pause & exit /b 1)
)

echo.
echo  --- 6c. Hosting ---
call firebase deploy --only hosting
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue del frontend.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    INSTALACION + BUILD + DEPLOY COMPLETOS
echo    https://control-de-bolsas-69.web.app
echo.
echo    REGLA DE ORO: despues de desplegar, SIEMPRE
echo      1. git add / commit / push
echo      2. pwsh .\backup.ps1
echo  ============================================================
echo.
set /p GITPUSH="  Corro PUSH_TO_GIT.bat ahora? (s/n): "
if /i "!GITPUSH!"=="s" (
  if exist "PUSH_TO_GIT.bat" (
    call PUSH_TO_GIT.bat
  ) else (
    echo  [!] No encontre PUSH_TO_GIT.bat en el proyecto.
  )
)
pause
exit /b 0
