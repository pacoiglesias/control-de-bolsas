@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.7" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.7
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.7
echo    Auditoria "Staff Engineer" completa (Fases 0-6): las 12
echo    correcciones aprobadas + investigacion de los montos del
echo    Portal Maquilador de Andres.
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Portal Maquilador de Andres: el match de proveedor exigia
echo      texto EXACTO ("andres") -^> ahora hace match si el nombre
echo      CONTIENE "andres", y avisa en la consola del navegador si
echo      queda algun proveedor parecido sin capturar. Es la causa
echo      mas probable de que los montos se vieran incorrectos.
echo    - Portal Maquilador: el mapeo de folios ya no descarga TODA
echo      la coleccion de ordenes de compra.
echo    - Los 5 listados principales (Expedientes, Compras, Caja
echo      Chica, Facturas, Catalogo) avisan si su limite de carga
echo      se alcanza, en vez de fallar en silencio.
echo    - Modo oscuro: tarjetas y menu de tres puntos ya no se ven
echo      con parches de color fijo (modo claro "atrapado").
echo    - Contraste de texto mejorado (hints, subtitulos) para
echo      cumplir el estandar de accesibilidad WCAG AA.
echo    - Saldo de Caja Chica y agrupado de Cobranza ya no se
echo      recalculan en cada tecla presionada.
echo    - Botones de icono mas faciles de tocar en celular (44px),
echo      menu de Reportes ya funciona con teclado.
echo    - Errores fuera de pantalla (botones, procesos en segundo
echo      plano) ya no se pierden -^> quedan guardados igual que los
echo      que si rompen la pantalla.
echo    - Respaldo automatico de medianoche: ya no guarda las 5
echo      colecciones juntas en un solo documento (riesgo de perder
echo      el respaldo completo si pasaba de 1 MB) -^> una por una.
echo    - Aviso temprano si algun expediente acumula demasiadas
echo      facturas y se acerca al limite de tamano de Firestore.
echo    - Verificado: tsc limpio, eslint 0 errores/0 advertencias,
echo      80/80 pruebas, build de produccion completo sin errores.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_7.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch897_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch897" "%~dp0." /E /IS /IT >nul
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
echo    LISTO. v8.9.7 instalada.
echo    Este parche toca Cloud Functions (Portal Maquilador,
echo    respaldo automatico, monitoreo de expedientes) ademas del
echo    frontend -^> necesita build + deploy completo (Hosting +
echo    Functions), no solo Hosting.
echo.
echo    Despues de desplegar: abre el Portal Maquilador, entra a
echo    "Estado de Cuenta" y revisa la consola del navegador (F12).
echo    Si aparece un aviso "Proveedores parecidos a Andres que NO
echo    se sumaron", avisale a Claude con el texto exacto que
echo    aparezca -^> eso confirmaria la causa de los montos que se
echo    veian raros y se puede corregir la ortografia del registro.
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
