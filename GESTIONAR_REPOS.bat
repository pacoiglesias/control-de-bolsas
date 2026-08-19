@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Gestionar visibilidad de tus repos
color 0B
cls
echo.
echo  ============================================================
echo    GESTIONAR TUS REPOSITORIOS DE GITHUB (privado / publico)
echo  ============================================================
echo.
cd /d "%~dp0"

where gh >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No encuentro el CLI de GitHub ^(gh^) instalado.
  echo      Corre INSTALAR_GH.bat primero.
  pause
  exit /b 1
)

echo  --- Verificando sesion de GitHub ---
call gh auth status >nul 2>nul
if errorlevel 1 (
  echo  [!] No hay sesion activa. Abriendo el navegador para que
  echo      inicies sesion tu mismo...
  call gh auth login --web --git-protocol https
  if errorlevel 1 (
    color 0C
    echo  [X] No se pudo iniciar sesion en GitHub.
    pause & exit /b 1
  )
) else (
  echo  [OK] Sesion de GitHub activa
)

goto :CARGAR

:CARGAR
echo.
echo  --- Consultando tus repositorios en GitHub... ---
set "TMPLIST=%TEMP%\cb_repos_%RANDOM%.txt"
call gh repo list --limit 200 --json nameWithOwner,visibility -q ".[] | .nameWithOwner + \"|\" + .visibility" > "!TMPLIST!" 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] No pude obtener la lista de repositorios.
  if exist "!TMPLIST!" del "!TMPLIST!" >nul 2>nul
  pause & exit /b 1
)

set N=0
for /f "usebackq tokens=1,2 delims=|" %%a in ("!TMPLIST!") do (
  set /a N+=1
  set "REPO_!N!=%%a"
  set "VIS_!N!=%%b"
)
if exist "!TMPLIST!" del "!TMPLIST!" >nul 2>nul

if !N!==0 (
  color 0C
  echo  [X] No encontre ningun repositorio en tu cuenta de GitHub.
  pause & exit /b 1
)

:MOSTRAR
cls
echo.
echo  ============================================================
echo    TUS REPOSITORIOS  ^(!N! encontrados^)
echo  ============================================================
echo.
for /l %%i in (1,1,!N!) do echo   %%i^) !REPO_%%i!   -   !VIS_%%i!
echo.
echo  ------------------------------------------------------------
echo   Escribe el NUMERO del repo que quieras cambiar, o:
echo     TODOS PRIVADO   - vuelve PRIVADOS todos los de la lista
echo     TODOS PUBLICO   - vuelve PUBLICOS todos los de la lista
echo     FIN             - salir
echo  ------------------------------------------------------------
set "OPCION="
set /p OPCION="  > "

if "!OPCION!"=="" goto :MOSTRAR
if /i "!OPCION!"=="FIN" goto :FINAL

if /i "!OPCION!"=="TODOS PRIVADO" (
  for /l %%i in (1,1,!N!) do (
    echo  Cambiando !REPO_%%i! a privado...
    call gh repo edit "!REPO_%%i!" --visibility private --accept-visibility-change-consequences >nul 2>nul
  )
  pause
  goto :CARGAR
)

if /i "!OPCION!"=="TODOS PUBLICO" (
  set "CONFIRMAR="
  set /p CONFIRMAR="  Esto expone TODOS tus repos a internet. Escribe 'si' para confirmar: "
  if /i "!CONFIRMAR!"=="si" (
    for /l %%i in (1,1,!N!) do (
      echo  Cambiando !REPO_%%i! a publico...
      call gh repo edit "!REPO_%%i!" --visibility public --accept-visibility-change-consequences >nul 2>nul
    )
  ) else (
    echo  [-] Cancelado. No se cambio nada.
  )
  pause
  goto :CARGAR
)

set "ESNUM="
for /f "delims=0123456789" %%x in ("!OPCION!") do set "ESNUM=NO"
if defined ESNUM (
  echo  [!] No entendi esa opcion. Usa un numero, o TODOS PRIVADO / TODOS PUBLICO / FIN.
  pause
  goto :MOSTRAR
)
if !OPCION! LSS 1 (
  echo  [!] Numero fuera de rango.
  pause
  goto :MOSTRAR
)
if !OPCION! GTR !N! (
  echo  [!] Numero fuera de rango.
  pause
  goto :MOSTRAR
)

set "ELEGIDO=!REPO_%OPCION%!"
set "VISACTUAL=!VIS_%OPCION%!"
echo.
echo   !ELEGIDO!  ^(actualmente: !VISACTUAL!^)
set "NUEVA="
set /p NUEVA="  Escribe PRIVADO o PUBLICO: "
if /i "!NUEVA!"=="PRIVADO" (
  call gh repo edit "!ELEGIDO!" --visibility private --accept-visibility-change-consequences
) else if /i "!NUEVA!"=="PUBLICO" (
  set "CONFIRMAR2="
  set /p CONFIRMAR2="  Seguro que quieres exponer !ELEGIDO! a internet? Escribe 'si': "
  if /i "!CONFIRMAR2!"=="si" (
    call gh repo edit "!ELEGIDO!" --visibility public --accept-visibility-change-consequences
  ) else (
    echo  [-] Cancelado.
  )
) else (
  echo  [!] Opcion no valida. Escribe PRIVADO o PUBLICO.
)
pause
goto :CARGAR

:FINAL
color 0A
echo.
echo  ============================================================
echo    LISTO.
echo  ============================================================
pause
exit /b 0
