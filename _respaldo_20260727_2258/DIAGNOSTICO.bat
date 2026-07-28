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

set FALLAS=0

echo  Carpeta actual: %CD%
if exist "firebase.json" (echo  [OK] firebase.json) else (echo  [X ] firebase.json NO esta aqui & set /a FALLAS+=1)
if exist "package.json" (echo  [OK] package.json) else (echo  [X ] package.json NO esta aqui & set /a FALLAS+=1)
if exist ".env" (echo  [OK] .env existe) else (echo  [X ] falta .env  ^(copia .env.example^) & set /a FALLAS+=1)
if exist ".firebaserc" (echo  [OK] .firebaserc existe) else (echo  [X ] falta .firebaserc & set /a FALLAS+=1)
if exist "node_modules" (echo  [OK] dependencias del frontend) else (echo  [! ] falta npm install)
if exist "functions\node_modules" (echo  [OK] dependencias del backend) else (echo  [! ] falta npm --prefix functions install)
if exist "public\respaldo\control-bolsas-offline.html" (echo  [OK] respaldo HTML offline incluido) else (echo  [! ] falta el HTML de respaldo)

echo.
where node >nul 2>nul
if errorlevel 1 (echo  [X ] Node.js no instalado & set /a FALLAS+=1) else (for /f %%v in ('node -v') do echo  [OK] Node.js %%v)
where firebase >nul 2>nul
if errorlevel 1 (echo  [X ] Firebase CLI no instalado & set /a FALLAS+=1) else (for /f "tokens=*" %%v in ('firebase --version') do echo  [OK] Firebase CLI %%v)
where git >nul 2>nul
if errorlevel 1 (echo  [! ] Git no instalado ^(solo afecta el respaldo^)) else (echo  [OK] Git listo)

echo.
echo  [..] Revisando sesion de Firebase...
call firebase projects:list >nul 2>nul
if errorlevel 1 (
  echo  [X ] Sesion vencida o sin iniciar  --^>  corre:  firebase login --reauth
  set /a FALLAS+=1
) else (
  echo  [OK] Sesion valida
  for /f "tokens=*" %%p in ('firebase use 2^>nul') do echo  [..] %%p
)

echo.
echo  [..] Revisando la clave de Gemini...
call firebase functions:secrets:access GOOGLE_GENAI_API_KEY >nul 2>nul
if errorlevel 1 (
  echo  [X ] GOOGLE_GENAI_API_KEY no esta configurada  --^>  corre CONFIGURAR_CLAVE_GEMINI.bat
  set /a FALLAS+=1
) else (
  echo  [OK] GOOGLE_GENAI_API_KEY existe en Secret Manager
)

echo.
echo  ------------------------------------------------------------
if %FALLAS%==0 (
  color 0A
  echo    TODO EN ORDEN. Puedes correr INSTALL_AND_DEPLOY.bat
) else (
  color 0E
  echo    %FALLAS% cosa^(s^) por resolver, marcadas con [X] arriba.
)
echo  ------------------------------------------------------------
pause
