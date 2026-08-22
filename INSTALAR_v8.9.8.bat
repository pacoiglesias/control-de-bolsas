@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.8" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.8
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.8
echo    Lector Inteligente tambien al subir PDFs + 3 archivos
echo    grandes ordenados por dentro + etiqueta visual "IA".
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Lector Inteligente (IA con Gemini) tambien al subir un PDF
echo      directamente en /subir, no solo en Captura Rapida. Si el
echo      PDF trae folio/cliente/kilos/conceptos legibles, el
echo      expediente nace ya precargado; si la IA falla o no
echo      encuentra nada util, cae exactamente al expediente en
echo      blanco de siempre (nunca bloquea la subida).
echo    - Etiqueta morada "IA" junto a cada producto que la IA
echo      lleno automaticamente, dentro del expediente ^(pestana
echo      Productos^), para que se revise con mas cuidado antes de
echo      confirmar. La IA nunca factura ni cobra nada por si sola.
echo    - Los 3 archivos mas grandes del sistema ^(Cobranza,
echo      Portal Maquilador, Dashboard^) se ordenaron por dentro en
echo      piezas mas chicas y faciles de mantener, SIN cambiar nada
echo      de como se ven ni se usan.
echo    - Se reviso el aviso de "proveedores parecidos a Andres"
echo      agregado en v8.9.7: no se pudo confirmar en vivo desde
echo      aqui porque necesita entrar al Portal Maquilador con el
echo      PIN real. Ver instrucciones abajo al terminar.
echo    - Se actualizo el documento de mejoras futuras: se explica
echo      que informacion o cuenta se necesita de ti para avanzar
echo      en facturacion automatica ^(PAC^), precios por cliente,
echo      avisos automaticos por WhatsApp/Email, y BI/proyecciones.
echo    - Verificado: tsc limpio, eslint 0 errores/0 advertencias,
echo      80/80 pruebas, build de produccion completo sin errores
echo      ^(frontend y Cloud Functions^).
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_8.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch898_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch898" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

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
echo    LISTO. v8.9.8 instalada.
echo    Este parche toca Cloud Functions (el Lector Inteligente
echo    compartido) ademas del frontend -^> necesita build + deploy
echo    completo (Hosting + Functions), no solo Hosting.
echo.
echo    Pendiente que solo tu puedes revisar: abre el Portal
echo    Maquilador, entra a "Estado de Cuenta" y revisa la consola
echo    del navegador (F12 -^> pestana Consola). Si aparece un aviso
echo    "Proveedores parecidos a Andres que NO se sumaron", copia
echo    el texto exacto y pasaselo a Claude para corregir la
echo    ortografia del registro que quedo fuera.
echo.
echo    Tambien: revisa docs\MEJORAS_FUTURAS.txt -^> ahi quedo
echo    anotado exactamente que cuenta o dato hace falta si quieres
echo    avanzar en facturacion automatica (PAC), precios por
echo    cliente, avisos automaticos o BI/proyecciones.
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
