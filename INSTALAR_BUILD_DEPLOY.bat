@echo off
REM FIX: si haces doble clic aqui directo (sin pasar por otro script), la
REM ventana se cierra sola en cuanto termina -- bien o mal -- y no alcanzas
REM a leer el error si algo truena. Se relanza en una ventana fija con
REM "cmd /k" que Windows garantiza que se queda abierta pase lo que pase.
REM Si a este .bat lo llama OTRO script que ya esta en una ventana fija
REM (le pasa el argumento _EN_VENTANA_FIJA_), no vuelve a abrir otra
REM ventana -- sigue corriendo en la misma.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Build y Deploy" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar, Compilar y Desplegar
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR + BUILD + DEPLOY  -  Control Bolsas ERP
echo  ============================================================
echo.
echo   Este script deja el sistema listo de punta a punta:
echo     1. Dependencias (raiz y functions)
echo     2. Typecheck (tsc --noEmit, raiz y functions)
echo     3. Pruebas unitarias (formulas financieras)
echo     4. Lint (ESLint)
echo     5. Build (tsc -b + vite build + functions build)
echo     6. Deploy: Reglas/Indices -^> Cloud Functions -^> Hosting
echo.
echo   No borra nada. Solo instala, compila y despliega lo que ya
echo   esta en esta carpeta.
echo.

cd /d "%~dp0"

REM ---------- 0. Verificaciones basicas ----------
if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause & exit /b 1
)
if not exist ".env" (
  color 0C
  echo  [X] Falta el archivo .env. Corre DIAGNOSTICO.bat primero.
  pause & exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro Node.js instalado. Instalalo desde https://nodejs.org
  pause & exit /b 1
)
where firebase >nul 2>nul
if errorlevel 1 (
  color 0E
  echo  [!] No encuentro el CLI de firebase en PATH ^(firebase-tools^).
  echo      Si el deploy falla mas abajo, instalalo con:
  echo        npm install -g firebase-tools
  echo.
)

REM FIX: antes, si la sesion de "firebase login" habia expirado (o nunca
REM se habia hecho en esta maquina/usuario de Windows), el fallo salia
REM hasta el paso 6 -- despues de ya haber corrido typecheck, pruebas,
REM lint y build completos (varios minutos perdidos). Ahora se checa la
REM sesion ANTES de arrancar nada mas. "firebase login" abre el navegador
REM UNA sola vez; despues, la sesion queda guardada en este usuario de
REM Windows y los deploys siguientes ya no piden login de nuevo.
echo  --- Verificando sesion de Firebase ---
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [!] No hay sesion activa de Firebase en esta maquina. Abriendo login...
  call firebase login
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudo iniciar sesion en Firebase. Sin sesion no hay deploy posible.
    pause & exit /b 1
  )
) else (
  echo  [OK] Sesion de Firebase activa
)

echo  --- 1/6 Dependencias ---
REM npm ci en vez de npm install: reinstala exactamente lo que dice el
REM package-lock.json. Si npm ci falla ^(por ejemplo el lock no esta
REM sincronizado^), se cae a npm install para no dejar al usuario varado.
call npm ci
if errorlevel 1 (
  echo  [!] npm ci fallo. Intento con npm install...
  call npm install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de la raiz.
    pause & exit /b 1
  )
)
call npm --prefix functions ci
if errorlevel 1 (
  echo  [!] npm ci de functions fallo. Intento con npm install...
  call npm --prefix functions install
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudieron instalar las dependencias de functions.
    pause & exit /b 1
  )
)
echo  [OK] Dependencias instaladas

echo.
echo  --- 2/6 Typecheck ^(tsc --noEmit^) ---
call npm run typecheck
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] El typecheck del frontend fallo. NO se despliega nada.
  pause & exit /b 1
)
pushd functions
call npx tsc --noEmit
set RC_FN_TSC=!ERRORLEVEL!
popd
if !RC_FN_TSC! NEQ 0 (
  color 0C
  echo.
  echo  [X] El typecheck de Cloud Functions fallo. NO se despliega nada.
  pause & exit /b 1
)
echo  [OK] Typecheck limpio ^(frontend y functions^)

echo.
echo  --- 3/6 Pruebas unitarias ^(formulas financieras^) ---
call npm test
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] Las pruebas fallaron. NO se despliega nada.
  echo      Algo cambio el resultado de los calculos de dinero.
  pause & exit /b 1
)
echo  [OK] Pruebas verificadas

echo.
echo  --- 4/6 Lint ^(ESLint^) ---
call npm run lint
if errorlevel 1 (
  color 0E
  echo.
  echo  [!] ESLint encontro errores. Revisa arriba antes de continuar.
  set /p CONTINUAR_LINT="  Continuo de todos modos con el build/deploy? (s/n): "
  if /i not "!CONTINUAR_LINT!"=="s" (pause & exit /b 1)
) else (
  echo  [OK] Lint limpio
)

