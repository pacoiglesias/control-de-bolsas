@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.10" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.10
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.10
echo    Correccion de la regresion de v8.9.9 (recharts) +
echo    auditoria completa contra el repositorio real.
echo  ============================================================
echo.
echo   Que paso con v8.9.9:
echo    - Al correr INSTALAR_v8.9.9.bat, el typecheck fallo con
echo      "Cannot find module 'recharts'". Esto lo cause yo: el
echo      entorno donde arme v8.9.9 le faltaban 4 archivos nuevos
echo      del Dashboard (los que dibujan las graficas), y por eso
echo      concluir por error que "recharts" no se usaba en ningun
echo      lado y lo quite de package.json.
echo.
echo   Que hace este parche:
echo    - Restaura "recharts" en package.json (ya viene correcto,
echo      "npm install" de abajo lo instala solo, sin pasos
echo      especiales).
echo    - Re-sincroniza los 4 archivos del Dashboard que faltaban
echo      (graficas, tarjetas KPI, tablas, boton flotante).
echo    - Como ese entorno incompleto tambien pudo esconder otros
echo      bugs, se repitio la auditoria completa contra los
echo      archivos que nunca se habian revisado: se encontraron y
echo      corrigieron 8 sitios mas con la formula de comision del
echo      contador mal calculada (ignoraba tu configuracion de
echo      IVA/base de comision) y 6 reportes mas sin la limpieza
echo      de seguridad (escapeHtml) que ya tenian los demas.
echo    - AuditSync.tsx (una de las pantallas mas grandes) se
echo      dividio para que sea mas facil de mantener, sin tocar
echo      su funcionamiento.
echo    - 17 lugares mas donde un error solo se veia en la consola
echo      del navegador ahora tambien quedan guardados, para poder
echo      diagnosticar problemas sin depender de que alguien haya
echo      visto la pantalla en el momento exacto.
echo    - Verificado: tsc limpio (frontend y Cloud Functions),
echo      61/61 pruebas, build de produccion completo sin errores.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_10.zip"
if not exist "%ZIPFILE%" (
  color 0C
  echo  [X] No encuentro "%ZIPFILE%" junto a este .bat.
  pause
  exit /b 1
)

set "TS=%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set "TS=%TS: =0%"
set "BACKUP=_respaldo_%TS%"
echo  --- Respaldando el proyecto completo en "%BACKUP%" ---
robocopy "%~dp0." "%~dp0%BACKUP%" /E /XD node_modules dist .git .firebase functions\node_modules functions\lib "_respaldo_*" "_ARCHIVO_OBSOLETO" /XF *.log >nul
echo  [OK] Respaldo hecho.

echo.
echo  --- Extrayendo el parche ---
set "TMPEXTRACT=%TEMP%\cb_patch8910_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch8910" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Instalando dependencias (recharts vuelve a quedar instalado) ---
call npm install
if errorlevel 1 (
  color 0E
  echo  [!] npm install marco errores. Revisa arriba.
  pause
  exit /b 1
)

echo.
echo  --- Verificando (typecheck + pruebas) ---
call npm run typecheck
if errorlevel 1 (
  color 0E
  echo  [!] El typecheck del frontend marco errores. Revisa arriba.
  pause
  exit /b 1
)
pushd functions
call npx tsc --noEmit
set RC_FN=%ERRORLEVEL%
popd
if %RC_FN% NEQ 0 (
  color 0E
  echo  [!] El typecheck de Cloud Functions marco errores. Revisa arriba.
  pause
  exit /b 1
)
call npm test
if errorlevel 1 (
  color 0E
  echo  [!] Las pruebas unitarias fallaron. Revisa arriba antes de desplegar.
  pause
  exit /b 1
)

color 0A
echo.
echo  ============================================================
echo    LISTO. v8.9.10 instalada.
echo    Este parche solo toca el frontend y un comentario sin
echo    efecto en Cloud Functions -^> con build + deploy de
echo    Hosting es suficiente (no requiere tocar Reglas ni
echo    Indices ni volver a desplegar Cloud Functions).
echo  ============================================================
echo.
set /p BD="  Corro INSTALAR_BUILD_DEPLOY.bat ahora? (s/n): "
if /i "!BD!"=="s" (
  if exist "INSTALAR_BUILD_DEPLOY.bat" (
    call INSTALAR_BUILD_DEPLOY.bat _EN_VENTANA_FIJA_
  ) else (
    echo  [!] No encontre INSTALAR_BUILD_DEPLOY.bat en esta carpeta.
  )
)
pause
exit /b 0
