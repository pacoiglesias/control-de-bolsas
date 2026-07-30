@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Subir a GitHub y respaldar
color 0B
cls
echo.
echo  ============================================================
echo    SUBIR A GITHUB  +  RESPALDO LOCAL
echo  ============================================================
echo.

cd /d "%~dp0"

if not exist "firebase.json" (color 0C & echo  [X] No estas en la carpeta del proyecto. & pause & exit /b 1)
where git >nul 2>nul || (color 0C & echo  [X] Git no esta instalado. & pause & exit /b 1)
if not exist ".git" (color 0C & echo  [X] Esta carpeta no es un repositorio git. & pause & exit /b 1)

for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD') do set "RAMA=%%b"
echo  Rama actual: !RAMA!
echo.
echo  --- Cambios pendientes ---
git status --short
echo.

git diff --quiet && git diff --cached --quiet
if not errorlevel 1 (
  echo  [=] No hay cambios que confirmar.
  goto RESPALDO
)

set /p MSG="  Mensaje del commit: "
if "!MSG!"=="" (
  echo  [X] El mensaje no puede ir vacio.
  pause & exit /b 1
)

git add .
git commit -m "!MSG!"

:PUSH
echo.
echo  [..] Subiendo a origin/!RAMA! ...
git push -u origin !RAMA!
if errorlevel 1 (
  color 0E
  echo.
  echo  [!] Fallo el push. Causa mas comun: el remoto tiene commits que tu no.
  set /p R="  Intento 'git pull --rebase' y vuelvo a subir? (s/n): "
  if /i "!R!"=="s" (
    git pull --rebase
    if errorlevel 1 (
      color 0C
      echo  [X] El rebase tiene conflictos. Resuelvelos a mano y vuelve a correr esto.
      pause & exit /b 1
    )
    goto PUSH
  )
  pause & exit /b 1
)
echo  [OK] Subido

:RESPALDO
echo.
echo  --- Respaldo local (rota y deja los ultimos 5) ---
if not exist "backup.ps1" (
  echo  [!] No encontre backup.ps1
  goto FIN
)
where pwsh >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -File ".\backup.ps1"
) else (
  pwsh -NoProfile -ExecutionPolicy Bypass -File ".\backup.ps1"
)

:FIN
color 0A
echo.
echo  ============================================================
echo    LISTO. Codigo en GitHub y respaldo local generado.
echo  ============================================================
pause
exit /b 0
