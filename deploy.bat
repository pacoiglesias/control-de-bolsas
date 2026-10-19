@echo off
REM ============================================================
REM  Control de Bolsas ERP — Pipeline de Deploy Automatizado
REM  Uso: deploy.bat "mensaje de commit"
REM  Ejemplo: deploy.bat "fix: corrección de saldo Andrés"
REM ============================================================

setlocal
set COMMIT_MSG=%~1
if "%COMMIT_MSG%"=="" set COMMIT_MSG=chore: deploy automatizado

echo.
echo =========================================
echo  STEP 1/5 — Tests Unitarios
echo =========================================
call npx vitest run src/lib/__tests__
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Tests fallaron. Deploy cancelado.
    exit /b 1
)
echo [OK] Todos los tests aprobados.

echo.
echo =========================================
echo  STEP 2/5 — Build de Produccion
echo =========================================
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build fallo. Deploy cancelado.
    exit /b 1
)
echo [OK] Build exitoso.

echo.
echo =========================================
echo  STEP 3/5 — Git Commit
echo =========================================
git add -A
git diff --cached --quiet
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Sin cambios nuevos para commitear.
) else (
    git commit -m "%COMMIT_MSG%"
    echo [OK] Commit realizado.
)

echo.
echo =========================================
echo  STEP 4/6 — Firebase Deploy (Hosting + Firestore + Storage)
echo =========================================
call npx firebase deploy --only hosting,firestore,storage
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Firebase deploy fallo.
    exit /b 1
)
echo [OK] Firebase deploy completado.

echo.
echo =========================================
echo  STEP 5/6 — App Engine Deploy (Mirror SPA en Google Cloud)
for /f "tokens=*" %%v in ('node -e "console.log(require('./package.json').version.replace(/\./g, '-'))"') do set APP_VERSION=v%%v
if "%APP_VERSION%"=="" set APP_VERSION=v9-15-4
echo [INFO] Desplegando version App Engine: %APP_VERSION%
call gcloud app deploy app.yaml --project=control-de-bolsas-89c88 --quiet --version=%APP_VERSION%
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] App Engine deploy fallo — el hosting principal sigue activo.
) else (
    echo [OK] App Engine deploy completado.
)

echo.
echo =========================================
echo  STEP 6/6 — Git Push (respaldo remoto)
echo =========================================
git push origin main
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Push fallo — revisa conexion o credenciales.
) else (
    echo [OK] Push a origin/main exitoso.
)

echo.
echo =========================================
echo  PIPELINE COMPLETO - SISTEMA EN PRODUCCION
echo  🌐 Principal:   [https://bolsas.cobertores.com](https://bolsas.cobertores.com)
echo  ⚡ Firebase 69: https://control-de-bolsas-69.web.app
echo  ☁️ Firebase 89: https://control-de-bolsas-89c88.web.app
echo  🚀 App Engine:  https://control-de-bolsas-89c88.uc.r.appspot.com
echo =========================================
endlocal
