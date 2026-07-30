@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Diagnostico
color 0B
cls
echo.
echo  ============================================================
echo    DIAGNOSTICO DEL ENTORNO
echo  ============================================================
echo.
echo   Este script NO cambia nada. Solo revisa y te dice que falta.
echo.

cd /d "%~dp0"
set FALLOS=0
set "TMPLOG=%TEMP%\cb_diag_%RANDOM%.txt"

echo  --- Carpeta del proyecto ---
if exist "firebase.json" (
  echo  [OK] firebase.json
) else (
  echo  [X] No hay firebase.json: no estas en la carpeta del proyecto
  set /a FALLOS+=1
)
if exist "package.json" (
  echo  [OK] package.json
) else (
  echo  [X] Falta package.json
  set /a FALLOS+=1
)

echo.
echo  --- Herramientas ---
where node >nul 2>&1
if errorlevel 1 (
  echo  [X] Node no instalado - https://nodejs.org
  set /a FALLOS+=1
) else (
  for /f "tokens=*" %%v in ('node -v') do echo  [OK] Node %%v
)

where npm >nul 2>&1
if errorlevel 1 (
  echo  [X] npm no disponible
  set /a FALLOS+=1
) else (
  echo  [OK] npm
)

where git >nul 2>&1
if errorlevel 1 (
  echo  [!] git no instalado: PUSH_TO_GIT.bat no va a funcionar
) else (
  echo  [OK] git
)

set "HAYFIREBASE=1"
where firebase >nul 2>&1
if errorlevel 1 (
  echo  [X] Firebase CLI no instalado - corre: npm i -g firebase-tools
  set /a FALLOS+=1
  set "HAYFIREBASE=0"
) else (
  echo  [OK] Firebase CLI
)

echo.
echo  --- Dependencias ---
if exist "node_modules" (
  echo  [OK] node_modules
) else (
  echo  [X] Faltan dependencias - CONTROL_MAESTRO.bat opcion 1
  set /a FALLOS+=1
)
if exist "functions\node_modules" (
  echo  [OK] functions\node_modules
) else (
  echo  [X] Faltan dependencias de functions
  set /a FALLOS+=1
)

echo.
echo  --- Configuracion local ---
if not exist ".env" (
  echo  [X] No hay .env - copia .env.example y llenalo
  set /a FALLOS+=1
) else (
  echo  [OK] .env presente
  findstr /r /c:"VITE_FIREBASE_API_KEY=..........." ".env" >nul 2>&1
  if errorlevel 1 (
    echo  [X] VITE_FIREBASE_API_KEY falta o esta vacia en .env
    set /a FALLOS+=1
  ) else (
    echo  [OK] VITE_FIREBASE_API_KEY tiene valor
  )
)
if exist ".firebaserc" (
  echo  [OK] .firebaserc
) else (
  echo  [X] Falta .firebaserc
  set /a FALLOS+=1
)

echo.
echo  --- Conexion con Firebase ---
if "!HAYFIREBASE!"=="0" (
  echo  [-] Se omite: el CLI no esta instalado.
  goto RESUMEN
)

echo.
echo   Las dos comprobaciones que siguen salen a internet y pueden
echo   tardar entre 10 y 40 segundos. Si tienes prisa las puedes saltar.
echo.
set "REVISAR="
set /p REVISAR="  Reviso la conexion con Firebase? (s/n) [s]: "
if "!REVISAR!"=="" set "REVISAR=s"
if /i not "!REVISAR!"=="s" (
  echo  [-] Omitido a peticion tuya.
  goto RESUMEN
)

echo.
echo  [..] Consultando la sesion. No cierres la ventana...
REM 'call' es obligatorio: firebase es un .cmd y sin call el control se va y
REM este script no vuelve a recuperarlo (parece que se congela).
REM '--non-interactive' evita que el CLI se quede esperando una respuesta
REM que nadie puede ver cuando la salida esta redirigida.
call firebase projects:list --non-interactive > "!TMPLOG!" 2>&1
if errorlevel 1 (
  echo  [X] No hay sesion activa o fallo la consulta.
  echo      Corre CONECTAR_FIREBASE.bat
  set /a FALLOS+=1
  echo.
  echo      Detalle:
  for /f "usebackq tokens=*" %%l in ("!TMPLOG!") do echo        %%l
) else (
  echo  [OK] Sesion activa
)

echo.
echo  [..] Consultando la clave de Gemini...
call firebase functions:secrets:access GOOGLE_GENAI_API_KEY --non-interactive > "!TMPLOG!" 2>&1
if errorlevel 1 (
  echo  [!] No pude leer GOOGLE_GENAI_API_KEY.
  echo      Puede ser que no este configurada, o que tu cuenta no tenga
  echo      permiso para leer secretos. Si la IA no procesa PDFs,
  echo      corre CONFIGURAR_CLAVE_GEMINI.bat
) else (
  echo  [OK] GOOGLE_GENAI_API_KEY configurada
)

:RESUMEN
if exist "!TMPLOG!" del "!TMPLOG!" >nul 2>&1

echo.
echo  ============================================================
if !FALLOS!==0 (
  color 0A
  echo    TODO EN ORDEN. Puedes correr INSTALL_AND_DEPLOY.bat
) else (
  color 0E
  echo    !FALLOS! punto^(s^) por resolver. Arregla los [X] de arriba.
)
echo  ============================================================
echo.
pause
exit /b 0
