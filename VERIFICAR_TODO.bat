@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title VERIFICAR - Control Bolsas v5.3
color 0B
cls
echo.
echo  ============================================================
echo    VERIFICAR QUE TODO QUEDO BIEN INSTALADO
echo  ============================================================
echo.

if not exist "firebase.json" (
  echo  [X] Corre esto DENTRO de la carpeta del proyecto.
  pause
  exit /b 1
)

set FALLAS=0

echo  [1/5] Patron abierto "^admin@.*" en las reglas...
findstr /c:"admin@.*" firestore.rules >nul 2>nul
if not errorlevel 1 (
  echo        [X] TODAVIA esta en firestore.rules
  set /a FALLAS+=1
) else ( echo        [OK] Ya no esta )

findstr /c:"admin@.*" storage.rules >nul 2>nul
if not errorlevel 1 (
  echo        [X] TODAVIA esta en storage.rules
  set /a FALLAS+=1
) else ( echo        [OK] Ya no esta )

findstr /c:"startsWith('admin@')" src\context\AuthContext.tsx >nul 2>nul
if not errorlevel 1 (
  echo        [X] AuthContext TODAVIA se autoprovisiona con admin@
  set /a FALLAS+=1
) else ( echo        [OK] Ya no esta )

echo.
echo  [2/5] Datos de cartera fuera del repositorio...
set SEC2=0
for %%f in ("contrarecibos.json" "facturas_pendientes_contrarecibo.json" "public\contrarecibos.json" "public\facturas_pendientes_contrarecibo.json") do (
  if exist "%%~f" (
    echo        [X] TODAVIA existe %%~f
    set /a FALLAS+=1
    set /a SEC2+=1
  )
)
if !SEC2!==0 ( echo        [OK] Ninguno de los cuatro esta presente )

echo.
echo  [3/5] La plantilla del respaldo offline no trae datos reales...
findstr /c:"GT-742" public\respaldo\control-bolsas-offline.html >nul 2>nul
if not errorlevel 1 (
  echo        [X] TODAVIA trae la cartera real incrustada
  set /a FALLAS+=1
) else ( echo        [OK] Plantilla limpia )

echo.
echo  [4/5] La cartera no viaja dentro del JS de la app...
findstr /c:"GT-742" src\lib\seedData.ts >nul 2>nul
if not errorlevel 1 (
  echo        [X] TODAVIA esta en seedData.ts - se descarga a cualquiera
  echo            que abra la pantalla de login
  set /a FALLAS+=1
) else ( echo        [OK] seedData.ts vacio )

echo.
echo  [5/5] Compilando para confirmar que nada se rompio...
call npm run typecheck >nul 2>nul
if errorlevel 1 (
  echo        [X] TypeScript marca errores. Corre "npm run typecheck" para verlos.
  set /a FALLAS+=1
) else ( echo        [OK] TypeScript limpio )

echo.
echo  ------------------------------------------------------------
if !FALLAS!==0 (
  color 0A
  echo    TODO EN ORDEN. Ya puedes correr INSTALL_AND_DEPLOY.bat
) else (
  color 0C
  echo    !FALLAS! cosa^(s^) por resolver, marcadas con [X] arriba.
  echo    Vuelve a correr INSTALAR_ACTUALIZACION.bat con el zip al lado.
)
echo  ------------------------------------------------------------
pause
