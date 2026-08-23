@echo off
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Restaurar respaldo" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Restaurar respaldo (deshacer parche v8.9.13)
color 0E
cls
echo.
echo  ============================================================
echo    RESTAURAR TU PROYECTO A COMO ESTABA ANTES DE v8.9.13
echo  ============================================================
echo.
echo   El parche v8.9.13 que instale se construyo sobre una copia
echo   vieja de tu proyecto (se me habian pasado varias versiones,
echo   tu proyecto real ya estaba en v8.9.18) y por eso pisó
echo   archivos tuyos mas nuevos con versiones viejas -- el
echo   typecheck fallo por eso, no llego a tocar Firestore ni a
echo   desplegar nada.
echo.
echo   Este script regresa TODO tu proyecto exactamente a como
echo   estaba justo antes de que corrieras INSTALAR_v8.9.13.bat,
echo   usando el respaldo que el propio instalador hizo automatico
echo   en la carpeta:
echo     _respaldo_202600Su_234053
echo.
cd /d "%~dp0"

if not exist "_respaldo_202600Su_234053" (
  color 0C
  echo  [X] No encuentro la carpeta de respaldo "_respaldo_202600Su_234053"
  echo      junto a este script. Si la moviste o renombraste, dime el
  echo      nombre exacto y ajusto el script.
  pause
  exit /b 1
)

echo  --- Restaurando desde el respaldo ---
robocopy "_respaldo_202600Su_234053" "%~dp0." /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" "_ARCHIVO_OBSOLETO" /XF *.log >nul
if errorlevel 8 (
  color 0C
  echo  [X] robocopy reporto un error serio al restaurar. Revisa arriba.
  pause
  exit /b 1
)

echo  [OK] Proyecto restaurado a su estado de antes de v8.9.13.
echo.
echo  --- Verificando (typecheck) ---
call npm run typecheck
if errorlevel 1 (
  color 0C
  echo  [!] El typecheck todavia marca errores despues de restaurar.
  echo      Avisame y lo revisamos juntos -- NO corras
  echo      INSTALAR_BUILD_DEPLOY.bat todavia.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. Tu proyecto esta de vuelta en su estado real
echo    (v8.9.18), sin nada del parche v8.9.13 a medio poner.
echo    NO corras INSTALAR_BUILD_DEPLOY.bat todavia -- espera a
echo    que te mande un parche v8.9.19 construido sobre tu
echo    version real.
echo  ============================================================
echo.
pause
exit /b 0
