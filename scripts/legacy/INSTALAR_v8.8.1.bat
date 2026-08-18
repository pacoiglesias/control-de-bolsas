@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar v8.8.1 - Fix invoiceStatuses en Kanban
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR v8.8.1  -  Fix: Kanban desincronizaba invoiceStatuses
echo  ============================================================
echo.
echo   Este instalador NO BORRA NADA. Solo copia 5 archivos:
echo     - src/components/Orders/KanbanBoard.tsx
echo     - src/lib/importExcel.ts
echo     - package.json
echo     - CHANGELOG.md
echo     - AUDIT_NOTEBOOK.md
echo   Respalda tu proyecto completo antes de tocar nada. Respeta
echo   .env, .firebaserc, node_modules, dist y .git.
echo.
echo   QUE CORRIGE:
echo     - Al mover una tarjeta en el Kanban, el sistema guardaba el
echo       nuevo estatus de la factura pero NO actualizaba el campo
echo       invoiceStatuses (usado por el barrido nocturno de vencidas
echo       y por el Dashboard). La orden podia quedar invisible para
echo       la deteccion automatica de vencidas hasta abrirla y
echo       guardarla a mano.
echo.

cd /d "%~dp0"

REM ---------- 1. Estamos en la carpeta del proyecto? ----------
if not exist "firebase.json" (
  echo  [!] No veo firebase.json aqui:
  echo      %CD%
  echo.
  echo      Esto pasa si el .bat y el .zip estan en Descargas
  echo      en vez de la carpeta del proyecto Control Bolsas.
  echo.
  set /p DESTINO="  Pega la ruta de la carpeta del proyecto: "
  if "!DESTINO!"=="" (
    color 0C
    echo  [X] Necesito la ruta del proyecto para continuar.
    pause & exit /b 1
  )
  if not exist "!DESTINO!\firebase.json" (
    color 0C
    echo  [X] En esa ruta tampoco hay firebase.json. Cancelo para no regarla.
    pause & exit /b 1
  )
  set "PROYECTO=!DESTINO!"
) else (
  set "PROYECTO=%CD%"
)
echo  [OK] Destino: !PROYECTO!

REM ---------- 2. Localizar el ZIP de este parche ----------
set "ZIPFILE="
set CUANTOS=0
for %%z in ("%~dp0*.zip") do (
  set /a CUANTOS+=1
  set "ZIPFILE=%%~fz"
  set "ZIP!CUANTOS!=%%~fz"
)
if !CUANTOS!==0 (
  color 0C
  echo.
  echo  [X] No encontre ningun .zip junto a este .bat.
  echo      Deja "PARA-CLAUDE_parche_v8_8_1.zip" en esta misma carpeta.
  pause & exit /b 1
)
if !CUANTOS! GTR 1 (
  echo.
  echo  Encontre varios ZIP:
  for /l %%i in (1,1,!CUANTOS!) do (
    for %%f in ("!ZIP%%i!") do echo      %%i - %%~nxf
  )
  set /p ELEGIDO="  Cual instalo? [1]: "
  if "!ELEGIDO!"=="" set ELEGIDO=1
  for %%v in (!ELEGIDO!) do set "ZIPFILE=!ZIP%%v!"
)
for %%f in ("!ZIPFILE!") do echo  [OK] Paquete: %%~nxf

REM ---------- 3. Descomprimir a temporal ----------
set "TMPDIR=%TEMP%\cb_v881_%RANDOM%"
echo  [..] Descomprimiendo...
powershell -NoProfile -Command "try{ Expand-Archive -LiteralPath '!ZIPFILE!' -DestinationPath '!TMPDIR!' -Force; exit 0 }catch{ exit 1 }"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo descomprimir. El archivo puede estar incompleto.
  echo      Vuelve a descargarlo e intenta otra vez.
  pause & exit /b 1
)

REM ---------- 4. Si el ZIP trae carpeta raiz, entrar en ella ----------
set "ORIGEN=!TMPDIR!"
if not exist "!TMPDIR!\package.json" (
  for /d %%d in ("!TMPDIR!\*") do (
    if exist "%%d\package.json" set "ORIGEN=%%~fd"
  )
)
echo  [OK] Contenido listo

REM ---------- 5. RESPALDO COMPLETO antes de tocar nada ----------
for /f "tokens=1-6 delims=/: " %%a in ("%DATE% %TIME%") do set "SELLO=%%c%%b%%a_%%d%%e"
set "SELLO=!SELLO: =0!"
set "BACKUP=!PROYECTO!\_respaldo_!SELLO!"
set "BACKUP_LOG=%TEMP%\cb_respaldo_log_881.txt"

