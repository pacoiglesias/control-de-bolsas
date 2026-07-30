@echo off
chcp 65001 >nul
title Control Bolsas - Conectar Firebase
color 0B
cls
echo.
echo  ============================================================
echo    CONECTAR CON FIREBASE
echo  ============================================================
echo.
echo   Se abrira el navegador para que inicies sesion con la cuenta
echo   de Google que administra el proyecto.
echo.
cd /d "%~dp0"

where firebase >nul 2>nul
if errorlevel 1 (
  echo  [..] Firebase CLI no esta instalado. Lo instalo ahora...
  call npm install -g firebase-tools
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudo instalar. Abre esta ventana como Administrador.
    pause & exit /b 1
  )
)

echo  [..] Cerrando cualquier sesion anterior...
call firebase logout >nul 2>nul

echo  [..] Iniciando sesion...
call firebase login
if errorlevel 1 (
  color 0C
  echo  [X] No se completo el inicio de sesion.
  pause & exit /b 1
)

echo.
echo  [..] Proyectos disponibles:
call firebase projects:list

echo.
echo  [..] Fijando el proyecto de este repositorio...
call firebase use --add

color 0A
echo.
echo  ============================================================
echo    LISTO. Siguiente paso: DIAGNOSTICO.bat
echo  ============================================================
pause
exit /b 0
