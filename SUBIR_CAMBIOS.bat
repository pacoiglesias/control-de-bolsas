@echo off
chcp 65001 >nul
title Control Bolsas - Subir cambios a GitHub
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0SUBIR_CAMBIOS.ps1"
