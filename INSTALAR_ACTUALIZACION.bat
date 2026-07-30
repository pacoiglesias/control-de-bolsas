@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar actualizacion sin borrar nada
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR ACTUALIZACION
echo  ============================================================
echo.
echo   Este instalador NO BORRA NADA. Lo unico que hace es:
echo     - respaldar todo antes de tocar un solo archivo
echo     - copiar encima los archivos nuevos
echo     - respetar lo tuyo: .env, .firebaserc, node_modules,
echo       dist, .git y cualquier archivo que no venga en el ZIP
echo.

cd /d "%~dp0"

REM ---------- 1. Estamos en la carpeta del proyecto? ----------
if not exist "firebase.json" (
  echo  [!] No veo firebase.json aqui:
  echo      %CD%
  echo.
  echo      Esto pasa si el .bat y el .zip estan en Descargas
  echo      en vez de la carpeta del proyecto.
  echo.
  set /p DESTINO="  Pega la ruta de la carpeta del proyecto ^(o Enter para instalar aqui^): "
  if not "!DESTINO!"=="" (
    if not exist "!DESTINO!\firebase.json" (
      color 0C
      echo  [X] En esa ruta tampoco hay firebase.json. Cancelo para no regarla.
      pause & exit /b 1
    )
    set "PROYECTO=!DESTINO!"
  ) else (
    echo  [!] Instalacion nueva: se creara el proyecto en esta carpeta.
    set "PROYECTO=%CD%"
  )
) else (
  set "PROYECTO=%CD%"
)
echo  [OK] Destino: !PROYECTO!

REM ---------- 2. Localizar el ZIP ----------
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
  echo      Deja el archivo .zip en la misma carpeta que este instalador.
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
set "TMPDIR=%TEMP%\cb_update_%RANDOM%"
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
if not exist "!ORIGEN!\firebase.json" (
  if not exist "!ORIGEN!\*.bat" (
    color 0C
    echo  [X] Ese ZIP no parece del proyecto Control Bolsas.
    rd /s /q "!TMPDIR!" >nul 2>nul
    pause & exit /b 1
  )
)
echo  [OK] Contenido listo

REM ---------- 5. RESPALDO antes de tocar nada ----------
for /f "tokens=1-6 delims=/: " %%a in ("%DATE% %TIME%") do set "SELLO=%%c%%b%%a_%%d%%e"
set "SELLO=!SELLO: =0!"
set "BACKUP=!PROYECTO!\_respaldo_!SELLO!"
REM el respaldo no debe acabar en GitHub
if exist "!PROYECTO!\.gitignore" (
  findstr /c:"_respaldo_" "!PROYECTO!\.gitignore" >nul 2>nul
  if errorlevel 1 (
    echo.>> "!PROYECTO!\.gitignore"
    echo # Respaldos del instalador>> "!PROYECTO!\.gitignore"
    echo _respaldo_*/>> "!PROYECTO!\.gitignore"
    echo *.zip>> "!PROYECTO!\.gitignore"
    echo *.tsbuildinfo>> "!PROYECTO!\.gitignore"
    echo  [+] .gitignore actualizado para no subir respaldos ni zips
  )
)

echo  [..] Respaldando tu version actual en:
echo       _respaldo_!SELLO!
REM /XD con nombre suelto excluye ESA carpeta a CUALQUIER nivel. Poner
REM "lib" a secas descartaba tambien src\lib, asi que el respaldo previo
REM se guardaba sin la mitad de la logica del sistema.
robocopy "!PROYECTO!" "!BACKUP!" /E /XD "!PROYECTO!\node_modules" "!PROYECTO!\dist" "!PROYECTO!\.git" "!PROYECTO!\.firebase" "!PROYECTO!\functions\node_modules" "!PROYECTO!\functions\lib" _respaldo_* /NFL /NDL /NJH /NJS /NC /NS >nul
if errorlevel 8 (
  color 0C
  echo  [X] Fallo el respaldo. NO instalo nada para no arriesgar tus datos.
  rd /s /q "!TMPDIR!" >nul 2>nul
  pause & exit /b 1
)
echo  [OK] Respaldo hecho

