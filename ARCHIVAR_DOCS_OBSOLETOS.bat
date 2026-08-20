@echo off
REM Igual que los demas: ventana fija para que nunca se cierre sola.
if /I "%~1"=="_EN_VENTANA_FIJA_" goto :DESPUES_DEL_RELANZADO
start "Control Bolsas - Archivar Docs Obsoletos" cmd /k "%~f0" _EN_VENTANA_FIJA_
exit /b 0
:DESPUES_DEL_RELANZADO

chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Archivar documentacion obsoleta
color 0B
cls
echo.
echo  ============================================================
echo    ARCHIVAR DOCUMENTACION OBSOLETA / DUPLICADA
echo  ============================================================
echo.
echo   No borra nada -- por la regla de "nunca borres nada sin mi
echo   consentimiento", esto solo MUEVE los archivos a una carpeta
echo   nueva: _ARCHIVO_OBSOLETO\docs\
echo.
echo   Ahi los puedes revisar cuando quieras y borrar tu mismo esa
echo   carpeta cuando estes seguro de que ya no los necesitas.
echo.
echo   Por que estos y no otros:
echo   - LEEME-PRIMERO.txt (raiz y docs\^): son notas de parche de
echo     versiones viejas (v5.3 / v5.4^), mal nombradas como si fueran
echo     una guia general de inicio. Confunden mas de lo que ayudan.
echo   - docs\AUDIT_NOTEBOOK.md: es una bitacora abandonada de 85
echo     lineas. La bitacora real y viva es AUDIT_NOTEBOOK.md en la
echo     raiz del proyecto (2000+ lineas, se sigue usando hoy).
echo   - Los 5 archivos "PROMPT_*": son borradores sueltos que se
echo     iban pegando en sesiones de IA para pedir auditorias. Se
echo     traslapan entre si y con el prompt que ya vive dentro de
echo     PROMPT_SISTEMA.md, SISTEMA_ACTUAL.md y FICHA_TECNICA.md.
echo.

cd /d "%~dp0"

if not exist "firebase.json" (
  color 0C
  echo  [X] No estas en la carpeta del proyecto ^(no encuentro firebase.json^).
  pause
  exit /b 1
)

set "DESTINO=_ARCHIVO_OBSOLETO\docs"
if not exist "%DESTINO%" mkdir "%DESTINO%"

set MOVIDOS=0
set NOENCONTRADOS=0

echo  --- Archivos en la raiz del proyecto: ---
for %%f in (
  "LEEME-PRIMERO.txt"
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
echo  --- Archivos dentro de docs\: ---
for %%f in (
  "docs\LEEME-PRIMERO.txt"
  "docs\AUDIT_NOTEBOOK.md"
  "docs\PROMPT_AUDITORIA.md"
  "docs\PROMPT_AUDITORIA_MASTER.txt"
  "docs\PROMPT BUENO.txt"
  "docs\PROMPT 2.txt"
  "docs\propotpaco.md"
) do (
  if exist "%%~f" (
    for %%n in ("%%~f") do move /y "%%~f" "%DESTINO%\%%~nxn" >nul
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

color 0A
echo.
echo  ============================================================
echo    LISTO. !MOVIDOS! archivo^(s^) archivado^(s^) en %DESTINO%\
echo    ^(!NOENCONTRADOS! de la lista ya no estaban -- normal si ya
echo    los habias movido o borrado tu antes^)
echo.
echo    Cuando estes seguro de que ya no los necesitas, borra tu
echo    mismo la carpeta _ARCHIVO_OBSOLETO a mano.
echo  ============================================================
echo.
pause
exit /b 0
