@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Configurar la clave de Gemini
color 0E
cls
echo.
echo  ============================================================
echo    CONFIGURAR LA CLAVE DE GEMINI (Google AI^)
echo  ============================================================
echo.

REM ---------- 0. Carpeta correcta ----------
if not exist "firebase.json" (
  color 0C
  echo  [X] No encuentro firebase.json en esta carpeta:
  echo      %CD%
  echo.
  echo      Copia este .bat DENTRO de la carpeta del proyecto
  echo      ^(la que tiene firebase.json y la carpeta src^) y correlo de ahi.
  pause & exit /b 1
)

REM ---------- 1. Firebase CLI ----------
where firebase >nul 2>nul
if errorlevel 1 (
  echo  [..] Instalando el Firebase CLI...
  call npm install -g firebase-tools
  if errorlevel 1 (
    color 0C
    echo  [X] Fallo. Abre la terminal COMO ADMINISTRADOR y corre:
    echo      npm install -g firebase-tools
    pause & exit /b 1
  )
)
echo  [OK] Firebase CLI instalado

REM ---------- 2. Sesion ----------
echo  [..] Verificando tu sesion de Firebase...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [!] Tu sesion vencio. Se abrira el navegador para renovarla.
  call firebase login --reauth
  call firebase projects:list >nul 2>nul
  if errorlevel 1 (
    color 0C
    echo  [X] La sesion no quedo valida. Corre CONECTAR_FIREBASE.bat
    pause & exit /b 1
  )
)
echo  [OK] Sesion valida

call firebase use control-de-bolsas-89c88 >nul 2>nul
if errorlevel 1 ( echo  [!] Elige el proyecto: & call firebase use --add )
echo  [OK] Proyecto: control-de-bolsas-89c88

REM ---------- 3. Obtener la clave ----------
echo.
echo  ------------------------------------------------------------
echo   Ya tienes una clave nueva de https://aistudio.google.com/apikey ?
echo  ------------------------------------------------------------
set /p ABRIR="  Abro la pagina para generarla? (s/n): "
if /i "!ABRIR!"=="s" (
  start "" https://aistudio.google.com/apikey
  echo.
  echo  Copiala con el boton de copiar de esa pagina y regresa aqui.
  pause
)

echo.
echo  ------------------------------------------------------------
echo   COMO QUIERES METERLA
echo  ------------------------------------------------------------
echo    1  Pegarla en el Bloc de notas   ^(RECOMENDADO - si deja pegar^)
echo    2  Escribirla en el prompt del CLI  ^(no se ve al teclear^)
echo  ------------------------------------------------------------
set /p METODO="  Elige 1 o 2 [1]: "
if "!METODO!"=="" set METODO=1
if "!METODO!"=="2" goto :metodo_prompt

:metodo_notepad
set "TMPKEY=%TEMP%\cb_gemini_key.txt"
break > "%TMPKEY%"
echo.
echo  [..] Abriendo el Bloc de notas.
echo.
echo       1. Pega la clave con Ctrl+V
echo       2. Guarda con Ctrl+S
echo       3. CIERRA el Bloc de notas para continuar
echo.
echo       No dejes espacios ni renglones de mas: yo los limpio.
echo.
start /wait notepad "%TMPKEY%"

powershell -NoProfile -Command "$p='%TMPKEY%'; if(-not (Test-Path $p)){exit 3}; $k=(Get-Content -Raw -ErrorAction SilentlyContinue $p); if($null -eq $k){exit 3}; $k=$k.Trim(); if($k.Length -lt 20){exit 2}; [IO.File]::WriteAllText($p,$k,(New-Object System.Text.UTF8Encoding $false)); if(-not $k.StartsWith('AIza')){exit 10}; exit 0"
set ERR=%ERRORLEVEL%

