@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Crear ZIP para revisar
color 0B
cls
echo.
echo  ============================================================
echo    CREAR ZIP PARA REVISION  -  Control Bolsas ERP
echo  ============================================================
echo.
echo   Arma un ZIP ligero de tu codigo, listo para subir al chat.
echo.
echo   NO copia (por eso queda ligero y sube rapido):
echo     node_modules, functions\node_modules, dist,
echo     functions\lib, .firebase, .git, otros .zip
echo.
echo   SI copia todo lo demas, incluyendo .env y .firebaserc,
echo   porque hacen falta para entender la configuracion.
echo.
echo   [!] Tu .env lleva claves. Si prefieres no compartirlas,
echo       responde "n" cuando pregunte por los archivos .env.
echo.

cd /d "%~dp0"

REM ---------- 1. Ubicar la carpeta del proyecto ----------
if exist "firebase.json" (
  set "PROYECTO=%CD%"
) else (
  echo  [!] No veo firebase.json aqui:
  echo      %CD%
  echo.
  set /p DESTINO="  Pega la ruta de la carpeta del proyecto: "
  if "!DESTINO!"=="" (
    color 0C
    echo  [X] Necesito la ruta del proyecto.
    pause & exit /b 1
  )
  if not exist "!DESTINO!\firebase.json" (
    color 0C
    echo  [X] En esa ruta no hay firebase.json.
    pause & exit /b 1
  )
  set "PROYECTO=!DESTINO!"
)
echo  [OK] Proyecto: !PROYECTO!
echo.

REM ---------- 2. Que quiere empaquetar ----------
echo  ------------------------------------------------------------
echo   Que quieres empaquetar?
echo  ------------------------------------------------------------
echo     0  - El proyecto TAL COMO ESTA AHORA
set CUANTOS=0
for /d %%d in ("!PROYECTO!\_respaldo_*") do (
  set /a CUANTOS+=1
  set "CARPETA!CUANTOS!=%%~fd"
  echo     !CUANTOS!  - %%~nxd
)
echo  ------------------------------------------------------------
echo.
set /p OPCION="  Numero [0]: "
if "!OPCION!"=="" set OPCION=0

if "!OPCION!"=="0" (
  set "ORIGEN=!PROYECTO!"
  set "ETIQUETA=proyecto-actual"
) else (
  set "ORIGEN="
  for %%v in (!OPCION!) do set "ORIGEN=!CARPETA%%v!"
  if "!ORIGEN!"=="" (
    color 0C
    echo  [X] Esa opcion no existe en la lista.
    pause & exit /b 1
  )
  for %%f in ("!ORIGEN!") do set "ETIQUETA=%%~nxf"
)
echo  [OK] Origen: !ORIGEN!

REM ---------- 3. Incluir .env o no ----------
echo.
set /p CONENV="  Incluyo los archivos .env (llevan claves)? (s/n) [s]: "
if "!CONENV!"=="" set CONENV=s

REM ---------- 4. Preparar copia temporal ----------
set "STAGE=%TEMP%\cb_zip_%RANDOM%"
set "ZIPLOG=%TEMP%\cb_zip_log.txt"
echo.
echo  [..] Preparando copia temporal (sin lo pesado)...

REM Las exclusiones van LITERALES en cada llamada, no dentro de variables:
REM meter comillas anidadas en una variable y expandirla es fragil y ya nos
REM costo varios intentos fallidos. Dos ramas explicitas es mas largo pero
REM no se rompe.
REM "_respaldo_*" va como nombre suelto (robocopy no acepta comodines en una
REM ruta completa de /XD). Excluir el patron es seguro incluso cuando se
REM empaqueta un respaldo: robocopy nunca excluye la carpeta de origen en si,
REM solo subcarpetas que hagan match.
REM Rutas planas a proposito: el prefijo \\?\ hace fallar a robocopy como
REM origen en este entorno. /R:2 /W:2 para que un archivo bloqueado falle
REM rapido en vez de reintentar un millon de veces.
if /i "!CONENV!"=="n" (
  robocopy "!ORIGEN!" "!STAGE!" /E /XD "!ORIGEN!\node_modules" "!ORIGEN!\dist" "!ORIGEN!\.git" "!ORIGEN!\.firebase" "!ORIGEN!\functions\node_modules" "!ORIGEN!\functions\lib" _respaldo_* /XF *.zip tsconfig.tsbuildinfo .env .env.local .firebaserc useDashboardStats.ts /R:1 /W:1 /LOG:"!ZIPLOG!"
) else (
  robocopy "!ORIGEN!" "!STAGE!" /E /XD "!ORIGEN!\node_modules" "!ORIGEN!\dist" "!ORIGEN!\.git" "!ORIGEN!\.firebase" "!ORIGEN!\functions\node_modules" "!ORIGEN!\functions\lib" _respaldo_* /XF *.zip tsconfig.tsbuildinfo useDashboardStats.ts /R:1 /W:1 /LOG:"!ZIPLOG!"
)
if errorlevel 8 (
  color 0C
  echo  [X] Fallo al preparar la copia. Ultimas lineas del registro:
  echo      ------------------------------------------------------------
  powershell -NoProfile -Command "Get-Content -Tail 20 '!ZIPLOG!'" 2>nul
  echo      ------------------------------------------------------------
  rd /s /q "!STAGE!" >nul 2>nul
  pause & exit /b 1
)
echo  [OK] Copia temporal lista

REM ---------- 5. Comprimir ----------
for /f "tokens=1-6 delims=/: " %%a in ("%DATE% %TIME%") do set "SELLO=%%c%%b%%a_%%d%%e"
set "SELLO=!SELLO: =0!"
set "SALIDA=!PROYECTO!\PARA-CLAUDE_!ETIQUETA!_!SELLO!.zip"

echo  [..] Comprimiendo... (puede tardar un momento)
powershell -NoProfile -Command "try{ Compress-Archive -Path '!STAGE!\*' -DestinationPath '!SALIDA!' -CompressionLevel Optimal -Force; exit 0 }catch{ Write-Host $_.Exception.Message; exit 1 }"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo crear el ZIP.
  rd /s /q "!STAGE!" >nul 2>nul
  pause & exit /b 1
)

rd /s /q "!STAGE!" >nul 2>nul

REM ---------- 6. Reporte ----------
for %%f in ("!SALIDA!") do set /a TAMANO=%%~zf/1048576
color 0A
echo.
echo  ============================================================
echo    ZIP LISTO
echo  ============================================================
echo.
echo    Archivo:  PARA-CLAUDE_!ETIQUETA!_!SELLO!.zip
echo    Tamano:   aprox. !TAMANO! MB
echo    Ubicacion: !PROYECTO!
echo.
if /i "!CONENV!"=="n" (
  echo    Se EXCLUYERON .env y .firebaserc por privacidad.
) else (
  echo    Se incluyeron .env y .firebaserc.
)
echo.
echo    Ahora subelo al chat con el boton de adjuntar archivo.
echo  ============================================================
echo.
set /p ABRIR="  Abro la carpeta para que lo arrastres? (s/n) [s]: "
if "!ABRIR!"=="" set ABRIR=s
if /i "!ABRIR!"=="s" explorer /select,"!SALIDA!"
exit /b 0
