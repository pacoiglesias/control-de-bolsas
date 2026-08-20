@echo off
chcp 65001 >nul
title Control Bolsas - Diagnostico de Velocidad
color 0B
cd /d "%~dp0"

if not exist "DIAGNOSTICO_VELOCIDAD.ps1" (
  color 0C
  echo  [X] No encuentro DIAGNOSTICO_VELOCIDAD.ps1 en esta carpeta.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0DIAGNOSTICO_VELOCIDAD.ps1"
exit /b %ERRORLEVEL%
