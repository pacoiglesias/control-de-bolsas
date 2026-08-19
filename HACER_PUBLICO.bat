@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Hacer el repositorio publico
color 0E
cls
echo.
echo  ============================================================
echo    HACER PUBLICO EL REPOSITORIO DE GITHUB
echo  ============================================================
echo.
echo   [!] Ojo: esto es lo contrario de PROTEGER_CODIGO.bat.
echo       Cualquiera en internet va a poder ver y descargar todo
echo       el codigo del repositorio, incluido su historial.
echo.
echo   No se sube ningun archivo nuevo por hacer esto -- .env,
echo   .firebase y demas ya estan excluidos por el .gitignore y
echo   nunca han llegado al repo. Pero si algun secreto llegara a
echo   estar en el historial de commits, quedaria visible tambien.
echo.
cd /d "%~dp0"

where gh >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro el CLI de GitHub ^(gh^) instalado.
  echo      Corre INSTALAR_GH.bat primero.
  pause
  exit /b 1
)

echo  --- Verificando sesion de GitHub ---
call gh auth status >nul 2>nul
if errorlevel 1 (
  echo  [!] No hay sesion activa. Abriendo el navegador para que
  echo      inicies sesion tu mismo...
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
  pause & exit /b 1
)

set "REPO="
for /f "tokens=*" %%r in ('gh repo view --json nameWithOwner -q ".nameWithOwner" 2^>nul') do set "REPO=%%r"
if "!REPO!"=="" (
  color 0C
  echo  [X] No pude detectar el repo de GitHub desde esta carpeta.
  pause & exit /b 1
)

echo  [OK] Repositorio detectado: !REPO!
echo.
set "CONFIRMAR="
set /p CONFIRMAR="  Seguro que quieres hacer '!REPO!' PUBLICO? (escribe si): "
if /i not "!CONFIRMAR!"=="si" (
  echo  [-] Cancelado. No se hizo ningun cambio.
  pause
  exit /b 0
)

echo.
echo  --- Cambiando a publico ---
call gh repo edit "!REPO!" --visibility public --accept-visibility-change-consequences
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo cambiar la visibilidad. Revisa el mensaje de arriba.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. El repositorio !REPO! ya quedo publico.
echo    Para volver a protegerlo, corre PROTEGER_CODIGO.bat
echo  ============================================================
pause
exit /b 0