REM ---------- 6. Copiar SIN borrar y SIN pisar lo tuyo ----------
REM package-lock.json YA NO se excluye: si el paquete trae uno es porque las
REM dependencias cambiaron, y dejar el viejo desincroniza npm ci.
REM /IS /IT son obligatorios: sin ellos, robocopy compara fecha y tamano
REM y SE SALTA EN SILENCIO cualquier archivo que en el destino parezca
REM "igual o mas nuevo" -- sin avisar, sin marcar error. Si tu copia local
REM de un archivo tiene fecha de modificacion mas reciente que la version
REM del paquete (algo normal: la tocaste, la edito otro instalador, etc.),
REM el archivo NUEVO del parche nunca llega. /IS fuerza a copiar tambien
REM los que se ven "iguales"; /IT copia los que difieren solo en atributos.
echo  [..] Copiando archivos nuevos...
echo.
REM CAUSA RAIZ CORREGIDA: "/XD ... lib" excluia src\lib ademas de
REM functions\lib, porque robocopy interpreta un nombre suelto como
REM "cualquier carpeta que se llame asi, en cualquier nivel". Resultado:
REM src\lib (finance.ts, logger.ts, cloudBackup.ts, types.ts...) NUNCA se
REM instalaba, y las correcciones de esos archivos se perdian en silencio.
REM Ahora las exclusiones van con ruta completa: solo lo que se pretendia.
robocopy "!ORIGEN!" "!PROYECTO!" /E /IS /IT /XF .env .env.local .firebaserc /XD "!ORIGEN!\node_modules" "!ORIGEN!\dist" "!ORIGEN!\.git" "!ORIGEN!\.firebase" "!ORIGEN!\functions\node_modules" "!ORIGEN!\functions\lib" _respaldo_* /NFL /NDL /NJH /NJS /NC /NS
set RC=%ERRORLEVEL%
if !RC! GEQ 8 (
  color 0C
  echo  [X] Hubo errores al copiar. Tu respaldo esta intacto en:
  echo      !BACKUP!
  rd /s /q "!TMPDIR!" >nul 2>nul
  pause & exit /b 1
)

REM ---------- 7. Archivos protegidos: solo si NO existen ----------
if not exist "!PROYECTO!\.firebaserc" (
  if exist "!ORIGEN!\.firebaserc" (
    copy /y "!ORIGEN!\.firebaserc" "!PROYECTO!\.firebaserc" >nul
    echo  [+] .firebaserc creado ^(no lo tenias^)
  )
)
if not exist "!PROYECTO!\.env" (
  if exist "!ORIGEN!\.env.example" (
    copy /y "!ORIGEN!\.env.example" "!PROYECTO!\.env" >nul
    echo  [+] .env creado desde la plantilla - FALTA LLENARLO
    set "ABRIRENV=1"
  )
) else (
  echo  [=] .env intacto: tus credenciales no se tocaron
)

rd /s /q "!TMPDIR!" >nul 2>nul

color 0A
echo.
echo  ============================================================
echo    ACTUALIZACION INSTALADA
echo.
echo    Se respeto: .env, .firebaserc, node_modules, dist, .git
echo    Tu version anterior completa quedo en:
echo      _respaldo_!SELLO!
echo    Si algo sale mal, de ahi copias de regreso lo que necesites.
echo  ============================================================
echo.
if "!ABRIRENV!"=="1" (
  echo  [!] Antes de nada, llena el archivo .env con los datos de Firebase.
  set /p AB="  Lo abro ahora? (s/n): "
  if /i "!AB!"=="s" notepad "!PROYECTO!\.env"
)
echo   Siguiente paso sugerido:
echo     1  CONECTAR_FIREBASE.bat        ^(si la sesion vencio^)
echo     2  CONFIGURAR_CLAVE_GEMINI.bat  ^(si falta la clave^)
echo     3  INSTALL_AND_DEPLOY.bat
echo     -  DIAGNOSTICO.bat te dice cual de los tres necesitas
echo.
set /p SIG="  Corro DIAGNOSTICO.bat ahora? (s/n): "
if /i "!SIG!"=="s" (
  cd /d "!PROYECTO!"
  call DIAGNOSTICO.bat
)
exit /b 0
