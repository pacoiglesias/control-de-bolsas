@echo off
chcp 65001 >nul
title Control Bolsas - Limpiar .bat viejos
color 0B
cls
echo.
echo  ============================================================
echo    LIMPIAR SCRIPTS VIEJOS
echo  ============================================================
echo.
echo   Borra 6 archivos .bat que ya no se usan -- todos siguen en
echo   el historial de git por si algun dia hace falta recuperar
echo   alguno (git log --all --full-history -- nombre.bat).
echo.
echo   Superados por DESPLEGAR_ROBUSTO.bat:
echo     - INSTALAR_v6.76.0.bat
echo     - INSTALAR_v7.0.1.bat
echo     - INSTALAR_v7.0.2.bat
echo     - INSTALL_AND_DEPLOY.bat
echo     - DESPLEGAR_MEJORAS_2026-08-09.bat
echo     - DESPLEGAR_MEJORAS_2026-08-09_AUTO.bat
echo.
echo   Este script en si mismo se borra solo al final.
echo.
set /p CONF="  Confirmas borrar estos 6 archivos? (s/n): "
if /i not "%CONF%"=="s" (
  echo.
  echo   Cancelado. No se borro nada.
  pause
  exit /b 0
)

cd /d "%~dp0"
del /q "INSTALAR_v6.76.0.bat" 2>nul
del /q "INSTALAR_v7.0.1.bat" 2>nul
del /q "INSTALAR_v7.0.2.bat" 2>nul
del /q "INSTALL_AND_DEPLOY.bat" 2>nul
del /q "DESPLEGAR_MEJORAS_2026-08-09.bat" 2>nul
del /q "DESPLEGAR_MEJORAS_2026-08-09_AUTO.bat" 2>nul

echo.
echo  ============================================================
echo    LISTO. Archivos viejos borrados.
echo  ============================================================
echo.
pause
del /q "%~f0"
