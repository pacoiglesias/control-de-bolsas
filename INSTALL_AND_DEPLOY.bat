@echo off
chcp 65001 >nul
title Control Bolsas v5 - Compilar y desplegar
color 0A
setlocal EnableDelayedExpansion

echo.
echo  ============================================================
echo    CONTROL BOLSAS v5 - DESPLIEGUE A PRODUCCION
echo  ============================================================
echo.

if not exist ".env" (
  color 0C
  echo  [X] Falta el archivo .env. Ejecuta primero SETUP.bat
  pause & exit /b 1
)
if not exist ".firebaserc" (
  color 0C
  echo  [X] Falta .firebaserc con el ID de tu proyecto. Ejecuta SETUP.bat
  pause & exit /b 1
)

echo  [0/5] Verificando la sesion de Firebase...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [!] Tu sesion vencio. Se abrira el navegador para renovarla.
  call firebase login --reauth
  call firebase projects:list >nul 2>nul
  if errorlevel 1 ( color 0C & echo  [X] La sesion no quedo valida. & pause & exit /b 1 )
)
call firebase use control-de-bolsas-89c88 >nul 2>nul
echo  [OK] Sesion valida - proyecto control-de-bolsas-89c88

echo.
echo  [1/5] Instalando dependencias...
call npm install || goto :fallo
call npm --prefix functions install || goto :fallo

echo.
echo  [2/5] Revisando tipos de TypeScript...
call npm run typecheck || goto :fallo

echo.
echo  [3/5] Compilando el frontend...
call npm run build || goto :fallo

echo.
echo  [4/5] Respaldando en GitHub...
if exist ".git" (
  git add .
  git commit -m "deploy: %DATE% %TIME%"
  git push
  if errorlevel 1 echo  [!] No se pudo hacer push. Continuo con el despliegue.
) else (
  echo  [!] Esta carpeta todavia no es un repositorio git.
  set /p INITGIT="      Lo conecto ahora con pacoiglesias/control-de-bolsas? (s/n): "
  if /i "!INITGIT!"=="s" (
    git init
    git branch -M main
    git remote add origin https://github.com/pacoiglesias/control-de-bolsas.git
    git add .
    git commit -m "deploy inicial: %DATE%"
    git push -u origin main
    if errorlevel 1 echo  [!] No se pudo hacer push. Continuo con el despliegue.
  ) else (
    echo      Me lo salto. Usa PUSH_TO_GIT.bat cuando quieras.
  )
)

echo.
echo  [5/5] Desplegando a Firebase (hosting + functions + reglas^)...
call firebase deploy --only hosting,functions,firestore,storage
if errorlevel 1 goto :fallodeploy

echo.
color 0A
echo  ============================================================
echo    DESPLIEGUE COMPLETO
echo    Tu sistema ya esta en linea. La URL aparece arriba,
echo    en la linea "Hosting URL".
echo  ============================================================
pause
exit /b 0

:fallodeploy
color 0C
echo.
echo  ============================================================
echo    FALLO EL DESPLIEGUE. Busca tu error en esta lista:
echo.
echo    "Authentication Error / credentials no longer valid"
echo       --^>  corre CONECTAR_FIREBASE.bat y vuelve a intentar
echo.
echo    "Assertion failed: resolving hosting target"
echo       --^>  es consecuencia del error de arriba: sin sesion
echo            valida no puede resolver el proyecto
echo.
echo    "Your project must be on the Blaze plan"
echo       --^>  https://console.firebase.google.com/project/control-de-bolsas-89c88/usage/details
echo.
echo    "Secret GOOGLE_GENAI_API_KEY does not exist"
echo       --^>  corre CONFIGURAR_CLAVE_GEMINI.bat
echo.
echo    "Site not found" o "no site name"
echo       --^>  falta crear Hosting: entra a la consola, menu Hosting,
echo            dale Comenzar una vez, y vuelve a correr esto
echo  ============================================================
echo.
echo    Duda general: corre DIAGNOSTICO.bat
pause
exit /b 1

:fallo
color 0C
echo.
echo  ============================================================
echo    ALGO FALLO. Lee el error de arriba.
echo    Errores mas comunes:
echo      - Falta la clave de Gemini  --^>  corre CONFIGURAR_CLAVE_GEMINI.bat
echo      - El plan del proyecto no es Blaze ^(Functions lo exige^)
echo      - Variables VITE_ vacias en .env
echo.
echo    Corre DIAGNOSTICO.bat: revisa los 12 puntos y te dice cual falla.
echo    Si el error dice "credentials": CONECTAR_FIREBASE.bat
echo  ============================================================
pause
exit /b 1
