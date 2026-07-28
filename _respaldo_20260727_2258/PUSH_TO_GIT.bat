@echo off
chcp 65001 >nul
title Control Bolsas v5 - Respaldo en GitHub
color 0B
setlocal

where git >nul 2>nul
if errorlevel 1 ( color 0C & echo  [X] Git no esta instalado: https://git-scm.com & pause & exit /b 1 )

if not exist ".git" (
  echo  Esta carpeta todavia no es un repositorio.
  git init
  git branch -M main
  git remote add origin https://github.com/pacoiglesias/control-de-bolsas.git
  echo  Repositorio conectado: pacoiglesias/control-de-bolsas
)

echo.
echo  Cambios detectados:
git status --short
echo.
set /p MSG="  Mensaje del commit (Enter para uno automatico): "
if "%MSG%"=="" set MSG=update: %DATE% %TIME%

git add .
git commit -m "%MSG%"
git push -u origin main

if errorlevel 1 (
  color 0C
  echo.
  echo  [X] No se pudo subir. Revisa que tengas permiso en el repositorio
  echo      y que la rama se llame main.
) else (
  color 0A
  echo.
  echo  [OK] Respaldo subido a GitHub.
)
pause
