@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Copiar proyecto a disco C:
color 0B
cls
echo.
echo  ============================================================
echo    COPIAR PROYECTO DE USB A DISCO C:
echo  ============================================================
echo.
echo   Copia el proyecto completo (menos node_modules, dist, y otras
echo   carpetas pesadas que se regeneran solas) a:
echo     C:\pacoputo
echo.
echo   Es una COPIA, no un "mover" -- no borra ni toca nada aqui en
echo   la USB.
echo.
cd /d "%~dp0"

set "DESTINO=C:\pacoputo"

if exist "%DESTINO%" (
  echo  [!] La carpeta "%DESTINO%" ya existe.
  set /p CONT="  Continuar y actualizarla con lo que hay aqui? (s/n): "
  if /i not "!CONT!"=="s" (
    echo  [-] Cancelado.
    pause
    exit /b 0
  )
)

echo.
echo  --- Copiando (puede tardar varios minutos leyendo desde USB) ---
robocopy "%~dp0." "%DESTINO%" /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" /XF *.log /R:2 /W:2
set RC=%ERRORLEVEL%
REM robocopy usa codigos de salida distintos a la mayoria de programas:
REM 0-7 es exito (con distintos matices), 8 o mas es error real.
if %RC% GEQ 8 (
  color 0C
  echo  [X] robocopy reporto errores ^(codigo %RC%^). Revisa el detalle arriba.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. Copiado a %DESTINO%
echo  ============================================================
echo.
echo   Siguiente paso, DENTRO de esa carpeta nueva (no aqui en la
echo   USB), corre una sola vez:
echo     npm ci
echo     npm --prefix functions ci
echo   Ahi va a ser mucho mas rapido que en la USB.
echo.
echo   IMPORTANTE: si sigues editando en las DOS copias (USB y C:)
echo   vas a terminar con versiones distintas del codigo sin darte
echo   cuenta. Elige UNA como tu carpeta de trabajo real -- se
echo   recomienda C:\pacoputo de aqui en adelante -- y deja la USB
echo   solo como respaldo ocasional.
echo.
set /p ABRIR="  Abro la carpeta C:\pacoputo en el explorador? (s/n): "
if /i "!ABRIR!"=="s" start "" explorer "%DESTINO%"
pause
exit /b 0
