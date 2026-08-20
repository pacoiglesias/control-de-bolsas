@echo off
chcp 65001 >nul
title Control Bolsas - Gestionar visibilidad de tus repos
color 0B
cd /d "%~dp0"

REM FIX: la version anterior armaba el filtro de "gh" directo en esta
REM ventana de comandos, con un caracter "|" escapado entre comillas.
REM cmd.exe interpreta ese "|" como si fuera para conectar dos comandos
REM (aunque estuviera "escapado"), asi que el filtro se rompia antes de
REM llegar a gh. Ahora toda la logica de listar/elegir repos vive en
REM GESTIONAR_REPOS.ps1 (PowerShell), que no tiene ese problema.

if not exist "GESTIONAR_REPOS.ps1" (
  color 0C
  echo  [X] No encuentro GESTIONAR_REPOS.ps1 en esta carpeta.
  echo      Debe estar junto a este .bat.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GESTIONAR_REPOS.ps1"
exit /b %ERRORLEVEL%
