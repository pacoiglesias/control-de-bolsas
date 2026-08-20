@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Traer el historial de git a C:\pacoputo
color 0B
cls
echo.
echo  ============================================================
echo    TRAER .git DE TU USB A C:\pacoputo
echo    (arreglo de un error mio: COPIAR_A_DISCO_C.bat excluyo
echo     la carpeta .git a proposito, y por eso SUBIR_CAMBIOS.bat
echo     no encontraba un repositorio git en C:\pacoputo)
echo  ============================================================
echo.

set "ORIGEN=D:\CONTROL  FACTURAS PROVIDENCIA\.git"
set "DESTINO=C:\pacoputo\.git"

if not exist "%ORIGEN%" (
  color 0C
  echo  [X] No encuentro "%ORIGEN%".
  echo      Si tu USB tiene otra letra o el nombre de la carpeta es
  echo      distinto, avisame y ajusto la ruta.
  pause
  exit /b 1
)

if not exist "C:\pacoputo" (
  color 0C
  echo  [X] No existe C:\pacoputo todavia. Corre primero COPIAR_A_DISCO_C.bat.
  pause
  exit /b 1
)

if exist "%DESTINO%" (
  echo  [!] C:\pacoputo\.git ya existe -- no se va a tocar ni sobreescribir.
  echo      Si quieres empezar de cero, borra esa carpeta tu mismo primero.
  pause
  exit /b 0
)

echo  --- Copiando el historial de git (puede tardar segun el tamano) ---
robocopy "%ORIGEN%" "%DESTINO%" /E /R:2 /W:2
if %ERRORLEVEL% GEQ 8 (
  color 0C
  echo  [X] robocopy reporto un error real. Revisa arriba.
  pause
  exit /b 1
)

echo.
echo  --- Verificando ---
cd /d "C:\pacoputo"
git status >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] Se copio la carpeta pero "git status" fallo. Puede que
  echo      necesites tener git instalado en esta compu.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. C:\pacoputo ya es un repositorio git de verdad.
echo    Ahora si puedes correr SUBIR_CAMBIOS.bat desde aqui.
echo  ============================================================
echo.
pause
exit /b 0
