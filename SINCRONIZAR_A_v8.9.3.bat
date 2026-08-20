@echo off
REM FIX: al hacerle doble clic a un .bat, Windows abre una ventana que se
REM cierra SOLA en cuanto el script termina -- ya sea que termine bien o
REM que truene a medio camino. Eso es lo que reportaste: "se cierra
REM repentinamente, no se si hizo o no el deploy". Los "pause" que ya tiene
REM este script no sirven si algo revienta el interprete de cmd.exe mismo
REM (no solo un comando que falla con codigo de error). El arreglo estandar
REM es que el .bat se relance a si mismo dentro de una ventana nueva abierta
REM con "cmd /k", que Windows garantiza que se queda abierta pase lo que
REM pase, para siempre, hasta que tu la cierres a mano.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Sincronizar v8.9.3" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Sincronizar a v8.9.3 + Build + Deploy
color 0B
cls
echo.
echo  ============================================================
echo    SINCRONIZAR C:\pacoputo A LA VERSION v8.9.3
echo  ============================================================
echo.
echo   Tu sitio en linea sigue en v8.8.5 -- ninguno de los parches
echo   de esta sesion (v8.8.6 a v8.9.2) llego a desplegarse todavia.
echo   En vez de pedirte que corras 7 instaladores de parche en
echo   orden (facil de brincarse uno sin querer, que es la causa
echo   mas probable de que el build/deploy no jalara), este script
echo   deja tu carpeta EXACTA como el proyecto verificado mas
echo   reciente en un solo paso, y luego compila y despliega.
echo.
echo   No borra nada tuyo: primero hace un respaldo completo de
echo   toda la carpeta actual, y la sincronizacion nunca toca tu
echo   archivo .env (tus claves reales se quedan como estan).
echo.

cd /d "%~dp0"

set "ZIPFILE=SINCRONIZAR_v8_9_3.zip"
if not exist "%ZIPFILE%" (
  color 0C
  echo  [X] No encuentro "%ZIPFILE%" junto a este .bat.
  pause
  exit /b 1
)
if not exist "firebase.json" (
  color 0C
  echo  [X] Este .bat debe estar DENTRO de la carpeta del proyecto
  echo      ^(donde ya esta firebase.json^), no en otro lado.
  pause
  exit /b 1
)

echo  --- Version actual antes de sincronizar ---
if exist "package.json" (
  for /f "tokens=2 delims=:," %%v in ('findstr /c:"\"version\"" package.json') do (
    echo   package.json dice: %%v
  )
)
echo.

set /p CONFIRMAR="  Listo para sincronizar y desplegar v8.9.3? (s/n): "
if /i not "%CONFIRMAR%"=="s" (
  echo  Cancelado.
  pause
  exit /b 0
)

set "TS=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"
set "BACKUP=_respaldo_pre_v8.9.3_%TS%"
echo.
echo  --- Respaldando el proyecto completo en "%BACKUP%" ---
robocopy "%~dp0." "%~dp0%BACKUP%" /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" /XF *.log >nul
echo  [OK] Respaldo hecho en "%BACKUP%"

echo.
echo  --- Extrayendo la version sincronizada ---
set "TMPEXTRACT=%TEMP%\cb_sync893_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Copiando archivos ^(tu .env NO se toca^) ---
REM /E copia todo incluyendo subcarpetas nuevas, pero NO borra archivos que
REM tengas en C:\pacoputo y no vengan en el paquete (por ejemplo tu .env,
REM o cualquier archivo tuyo que hayas agregado aparte). Eso es a proposito:
REM "nunca borres nada sin mi consentimiento".
robocopy "%TMPEXTRACT%" "%~dp0." /E /XF ".env" >nul
echo  [OK] Archivos sincronizados a v8.9.3
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

if not exist ".env" (
  color 0E
  echo.
  echo  [!] No encuentro un archivo .env en esta carpeta. Sin el, el
  echo      build/deploy va a fallar mas abajo. Corre DIAGNOSTICO.bat
  echo      o CONECTAR_FIREBASE.bat para crearlo antes de continuar.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    SINCRONIZADO. Ahora: instalar dependencias + typecheck +
echo    pruebas + build + deploy, todo con INSTALAR_BUILD_DEPLOY.bat
echo    ^(el mismo script robusto que ya maneja reintentos y el
echo    ajuste de tiempo de espera para Windows^).
echo  ============================================================
echo.
if exist "INSTALAR_BUILD_DEPLOY.bat" (
  call INSTALAR_BUILD_DEPLOY.bat _EN_VENTANA_FIJA_
) else (
  color 0C
  echo  [X] No encuentro INSTALAR_BUILD_DEPLOY.bat -- algo salio mal
  echo      con la sincronizacion. Avisale a Claude.
  pause
  exit /b 1
)
