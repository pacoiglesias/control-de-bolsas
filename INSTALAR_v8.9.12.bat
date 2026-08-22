@echo off
REM Mismo arreglo que los demas scripts de esta sesion: se relanza en una
REM ventana fija (cmd /k) para que Windows nunca la cierre sola, pase lo
REM que pase.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Instalar parche v8.9.12" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Instalar parche v8.9.12
color 0B
cls
echo.
echo  ============================================================
echo    INSTALAR PARCHE v8.9.12
echo    Recordatorios de vencimiento por email (SendGrid) --
echo    primer paso de "Automatizacion de Cobranza".
echo  ============================================================
echo.
echo   Que hace este parche:
echo    - Agrega una Cloud Function que, todos los dias a las 8 AM,
echo      revisa que facturas vencen manana o vencen hoy (solo las
echo      que ya tienen contrarecibo) y le manda un correo al
echo      cliente. Nunca reenvia el mismo aviso dos veces.
echo    - NO envia nada todavia: hace falta que tu crees tu propia
echo      cuenta de SendGrid y me des 2 datos para activarlo (ver
echo      abajo). Mientras tanto el sistema simplemente no hace
echo      nada, sin errores.
echo    - De paso corrige un hueco que encontre en COMO se
echo      instalan los parches de esta serie: ninguno corria
echo      "npm install" dentro de la carpeta functions -- nunca
echo      habia importado hasta que este parche agrego una
echo      dependencia nueva ahi (@sendgrid/mail). Ya esta
echo      corregido en este mismo instalador.
echo.
echo   DESPUES de instalar este parche, para activar los correos:
echo    1. Crea una cuenta en sendgrid.com (tiene plan gratuito).
echo    2. Verifica un correo remitente (Settings -^> Sender
echo       Authentication).
echo    3. Genera una API Key (Settings -^> API Keys).
echo    4. Corre estos 2 comandos desde esta carpeta:
echo         firebase functions:secrets:set SENDGRID_API_KEY
echo         firebase functions:secrets:set SENDGRID_FROM_EMAIL
echo    5. Vuelve a correr INSTALAR_BUILD_DEPLOY.bat.
echo    Si no haces esto, el sistema sigue funcionando exactamente
echo    igual que hoy -- solo no manda los correos todavia.
echo.
cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "ZIPFILE=PARA-CLAUDE_parche_v8_9_12.zip"
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
set "TMPEXTRACT=%TEMP%\cb_patch8912_%RANDOM%"
powershell -NoProfile -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TMPEXTRACT%' -Force"
if errorlevel 1 (
  color 0C
  echo  [X] No se pudo extraer el zip.
  pause
  exit /b 1
)

echo.
echo  --- Aplicando los archivos nuevos ---
robocopy "%TMPEXTRACT%\patch8912" "%~dp0." /E /IS /IT >nul
echo  [OK] Archivos copiados.
rmdir /s /q "%TMPEXTRACT%" >nul 2>nul

echo.
echo  --- Instalando dependencias (raiz) ---
call npm install
if errorlevel 1 (
  color 0E
  echo  [!] npm install marco errores. Revisa arriba.
  pause
  exit /b 1
)

echo.
echo  --- Instalando dependencias (Cloud Functions -- agrega @sendgrid/mail) ---
REM FIX (v8.9.12): este paso faltaba en TODOS los instaladores anteriores
REM de esta serie. Nunca importo porque ningun parche anterior le habia
REM agregado una dependencia nueva a functions\package.json -- este si.
pushd functions
call npm install
set RC_FNI=%ERRORLEVEL%
popd
if %RC_FNI% NEQ 0 (
  color 0E
  echo  [!] npm install dentro de functions marco errores. Revisa arriba.
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
echo    LISTO. v8.9.12 instalada.
echo    Agrega una Cloud Function nueva -^> necesita el deploy
echo    completo (Cloud Functions + Hosting), no solo Hosting.
echo    Recuerda: no enviara correos hasta que configures
echo    SENDGRID_API_KEY y SENDGRID_FROM_EMAIL (ver instrucciones
echo    arriba) y vuelvas a desplegar.
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