if exist "!PROYECTO!\.gitignore" (
  findstr /c:"_respaldo_" "!PROYECTO!\.gitignore" >nul 2>nul
  if errorlevel 1 (
    echo.>> "!PROYECTO!\.gitignore"
    echo # Respaldos del instalador>> "!PROYECTO!\.gitignore"
    echo _respaldo_*/>> "!PROYECTO!\.gitignore"
    echo *.zip>> "!PROYECTO!\.gitignore"
  )
)

echo  [..] Respaldando tu proyecto completo en:
echo       _respaldo_!SELLO!
REM Rutas COMPLETAS en /XD: un nombre suelto como "lib" excluye esa carpeta
REM en CUALQUIER nivel (asi se perdio src\lib en un incidente anterior,
REM ver AUDIT_NOTEBOOK.md). /R:2 /W:2 para fallar rapido y visible si algo
REM esta bloqueado, en vez de colgarse en silencio.
robocopy "!PROYECTO!" "!BACKUP!" /E /XD "!PROYECTO!\node_modules" "!PROYECTO!\dist" "!PROYECTO!\.git" "!PROYECTO!\.firebase" "!PROYECTO!\functions\node_modules" "!PROYECTO!\functions\lib" _respaldo_* /XF useDashboardStats.ts /R:2 /W:2 /LOG:"!BACKUP_LOG!"
if errorlevel 8 (
  color 0C
  echo  [X] Fallo el respaldo. NO instalo nada para no arriesgar tus datos.
  echo.
  echo      Ultimas lineas del registro ^(!BACKUP_LOG!^):
  echo      ------------------------------------------------------------
  powershell -NoProfile -Command "Get-Content -Tail 20 '!BACKUP_LOG!'" 2>nul
  echo      ------------------------------------------------------------
  echo.
  echo      Causas mas comunes: un archivo abierto en otro programa,
  echo      OneDrive sincronizando la carpeta, o el antivirus revisando
  echo      node_modules en ese instante. Cierra lo que tengas abierto
  echo      del proyecto y vuelve a intentarlo.
  rd /s /q "!TMPDIR!" >nul 2>nul
  pause & exit /b 1
)
echo  [OK] Respaldo completo hecho

REM ---------- 6. Copiar SOLO los 5 archivos de este parche ----------
REM /IS /IT: sin esto, robocopy compara fecha/tamano y SE SALTA EN SILENCIO
REM cualquier archivo que en el destino "parezca" igual o mas nuevo.
set "MERGE_LOG=%TEMP%\cb_instalacion_log_881.txt"
echo  [..] Instalando la v8.8.1...
echo.
robocopy "!ORIGEN!" "!PROYECTO!" /E /IS /IT /R:2 /W:2 /LOG:"!MERGE_LOG!"
set RC=%ERRORLEVEL%
if !RC! GEQ 8 (
  color 0C
  echo  [X] Hubo errores al copiar. Tu respaldo esta intacto en:
  echo      !BACKUP!
  echo.
  echo      Ultimas lineas del registro ^(!MERGE_LOG!^):
  echo      ------------------------------------------------------------
  powershell -NoProfile -Command "Get-Content -Tail 20 '!MERGE_LOG!'" 2>nul
  echo      ------------------------------------------------------------
  rd /s /q "!TMPDIR!" >nul 2>nul
  pause & exit /b 1
)

rd /s /q "!TMPDIR!" >nul 2>nul

REM ---------- 7. Verificacion post-instalacion ----------
echo.
echo  --- Verificando que todo compile (tsc) ---
cd /d "!PROYECTO!"
call npm run typecheck
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] El typecheck fallo despues de instalar. Tu respaldo esta en:
  echo      !BACKUP!
  echo      Revisa el error de arriba antes de desplegar nada.
  pause & exit /b 1
)
echo  [OK] Typecheck limpio

color 0A
echo.
echo  ============================================================
echo    v8.8.1 INSTALADA
echo.
echo    Se respeto: .env, .firebaserc, node_modules, dist, .git
echo    Tu version anterior completa quedo en:
echo      _respaldo_!SELLO!
echo  ============================================================
echo.
echo   Siguiente paso sugerido:
echo     1  INSTALL_AND_DEPLOY.bat   (build + deploy a Firebase)
echo     2  Prueba mover una tarjeta en el Kanban y confirma que
echo        no truena y que el estatus se refleja bien en Dashboard
echo     3  PUSH_TO_GIT.bat          (subir a GitHub + respaldo)
echo.
set /p SIG="  Corro INSTALL_AND_DEPLOY.bat ahora? (s/n): "
if /i "!SIG!"=="s" (
  if exist "INSTALL_AND_DEPLOY.bat" (
    call INSTALL_AND_DEPLOY.bat
  ) else (
    echo  [!] No encontre INSTALL_AND_DEPLOY.bat en el proyecto.
  )
)
exit /b 0
