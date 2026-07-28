@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Diagnostico
color 0B
cls
echo.
echo  ============================================================
echo    DIAGNOSTICO COMPLETO
echo    Revisa tu computadora Y el lado de Firebase
echo  ============================================================
echo.

set FALLAS=0
set "PENDIENTE="

echo  --- TU COMPUTADORA ---
echo  Carpeta: %CD%
if exist "firebase.json" (echo  [OK] firebase.json) else (echo  [X ] firebase.json NO esta aqui & set /a FALLAS+=1)
if exist "package.json" (echo  [OK] package.json) else (echo  [X ] package.json NO esta aqui & set /a FALLAS+=1)
if exist ".env" (echo  [OK] .env existe) else (echo  [X ] falta .env  ^(copia .env.example^) & set /a FALLAS+=1)
if exist ".firebaserc" (echo  [OK] .firebaserc) else (echo  [X ] falta .firebaserc & set /a FALLAS+=1)
if exist "node_modules" (echo  [OK] dependencias frontend) else (echo  [! ] falta npm install)
if exist "functions\node_modules" (echo  [OK] dependencias backend) else (echo  [! ] falta npm --prefix functions install)
if exist "public\respaldo\control-bolsas-offline.html" (echo  [OK] respaldo HTML offline) else (echo  [! ] falta el HTML de respaldo)

REM .env con contenido real
if exist ".env" (
  findstr /r /c:"VITE_FIREBASE_API_KEY=..*" .env >nul 2>nul
  if errorlevel 1 (echo  [X ] .env existe pero la API KEY esta vacia & set /a FALLAS+=1) else (echo  [OK] .env tiene credenciales)
)

echo.
where node >nul 2>nul
if errorlevel 1 (echo  [X ] Node.js no instalado & set /a FALLAS+=1) else (for /f %%v in ('node -v') do echo  [OK] Node.js %%v)
where firebase >nul 2>nul
if errorlevel 1 (
  echo  [X ] Firebase CLI no instalado & set /a FALLAS+=1
  goto :final
) else (for /f "tokens=*" %%v in ('firebase --version') do echo  [OK] Firebase CLI %%v)
where git >nul 2>nul
if errorlevel 1 (echo  [! ] Git no instalado ^(solo afecta el respaldo^)) else (echo  [OK] Git)

echo.
echo  --- SESION ---
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [X ] Sesion vencida  --^>  corre CONECTAR_FIREBASE.bat
  set /a FALLAS+=1
  goto :final
)
echo  [OK] Sesion valida
for /f "tokens=*" %%p in ('firebase use 2^>nul') do echo  [..] %%p

echo.
echo  --- LADO DE FIREBASE ^(esto es lo que faltaba revisar^) ---

echo  [..] Aplicacion web registrada...
call firebase apps:list WEB 2>nul | findstr /i "WEB" >nul 2>nul
if errorlevel 1 (
  echo  [X ] No hay app WEB registrada. De ahi salen los datos del .env
  echo       https://console.firebase.google.com/project/control-de-bolsas-89c88/settings/general
  set /a FALLAS+=1
) else ( echo  [OK] App web registrada )

echo  [..] Base de datos Firestore...
call firebase firestore:databases:list >nul 2>nul
if errorlevel 1 (
  echo  [X ] Firestore no esta creado  --^>  PREPARAR_CONSOLA.bat, paso 2
  set /a FALLAS+=1
  set "PENDIENTE=1"
) else ( echo  [OK] Firestore creado )

echo  [..] Sitio de Hosting...
call firebase hosting:sites:list >nul 2>nul
if errorlevel 1 (
  echo  [! ] No pude verificar Hosting ^(puede que aun no exista^)
) else ( echo  [OK] Hosting disponible )

echo  [..] Clave de Gemini en Secret Manager...
call firebase functions:secrets:access GOOGLE_GENAI_API_KEY >nul 2>nul
if errorlevel 1 (
  echo  [X ] GOOGLE_GENAI_API_KEY no existe  --^>  CONFIGURAR_CLAVE_GEMINI.bat
  echo       ^(si el proyecto no es Blaze, primero eso^)
  set /a FALLAS+=1
) else ( echo  [OK] Clave de Gemini cargada )

echo.
echo  --- LO QUE NINGUN SCRIPT PUEDE VERIFICAR ---
echo  Estas cuatro cosas se activan a mano en la consola. Si el
echo  despliegue falla y todo lo de arriba dice OK, es una de estas:
echo.
echo    [ ] Plan Blaze activado
echo    [ ] Storage inicializado ^(boton "Comenzar"^)
echo    [ ] Authentication con correo/contrasena habilitado
echo    [ ] Documento admins/^<tu-uid^> creado en Firestore
echo.
echo  Corre PREPARAR_CONSOLA.bat y te lleva de la mano por las cuatro.

:final
echo.
echo  ------------------------------------------------------------
if %FALLAS%==0 (
  color 0A
  echo    Tu computadora esta en orden.
  echo    Si aun asi falla el despliegue, revisa la lista de arriba:
  echo    PREPARAR_CONSOLA.bat
) else (
  color 0E
  echo    %FALLAS% cosa^(s^) por resolver, marcadas con [X].
)
echo  ------------------------------------------------------------
pause
