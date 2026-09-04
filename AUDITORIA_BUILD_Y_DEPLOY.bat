@echo off
chcp 65001 >nul
title Control Bolsas - Verificar, Construir y Desplegar (Auditoria 2026-09-03)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0AUDITORIA_BUILD_Y_DEPLOY.ps1"
