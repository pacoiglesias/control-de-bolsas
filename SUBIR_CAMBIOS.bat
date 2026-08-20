@echo off
REM Mismo arreglo que los demas: si el .ps1 no llega a arrancar (error de
REM PowerShell, ruta rota, etc.) esta ventana ya no se cierra sola sin dejar
REM ver el motivo.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Subir Cambios a GitHub" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
title Control Bolsas - Subir cambios a GitHub
cd /d "%~dp0"

if not exist "SUBIR_CAMBIOS.ps1" (
  color 0C
  echo  [X] No encuentro SUBIR_CAMBIOS.ps1 junto a este .bat.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SUBIR_CAMBIOS.ps1"
if errorlevel 1 (
  echo.
  echo  [!] El script termino con un error. Revisa el detalle de arriba.
  pause
)
exit /b 0
