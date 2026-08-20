@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar GitHub CLI
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR GITHUB CLI (gh)
echo  ============================================================
echo.
echo   Esto es lo unico que necesitas para que PROTEGER_CODIGO.bat
echo   funcione sin pedirte ningun token pegado.
echo.
cd /d "%~dp0"

where gh >nul 2>nul
if not errorlevel 1 (
  color 0A
  echo  [OK] El CLI de GitHub ya esta instalado.
  for /f "tokens=*" %%v in ('gh --version') do echo       %%v
  echo.
  pause
  exit /b 0
)

where winget >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro "winget" en este equipo ^(viene incluido en
  echo      Windows 10/11 actualizados^). Instala gh manualmente desde:
  echo        https://cli.github.com
  pause
  exit /b 1
)

echo  --- Instalando GitHub CLI con winget ---
echo   Puede pedirte confirmar un permiso de administrador; es normal.
echo.
call winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] La instalacion con winget fallo. Instala gh manualmente
  echo      desde: https://cli.github.com
  pause
  exit /b 1
)

echo.
echo  [!] Importante: cierra esta ventana y abre PROTEGER_CODIGO.bat
echo      de nuevo ^(una ventana nueva ya reconoce el comando "gh"^).
echo.
color 0A
echo  ============================================================
echo    LISTO. GitHub CLI instalado.
echo  ============================================================
pause
exit /b 0
