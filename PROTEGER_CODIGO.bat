@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Proteger Codigo (repo privado)
color 0B
cls
echo.
echo  ============================================================
echo    PROTEGER CODIGO - Hacer el repositorio de GitHub privado
echo  ============================================================
echo.
echo   Esta version ya NO pide pegar ningun Token de GitHub.
echo   Usa el CLI oficial de GitHub (gh), que guarda tu sesion de
echo   forma segura en este usuario de Windows -- igual que hace
echo   Firebase con "firebase login". Nunca escribes ni pegas
echo   ninguna clave en esta ventana.
echo.
cd /d "%~dp0"

where gh >nul 2>nul
if errorlevel 1 (
  color 0E
  echo  [!] No encuentro el CLI de GitHub ^(gh^) instalado.
  echo.
  echo      Instalalo con uno de estos metodos y vuelve a correr
  echo      este script:
  echo        winget install --id GitHub.cli
  echo      o descargalo de: https://cli.github.com
  echo.
  pause
  exit /b 1
)

echo  --- Verificando sesion de GitHub ---
call gh auth status >nul 2>nul
if errorlevel 1 (
  echo  [!] No hay sesion activa. Voy a abrir tu navegador para que
  echo      inicies sesion tu mismo ^(gh nunca ve ni guarda tu
  echo      contrasena, solo confirmas con un clic^)...
  call gh auth login --web --git-protocol https
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudo iniciar sesion en GitHub.
    pause & exit /b 1
  )
) else (
  echo  [OK] Sesion de GitHub activa
)

echo.
echo  --- Detectando el repositorio ---
if not exist ".git" (
  color 0C
  echo  [X] Esta carpeta no es un repositorio git todavia.
  echo      Corre PUSH_TO_GIT.bat primero para inicializarlo.
  pause & exit /b 1
)

set "REPO="
for /f "tokens=*" %%r in ('gh repo view --json nameWithOwner -q ".nameWithOwner" 2^>nul') do set "REPO=%%r"
if "!REPO!"=="" (
  color 0C
  echo  [X] No pude detectar el repo de GitHub desde esta carpeta.
  echo      Revisa que ya hayas corrido PUSH_TO_GIT.bat al menos
  echo      una vez, y que el remoto "origin" apunte a GitHub.
  pause & exit /b 1
)

echo  [OK] Repositorio detectado: !REPO!
echo.
echo  --- Cambiando a privado ---
call gh repo edit "!REPO!" --visibility private --accept-visibility-change-consequences
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo cambiar la visibilidad. Revisa el mensaje de arriba.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. El repositorio !REPO! ya quedo privado.
echo  ============================================================
pause
exit /b 0
