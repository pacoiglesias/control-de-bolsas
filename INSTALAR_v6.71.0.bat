@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar v6.71.0 - Ciclo 7
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR v6.71.0  -  CICLO 11 (carga inicial)
echo  ============================================================
echo.
echo   Este instalador NO BORRA NADA. Lo unico que hace es:
echo     - respaldar tu proyecto completo antes de tocar un archivo
echo     - copiar el proyecto v6.71.0 completo
echo     - respetar lo tuyo: .env, .firebaserc, node_modules,
echo       dist, .git y cualquier archivo que no venga en el ZIP
echo.
echo   CAUSA RAIZ REAL DEL SCROLL + FLECHAS DE NAVEGACION:
echo.
echo     - .modal-root / .modal-box / .modal-scrim NO TENIAN
echo       NINGUN estilo en todo el sistema -- el modal era un
echo       bloque normal sin limite de altura, por eso el
echo       scroll interno nunca se activaba. Ya es un overlay
echo       fijo de verdad, con su propio scroll funcional.
echo     - Flechas (izq/der) en los 3 tableros Kanban -- un
echo       clic los mueve, sin depender del mouse/trackpad.
echo     - "Ganancia Comercial" tenia margen por kilo inflado
echo       ($8.08/kg en vez de ~$5/kg) -- corregido el KPI de
echo       kilos totales.
echo.
echo   [i] Se detecto un duplicado real de datos (dos
echo       expedientes con las mismas facturas 5927/5928) --
echo       NO se borro nada, pendiente de que confirmes cual
echo       es el correcto.
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
  echo      Deja "control-bolsas-v6.71.0.zip" en esta misma carpeta.
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
set "TMPDIR=%TEMP%\cb_v671_%RANDOM%"
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
if not exist "!TMPDIR!\firebase.json" (
  for /d %%d in ("!TMPDIR!\*") do (
    if exist "%%d\firebase.json" set "ORIGEN=%%~fd"
  )
)
echo  [OK] Contenido listo

REM ---------- 5. RESPALDO COMPLETO antes de tocar nada ----------
for /f "tokens=1-6 delims=/: " %%a in ("%DATE% %TIME%") do set "SELLO=%%c%%b%%a_%%d%%e"
set "SELLO=!SELLO: =0!"
set "BACKUP=!PROYECTO!\_respaldo_!SELLO!"

REM NOTA: se probo el prefijo de rutas largas de Windows ("\\?\") para
REM cubrir el caso de un node_modules muy anidado, pero robocopy lo maneja
REM mal como ORIGEN en este entorno (ERROR 67 "no se encuentra el nombre de
REM red" sobre una ruta local perfectamente valida - es un problema conocido
REM de robocopy con ese prefijo, no de esta carpeta). Se retira por completo
REM y se vuelve al patron de rutas planas que ya usan el resto de los .bat
REM de este proyecto (INSTALL_AND_DEPLOY.bat, PUSH_TO_GIT.bat) sobre esta
REM misma carpeta, y que ya sabemos que funciona.
set "BACKUP_LOG=%TEMP%\cb_respaldo_log.txt"

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
REM ver AUDIT_NOTEBOOK.md). Aqui van con ruta completa a proposito, EXCEPTO
REM "_respaldo_*", que va como nombre suelto porque robocopy no acepta
REM comodines en una ruta completa de /XD.
REM /R:2 /W:2 en vez de los valores por omision de robocopy (hasta un millon
REM de reintentos, 30s de espera cada uno): si un archivo esta bloqueado
REM (antivirus, OneDrive, el propio editor), falla rapido y visible en vez
REM de quedarse colgado horas en silencio. /LOG (sin /NFL /NDL) deja registro
REM completo de que archivo fallo y por que, para diagnosticar sin adivinar.
robocopy "!PROYECTO!" "!BACKUP!" /E /XD "!PROYECTO!\node_modules" "!PROYECTO!\dist" "!PROYECTO!\.git" "!PROYECTO!\.firebase" "!PROYECTO!\functions\node_modules" "!PROYECTO!\functions\lib" _respaldo_* /R:2 /W:2 /LOG:"!BACKUP_LOG!"
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
  echo      OneDrive sincronizando la carpeta Descargas, o el antivirus
  echo      revisando node_modules en ese instante. Cierra lo que tengas
  echo      abierto del proyecto y vuelve a intentarlo.
  rd /s /q "!TMPDIR!" >nul 2>nul
  pause & exit /b 1
)
echo  [OK] Respaldo completo hecho

REM ---------- 6. Copiar SOLO los 21 archivos de este parche ----------
REM /IS /IT: sin esto, robocopy compara fecha/tamano y SE SALTA EN SILENCIO
REM cualquier archivo que en el destino "parezca" igual o mas nuevo. Si tu
REM copia local tiene fecha mas reciente que la del paquete, la correccion
REM nunca llegaria. /IS fuerza a copiar tambien los que se ven "iguales".
set "MERGE_LOG=%TEMP%\cb_instalacion_log.txt"
echo  [..] Instalando la v6.71.0...
echo.
robocopy "!ORIGEN!" "!PROYECTO!" /E /IS /IT /XD "!ORIGEN!\node_modules" "!ORIGEN!\dist" "!ORIGEN!\.git" "!ORIGEN!\functions\node_modules" "!ORIGEN!\functions\lib" /R:2 /W:2 /LOG:"!MERGE_LOG!"
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

REM ---------- 7. Dependencias: package.json/lock cambiaron de version ----------
echo.
echo  --- Sincronizando dependencias (npm ci) ---
cd /d "!PROYECTO!"
call npm ci
if errorlevel 1 (
  color 0E
  echo  [!] npm ci fallo en la raiz. Intento con npm install...
  call npm install
)
call npm --prefix functions ci
if errorlevel 1 (
  color 0E
  echo  [!] npm ci fallo en functions. Intento con npm install...
  call npm --prefix functions install
)

REM ---------- 8. Verificacion post-instalacion ----------
echo.
echo  --- Verificando que todo compile (tsc + build) ---
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
echo    v6.71.0 INSTALADA  -  CICLO 11
echo.
echo    Se respeto: .env, .firebaserc, node_modules, dist, .git
echo    Tu version anterior completa quedo en:
echo      _respaldo_!SELLO!
echo  ============================================================
echo.
echo   Siguiente paso sugerido:
echo     1  INSTALL_AND_DEPLOY.bat   (build + deploy a Firebase)
echo     2  En el panel: boton "Recalcular Indicadores"  ^<-- CLAVE
echo        Sin este paso el panel SEGUIRA en ceros: la agregacion
echo        necesita una siembra inicial una sola vez.
echo     3  Verifica que las cifras cuadren con Cobranza/Caja Chica
echo     4  PUSH_TO_GIT.bat          (subir a GitHub + respaldo)
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
