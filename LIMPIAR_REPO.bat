@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Limpiar el repositorio
color 0E
cls
echo.
echo  ============================================================
echo    LIMPIAR EL REPOSITORIO DE GITHUB
echo  ============================================================
echo.
echo   En el primer commit se subieron cosas que no deberian estar
echo   en el repositorio:
echo.
echo     - las carpetas _respaldo_* que crea el instalador
echo     - los archivos .zip de las actualizaciones
echo     - tsconfig.tsbuildinfo
echo.
echo   Este script las QUITA DEL REPOSITORIO pero las DEJA EN TU
echo   DISCO. No pierdes ningun respaldo: solo dejan de subirse.
echo.

if not exist ".git" (
  color 0C
  echo  [X] Esta carpeta no es un repositorio git. Nada que limpiar.
  pause & exit /b 1
)
if not exist "firebase.json" (
  color 0C
  echo  [X] No veo firebase.json. Corre esto dentro de la carpeta del proyecto.
  pause & exit /b 1
)

echo  Lo que se va a dejar de rastrear:
git ls-files "_respaldo_*" "*.zip" "*.tsbuildinfo" 2>nul | more
echo.
set /p SIGO="  Continuo? (s/n): "
if /i not "!SIGO!"=="s" ( echo  Cancelado. & pause & exit /b 0 )

echo.
echo  [..] Actualizando .gitignore...
findstr /c:"_respaldo_" .gitignore >nul 2>nul
if errorlevel 1 (
  echo.>> .gitignore
  echo # Respaldos que crea INSTALAR_ACTUALIZACION.bat>> .gitignore
  echo _respaldo_*/>> .gitignore
)
findstr /c:"*.zip" .gitignore >nul 2>nul
if errorlevel 1 (
  echo.>> .gitignore
  echo # Paquetes de actualizacion>> .gitignore
  echo *.zip>> .gitignore
)
findstr /c:"tsbuildinfo" .gitignore >nul 2>nul
if errorlevel 1 echo *.tsbuildinfo>> .gitignore

echo  [..] Quitando del indice de git ^(los archivos se quedan en tu disco^)...
for /f "delims=" %%f in ('git ls-files "_respaldo_*" 2^>nul') do git rm --cached "%%f" -q >nul 2>nul
for /f "delims=" %%f in ('git ls-files "*.zip" 2^>nul') do git rm --cached "%%f" -q >nul 2>nul
for /f "delims=" %%f in ('git ls-files "*.tsbuildinfo" 2^>nul') do git rm --cached "%%f" -q >nul 2>nul

echo  [..] Confirmando el cambio...
git add .gitignore
git commit -m "limpieza: sacar respaldos, zips y tsbuildinfo del repositorio" -q
if errorlevel 1 (
  echo  [!] No habia nada que confirmar. Es posible que ya estuviera limpio.
)

echo  [..] Subiendo a GitHub...
git push
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo subir. Revisa tu conexion o permisos del repositorio.
  pause & exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    REPOSITORIO LIMPIO
echo.
echo    Tus carpetas _respaldo_* siguen intactas en el disco:
dir /b /ad _respaldo_* 2>nul
echo.
echo    Cuando compruebes que todo funciona, puedes borrarlas
echo    a mano desde el Explorador para liberar espacio.
echo  ============================================================
pause
