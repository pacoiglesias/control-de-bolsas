@echo off
chcp 65001 >nul
title Control Bolsas v5 - Modo desarrollo
color 0E
if not exist "node_modules" call npm install
echo.
echo  Abriendo http://localhost:5173  (Ctrl+C para detener^)
echo.
call npm run dev
pause
