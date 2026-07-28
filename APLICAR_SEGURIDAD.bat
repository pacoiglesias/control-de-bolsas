@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title APLICAR SEGURIDAD - Control Bolsas
color 0C
cls
echo.
echo  ============================================================
echo    APLICAR SEGURIDAD Y PUBLICAR
echo  ============================================================
echo.
echo   Esto hace las tres cosas de un jalon:
echo     1. Borra los datos de cartera que estan publicados
echo     2. Recompila con las reglas corregidas
echo     3. Publica todo: hosting, reglas de Firestore y de Storage
echo.
echo   Mientras no se publique, tu cartera sigue en linea.
echo.

if not exist "firebase.json" (
  echo  [X] Corre esto DENTRO de la carpeta del proyecto
  echo      ^(la que tiene firebase.json^). Estas en:
  echo      %CD%
  pause
  exit /b 1
)

echo  [1/4] Buscando datos de cartera en todas las carpetas...
set BORRADOS=0
for %%f in ("contrarecibos.json" "facturas_pendientes_contrarecibo.json") do (
  if exist "%%~f" (
    del /f /q "%%~f"
    set /a BORRADOS+=1
    echo        [-] %%~f
  )
  if exist "public\%%~f" (
    del /f /q "public\%%~f"
    set /a BORRADOS+=1
    echo        [-] public\%%~f
  )
)
REM barrido recursivo por si quedaron copias en subcarpetas
for /r %%f in (contrarecibos.json facturas_pendientes_contrarecibo.json) do (
  if exist "%%f" (
    echo %%f | findstr /i "node_modules _respaldo_ .git" >nul
    if errorlevel 1 (
      del /f /q "%%f"
      set /a BORRADOS+=1
      echo        [-] %%f
    )
  )
)
if !BORRADOS!==0 (echo        Nada que borrar, ya estaban fuera.) else (echo        !BORRADOS! archivo^(s^) eliminado^(s^))

echo.
echo  [2/4] Revisando que las reglas ya no tengan el patron abierto...
findstr /c:"^admin@" firestore.rules >nul 2>nul
if not errorlevel 1 (
  color 0C
  echo        [X] firestore.rules TODAVIA tiene "^admin@.*"
  echo            El parche no se instalo. Corre primero
  echo            INSTALAR_ACTUALIZACION.bat y vuelve aqui.
  pause
  exit /b 1
)
findstr /c:"admin@" src\context\AuthContext.tsx >nul 2>nul
if not errorlevel 1 (
  color 0C
  echo        [X] AuthContext.tsx TODAVIA se autoprovisiona con admin@
  echo            El parche no se instalo completo.
  pause
  exit /b 1
)
echo        [OK] Reglas y AuthContext limpios

echo.
echo  [3/4] Compilando...
call npm run build
if errorlevel 1 (
  color 0C
  echo        [X] Fallo la compilacion. No publico nada asi.
  pause
  exit /b 1
)
echo        [OK] Compilado

echo.
echo  [4/4] Publicando hosting y reglas...
call firebase deploy --only hosting,firestore:rules,storage
if errorlevel 1 (
  color 0C
  echo.
  echo  [X] FALLO LA PUBLICACION. Tu cartera SIGUE EN LINEA.
  echo      Si dice "Authentication Error", corre CONECTAR_FIREBASE.bat
  echo      y vuelve a intentar. No lo dejes a medias.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO
echo.
echo    Comprueba tu mismo abriendo esta direccion:
echo      https://control-de-bolsas-89c88.web.app/contrarecibos.json
echo    Debe responder "Page Not Found".
echo  ============================================================
echo.
set /p AB="  La abro para que la veas? (s/n): "
if /i "!AB!"=="s" start "" https://control-de-bolsas-89c88.web.app/contrarecibos.json
pause
