@echo off
REM Igual que los demas: se relanza en una ventana fija (cmd /k) para que
REM Windows nunca la cierre sola, pase lo que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Terminar Deploy (Hosting)" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Terminar Deploy (solo Hosting)
color 0B
cls
echo.
echo  ============================================================
echo    TERMINAR EL DEPLOY -- SOLO HOSTING
echo  ============================================================
echo.
echo   Uso este script SOLO si ya corriste INSTALAR_BUILD_DEPLOY.bat
echo   y viste que Reglas/Indices y Cloud Functions terminaron con
echo   "Deploy complete!", pero el script se cerro o trono antes de
echo   llegar al ultimo paso (Hosting). No repite typecheck, pruebas
echo   ni build -- solo sube lo que ya esta compilado en dist\.
echo.

cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause & exit /b 1
)
if not exist "dist" (
  color 0C
  echo  [X] No encuentro la carpeta dist\ ^(el build compilado^).
  echo      Corre INSTALAR_BUILD_DEPLOY.bat completo primero.
  pause & exit /b 1
)
where firebase >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro el CLI de firebase. Instalalo con:
  echo        npm install -g firebase-tools
  pause & exit /b 1
)

echo  --- Subiendo Hosting ---
call firebase deploy --only hosting
if errorlevel 1 (
  echo  [!] Primer intento fallo o el CLI reporto un error inesperado.
  echo      Reintentando una vez mas...
  call firebase deploy --only hosting
)
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue del frontend despues de 2 intentos.
  echo      Revisa arriba: si ya viste "Deploy complete!" con las URLs
  echo      antes del error, es muy probable que SI se haya publicado
  echo      bien -- entra a las URLs para confirmar antes de preocuparte.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    DEPLOY COMPLETO -- Hosting publicado
echo    https://control-de-bolsas-69.web.app
echo    https://control-de-bolsas-89c88.web.app
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
