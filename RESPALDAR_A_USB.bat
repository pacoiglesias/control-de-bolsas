@echo off
REM Mismo arreglo que los demas: si el .ps1 no llega a arrancar (error de
REM PowerShell, USB no conectada, etc.) esta ventana ya no se cierra sola
REM sin dejar ver el motivo.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Respaldar a USB" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
title Control Bolsas - Respaldar sistema completo a USB
cd /d "%~dp0"

if not exist "RESPALDAR_A_USB.ps1" (
  color 0C
  echo  [X] No encuentro RESPALDAR_A_USB.ps1 junto a este .bat.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo    RESPALDAR PROYECTO COMPLETO A USB
echo  ============================================================
echo.
echo   Conecta tu memoria USB antes de continuar si no la has
echo   conectado todavia. El script la detecta sola; si no la
echo   encuentra, te va a pedir la letra de unidad (ej. D:, E:).
echo.
echo   Este respaldo es completo a proposito -- incluye el codigo,
echo   el historial de Git, la documentacion y hasta lo que ya
echo   esta archivado en _ARCHIVO_OBSOLETO. Solo deja fuera lo que
echo   se reconstruye solo (node_modules, dist, cache de Firebase).
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0RESPALDAR_A_USB.ps1"
if errorlevel 1 (
  echo.
  echo  [!] El script termino con un error. Revisa el detalle de arriba.
  pause
)
exit /b 0
