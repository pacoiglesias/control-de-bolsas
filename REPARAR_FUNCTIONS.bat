@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Reparar las Cloud Functions
color 0E
cls
echo.
echo  ============================================================
echo    REPARAR LAS CLOUD FUNCTIONS
echo  ============================================================
echo.
echo   Tu error:
echo     "Cannot find module '@google-cloud/firestore/build/src/path'"
echo.
echo   No es tu codigo: es la carpeta functions\node_modules, que
echo   quedo incompleta al instalarse. Se borra y se instala limpia.
echo.
echo   Tu codigo fuente NO se toca. Solo se reinstalan librerias.
echo.

if not exist "firebase.json" (
  color 0C
  echo  [X] Corre esto dentro de la carpeta del proyecto.
  pause & exit /b 1
)

set /p SIGO="  Continuo? (s/n): "
if /i not "!SIGO!"=="s" ( echo  Cancelado. & pause & exit /b 0 )

echo.
echo  [1/6] Borrando la instalacion rota...
if exist "functions\node_modules" rd /s /q "functions\node_modules"
if exist "functions\lib" rd /s /q "functions\lib"
if exist "functions\package-lock.json" del /f /q "functions\package-lock.json"
echo  [OK] Limpio

echo.
echo  [2/6] Revisando la cache de npm...
call npm cache verify >nul 2>nul
echo  [OK] Cache revisada

echo.
echo  [3/6] Instalando de cero ^(tarda un par de minutos^)...
call npm --prefix functions install
if errorlevel 1 (
  color 0C
  echo  [X] Fallo la instalacion. Revisa tu conexion a internet.
  pause & exit /b 1
)
echo  [OK] Dependencias instaladas

echo.
echo  [4/6] Verificando el modulo que faltaba...
if not exist "functions\node_modules\@google-cloud\firestore\build\src\path.js" (
  echo  [!] Sigue sin aparecer. Lo instalo directo...
  call npm --prefix functions install @google-cloud/firestore@^7.11.0
  if not exist "functions\node_modules\@google-cloud\firestore\build\src\path.js" (
    color 0C
    echo  [X] No se pudo. Puede ser un antivirus bloqueando la escritura
    echo      en node_modules, o falta de espacio en disco.
    pause & exit /b 1
  )
)
echo  [OK] @google-cloud/firestore completo

echo.
echo  [5/6] Compilando TypeScript...
call npm --prefix functions run build
if errorlevel 1 (
  color 0C
  echo  [X] Error de compilacion. Copiame el mensaje de arriba.
  pause & exit /b 1
)
echo  [OK] Compilado

echo.
echo  [6/6] PRUEBA DE CARGA ^(lo mismo que hace Firebase al desplegar^)
echo        Esto detecta el error en 5 segundos en vez de 3 minutos.
set FIREBASE_CONFIG={"projectId":"control-de-bolsas-89c88","storageBucket":"control-de-bolsas-89c88.firebasestorage.app"}
set GCLOUD_PROJECT=control-de-bolsas-89c88
pushd functions
node -e "const m=require('./lib/index.js'); const k=Object.keys(m); if(k.length===0){console.error('No se detecto ninguna funcion'); process.exit(1);} console.log('  Funciones detectadas: '+k.join(', '));"
set PRUEBA=%ERRORLEVEL%
popd
set FIREBASE_CONFIG=
set GCLOUD_PROJECT=

if not "%PRUEBA%"=="0" (
  color 0C
  echo.
  echo  [X] Las funciones siguen sin cargar. Copiame el error de arriba.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    REPARADO. Las tres funciones cargan bien.
echo  ============================================================
echo.
set /p DEP="  Despliego las funciones ahora? (s/n): "
if /i not "!DEP!"=="s" ( echo  Listo. Corre INSTALL_AND_DEPLOY.bat cuando quieras. & pause & exit /b 0 )

echo.
call firebase deploy --only functions
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] El despliegue fallo. Si el error menciona
  echo      "Secret GOOGLE_GENAI_API_KEY" corre CONFIGURAR_CLAVE_GEMINI.bat
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    FUNCIONES DESPLEGADAS
echo    Tu sistema completo: https://control-de-bolsas-89c88.web.app
echo  ============================================================
pause