echo.
echo  --- 5/6 Compilando ^(tsc -b + vite build + functions build^) ---
call npm run build
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] La compilacion fallo. NO se despliega nada.
  echo      Lee el error de arriba: casi siempre es un error de tipos.
  pause & exit /b 1
)
echo  [OK] Compilado

echo.
echo  --- 6/6 Deploy a Firebase ---
echo   Orden del despliegue ^(importante, no lo cambies^):
echo     a^) Reglas e indices   - la seguridad primero
echo     b^) Cloud Functions    - el backend
echo     c^) Hosting            - la interfaz al final
echo   Si el frontend subiera antes que las reglas, habria unos
echo   segundos en que la app nueva pega contra reglas viejas.
echo.

echo  --- 6a. Reglas e indices ---
call firebase deploy --only firestore:rules,firestore:indexes,storage
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue de reglas. Me detengo aqui.
  pause & exit /b 1
)

echo.
echo  --- 6b. Cloud Functions ---
REM FIX: "User code failed to load. Cannot determine backend specification.
REM Timeout after 10000." -- el CLI de Firebase le da solo 10 segundos a
REM Node para cargar y analizar functions/lib/index.js antes de rendirse.
REM En Windows, con antivirus revisando los ~255 paquetes de
REM functions/node_modules mas el SDK de Gemini, 10s a veces no alcanza
REM aunque el codigo este bien -- no es un bug del proyecto. La solucion
REM oficial de Firebase es subir ese limite con esta variable de entorno
REM (ver https://firebase.google.com/docs/functions/tips#avoid_deployment_timeouts_during_initialization).
set FUNCTIONS_DISCOVERY_TIMEOUT=60
call firebase deploy --only functions
if errorlevel 1 (
  echo  [!] Primer intento fallo. Reintentando una vez mas...
  echo      la primera carga de node_modules en disco suele ser la mas lenta;
  echo      un segundo intento casi siempre pasa.
  call firebase deploy --only functions
)
if errorlevel 1 (
  color 0E
  echo  [!] Fallo el despliegue de funciones despues de 2 intentos.
  echo      Si el error menciona la clave GEMINI_API_KEY,
  echo      corre CONFIGURAR_CLAVE_GEMINI.bat.
  echo      Si sigue diciendo "Timeout after 10000" o similar, excluye
  echo      la carpeta del proyecto del antivirus del escaneo -- ver
  echo      instrucciones que Claude te compartio -- y vuelve a intentar.
  set /p CONTINUAR_FN="  Continuo con el frontend de todos modos? (s/n): "
  if /i not "!CONTINUAR_FN!"=="s" (pause & exit /b 1)
)

echo.
echo  --- 6c. Hosting ---
call firebase deploy --only hosting
if errorlevel 1 (
  REM FIX: se ha visto que "firebase deploy --only hosting" a veces
  REM imprime "Deploy complete!" con las URLs de los dos sitios YA
  REM publicadas, y aun asi el proceso termina con un
  REM "Error: An unexpected error has occurred." y codigo de salida
  REM distinto de cero -- un problema conocido del propio CLI de Firebase,
  REM no del proyecto. Reintentar una vez suele bastar; si el sitio ya
  REM quedo publicado, este segundo intento es casi instantaneo.
  echo  [!] Primer intento de Hosting fallo o el CLI reporto un error
  echo      inesperado despues de "Deploy complete!". Reintentando...
  call firebase deploy --only hosting
)
if errorlevel 1 (
  color 0C
  echo  [X] Fallo el despliegue del frontend despues de 2 intentos.
  echo      Revisa arriba: si ya viste "Deploy complete!" con las URLs
  echo      de control-de-bolsas-69.web.app y control-de-bolsas-89c88.web.app
  echo      antes del error, es muy probable que SI se haya publicado bien
  echo      -- entra a las URLs para confirmar antes de preocuparte.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    INSTALACION + BUILD + DEPLOY COMPLETOS
echo    https://control-de-bolsas-69.web.app
echo.
echo    REGLA DE ORO: despues de desplegar, SIEMPRE
echo      1. git add / commit / push
echo      2. pwsh .\backup.ps1
echo  ============================================================
echo.
set /p GITPUSH="  Corro PUSH_TO_GIT.bat ahora? (s/n): "
if /i "!GITPUSH!"=="s" (
  if exist "PUSH_TO_GIT.bat" (
    call PUSH_TO_GIT.bat
  ) else (
    echo  [!] No encontre PUSH_TO_GIT.bat en el proyecto.
  )
)
pause
exit /b 0