if %ERR%==3 (
  color 0C
  echo  [X] El archivo quedo vacio. No se guardo la clave.
  echo      Vuelve a correr el script y acuerdate de Ctrl+S antes de cerrar.
  call :borrar
  pause & exit /b 1
)
if %ERR%==2 (
  color 0C
  echo  [X] Lo que pegaste tiene menos de 20 caracteres: no parece una clave.
  call :borrar
  pause & exit /b 1
)
if %ERR%==10 (
  color 0E
  echo.
  echo  [!] OJO: las claves de Gemini normalmente empiezan con "AIza".
  echo      La que pegaste empieza distinto, asi que puede que hayas
  echo      copiado un token de sesion en vez de la API key.
  echo.
  echo      En https://aistudio.google.com/apikey busca el boton
  echo      "Create API key" y copia el valor que aparece ahi.
  echo.
  set /p SIGO="  Aun asi la intento guardar? (s/n): "
  if /i not "!SIGO!"=="s" ( call :borrar & echo  Cancelado. & pause & exit /b 1 )
)

echo.
echo  [..] Guardando en Secret Manager...
call firebase functions:secrets:set GOOGLE_GENAI_API_KEY --data-file "%TMPKEY%"
set DEPERR=%ERRORLEVEL%
call :borrar
if not "%DEPERR%"=="0" goto :fallo_secreto
goto :guardada

:metodo_prompt
echo.
echo  Cuando aparezca el prompt, pega con CLIC DERECHO ^(no Ctrl+V^)
echo  si estas en la consola clasica de Windows. No veras nada al
echo  pegar: es normal. Luego presiona Enter.
echo.
pause
call firebase functions:secrets:set GOOGLE_GENAI_API_KEY
if errorlevel 1 goto :fallo_secreto

:guardada
color 0A
echo.
echo  [OK] Clave guardada cifrada en Secret Manager.
echo       No quedo en ningun archivo de tu computadora ni del repositorio.

echo.
set /p DEP="  Redesplegar las funciones para que la tomen? (s/n): "
if /i not "!DEP!"=="s" (
  echo.
  echo  Listo. Acuerdate: la clave no surte efecto hasta que despliegues.
  pause & exit /b 0
)
if not exist "functions\node_modules" (
  echo  [..] Instalando dependencias del backend...
  call npm --prefix functions install
)
echo  [..] Desplegando funciones...
call firebase deploy --only functions
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue. Corre DIAGNOSTICO.bat para ver que falta.
  pause & exit /b 1
)
color 0A
echo.
echo  ============================================================
echo    TODO LISTO
echo    Sube un PDF de prueba en el modulo "Subir ordenes".
echo    Si algo falla, la orden aparece en "Revision manual"
echo    con el motivo exacto escrito en la ficha.
echo  ============================================================
pause
exit /b 0

:fallo_secreto
color 0C
echo.
echo  ============================================================
echo    NO SE PUDO GUARDAR LA CLAVE. Las dos causas tipicas:
echo.
echo    A^) El proyecto sigue en plan gratuito ^(Spark^).
echo       Secret Manager y Functions 2a gen exigen plan Blaze.
echo       https://console.firebase.google.com/project/control-de-bolsas-89c88/usage/details
echo.
echo    B^) Falta activar la API de Secret Manager. Dale ENABLE,
echo       espera un minuto y vuelve a correr este .bat:
echo       https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=control-de-bolsas-89c88
echo  ============================================================
set /p AB2="  Abro las dos paginas? (s/n): "
if /i "!AB2!"=="s" (
  start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/usage/details
  start "" https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=control-de-bolsas-89c88
)
pause
exit /b 1

REM ---------- borrado del archivo temporal ----------
:borrar
if exist "%TMPKEY%" (
  powershell -NoProfile -Command "[IO.File]::WriteAllText('%TMPKEY%', ('0' * 300))" >nul 2>nul
  del /f /q "%TMPKEY%" >nul 2>nul
)
exit /b 0
