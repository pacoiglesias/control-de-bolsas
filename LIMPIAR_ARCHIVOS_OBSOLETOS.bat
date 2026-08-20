@echo off
REM Igual que los demas: ventana fija para que nunca se cierre sola.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Archivar Obsoletos" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Archivar archivos obsoletos
color 0B
cls
echo.
echo  ============================================================
echo    ARCHIVAR ARCHIVOS OBSOLETOS
echo  ============================================================
echo.
echo   No borra nada -- por la regla de "nunca borres nada sin mi
echo   consentimiento", esto solo MUEVE los archivos que ya no se
echo   usan a una carpeta nueva: _ARCHIVO_OBSOLETO\
echo.
echo   Ahi los puedes revisar cuando quieras y borrar tu mismo esa
echo   carpeta cuando estes seguro de que ya no los necesitas.
echo.
echo   Por que estos y no otros: son parches de version ya aplicados
echo   (v6.76.0 hasta v8.9.2 -- el proyecto ya esta en v8.9.3),
echo   scripts de deploy viejos ya reemplazados por
echo   INSTALAR_BUILD_DEPLOY.bat, copias de USB a disco C ya hechas,
echo   y PUSH_TO_GIT.bat ya reemplazado por SUBIR_CAMBIOS.bat (que
echo   hace lo mismo y ademas repara solo, nombra el commit solo y
echo   reintenta si el remoto tiene cambios que tu no).
echo.

cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "DESTINO=_ARCHIVO_OBSOLETO"
if not exist "%DESTINO%" mkdir "%DESTINO%"

set MOVIDOS=0
set NOENCONTRADOS=0

for %%f in (
  "COPIAR_A_DISCO_C.bat"
  "COPIAR_GIT_A_DISCO_C.bat"
  "DESPLEGAR_MEJORAS_2026-08-09.bat"
  "DESPLEGAR_MEJORAS_2026-08-09_AUTO.bat"
  "DESPLEGAR_ROBUSTO.bat"
  "INSTALAR_v6.76.0.bat"
  "INSTALAR_v7.0.1.bat"
  "INSTALAR_v7.0.2.bat"
  "INSTALAR_v8.8.7.bat"
  "INSTALAR_v8.8.8.bat"
  "INSTALAR_v8.8.9.bat"
  "INSTALAR_v8.9.0.bat"
  "INSTALAR_v8.9.1.bat"
  "INSTALAR_v8.9.2.bat"
  "INSTALL_AND_DEPLOY.bat"
  "PUSH_TO_GIT.bat"
  "REPARAR_PERMISOS_MAQUILADOR.bat"
  "SINCRONIZAR_A_v8.9.3.bat"
  "SINCRONIZAR_v8_9_3.zip"
  "PARA-CLAUDE_parche_v8_8_9.zip"
  "PARA-CLAUDE_parche_v8_9_0.zip"
  "PARA-CLAUDE_parche_v8_9_1.zip"
  "PARA-CLAUDE_parche_v8_9_2.zip"
) do (
  if exist "%%~f" (
    move /y "%%~f" "%DESTINO%\" >nul
    if !errorlevel! EQU 0 (
      echo  [OK] Archivado: %%~f
      set /a MOVIDOS+=1
    ) else (
      echo  [X] No se pudo mover: %%~f
    )
  ) else (
    set /a NOENCONTRADOS+=1
  )
)

echo.
echo  --- Vite dejo varios archivos temporales sueltos (compilaciones
echo      interrumpidas). Tambien se archivan: ---
for %%f in ("vite.config.ts.timestamp-*.mjs") do (
  if exist "%%~f" (
    move /y "%%~f" "%DESTINO%\" >nul
    echo  [OK] Archivado: %%~f
    set /a MOVIDOS+=1
  )
)

color 0A
echo.
echo  ============================================================
echo    LISTO. !MOVIDOS! archivo^(s^) archivado^(s^) en %DESTINO%\
echo    ^(!NOENCONTRADOS! de la lista ya no estaban -- normal si ya
echo    los habias movido o borrado tu antes^)
echo.
echo    Cuando estes seguro de que ya no los necesitas, borra tu
echo    mismo la carpeta %DESTINO% a mano.
echo  ============================================================
echo.
pause
exit /b 0
