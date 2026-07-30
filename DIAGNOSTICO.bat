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

echo  --- Carpeta del proyecto ---
if exist "firebase.json" (echo  [OK] firebase.json) else (echo  [X] No hay firebase.json: no estas en la carpeta del proyecto & set /a FALLOS+=1)
if exist "package.json" (echo  [OK] package.json) else (echo  [X] Falta package.json & set /a FALLOS+=1)

echo.
echo  --- Herramientas ---
where node >nul 2>nul && (for /f "tokens=*" %%v in ('node -v') do echo  [OK] Node %%v) || (echo  [X] Node no instalado - https://nodejs.org & set /a FALLOS+=1)
where npm  >nul 2>nul && (echo  [OK] npm) || (echo  [X] npm no disponible & set /a FALLOS+=1)
where git  >nul 2>nul && (echo  [OK] git) || (echo  [!] git no instalado: PUSH_TO_GIT.bat no va a funcionar)
where firebase >nul 2>nul && (echo  [OK] Firebase CLI) || (echo  [X] Firebase CLI no instalado - corre: npm i -g firebase-tools & set /a FALLOS+=1)

echo.
echo  --- Dependencias ---
if exist "node_modules" (echo  [OK] node_modules) else (echo  [X] Faltan dependencias - CONTROL_MAESTRO.bat opcion 1 & set /a FALLOS+=1)
if exist "functions\node_modules" (echo  [OK] functions\node_modules) else (echo  [X] Faltan dependencias de functions & set /a FALLOS+=1)

echo.
echo  --- Configuracion local ---
if exist ".env" (
  echo  [OK] .env presente
  findstr /c:"VITE_FIREBASE_API_KEY=" .env >nul 2>nul && (
    findstr /r /c:"VITE_FIREBASE_API_KEY=.\{10,\}" .env >nul 2>nul && echo  [OK] VITE_FIREBASE_API_KEY tiene valor || (echo  [X] VITE_FIREBASE_API_KEY esta vacia & set /a FALLOS+=1)
  ) || (echo  [X] Falta VITE_FIREBASE_API_KEY en .env & set /a FALLOS+=1)
) else (
  echo  [X] No hay .env - copia .env.example y llenalo
  set /a FALLOS+=1
)
if exist ".firebaserc" (echo  [OK] .firebaserc) else (echo  [X] Falta .firebaserc & set /a FALLOS+=1)

echo.
echo  --- Sesion de Firebase ---
firebase projects:list >nul 2>nul && (echo  [OK] Sesion activa) || (echo  [X] Sesion vencida - corre CONECTAR_FIREBASE.bat & set /a FALLOS+=1)

echo.
echo  --- Clave de Gemini ---
firebase functions:secrets:access GOOGLE_GENAI_API_KEY >nul 2>nul && (echo  [OK] GOOGLE_GENAI_API_KEY configurada) || (echo  [!] No pude leerla - si la IA no procesa PDFs, corre CONFIGURAR_CLAVE_GEMINI.bat)

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
