@echo off
chcp 65001 >nul
title Quitar los datos de cartera del sitio publico
color 0C
cls
echo.
echo  ============================================================
echo    QUITAR TU CARTERA DE INTERNET
echo  ============================================================
echo.
echo   Estos archivos estan publicados SIN CONTRASENA en:
echo     https://control-de-bolsas-89c88.web.app/contrarecibos.json
echo.
echo   Todo lo que vive en public/ se copia a dist/ y se sirve
echo   abierto en Hosting. Ahi no aplican las reglas de Firestore.
echo.
if not exist "firebase.json" (
  echo  [X] Corre esto dentro de la carpeta del proyecto.
  pause
  exit /b 1
)
for %%f in ("public\contrarecibos.json" "public\facturas_pendientes_contrarecibo.json" "contrarecibos.json" "facturas_pendientes_contrarecibo.json") do (
  if exist %%f del /f /q %%f
)
echo  [-] Archivos borrados del disco
echo.
echo  [..] Recompilando y volviendo a publicar...
call npm run build
if errorlevel 1 goto :err
call firebase deploy --only hosting
if errorlevel 1 goto :err
color 0A
echo.
echo  ============================================================
echo    LISTO. Verifica abriendo la URL de arriba:
echo    debe responder "Page Not Found".
echo  ============================================================
pause
exit /b 0
:err
color 0C
echo.
echo  [X] Fallo. Los archivos ya se borraron del disco, pero el sitio
echo      publico NO se actualizo: siguen en linea hasta que despliegues.
pause
exit /b 1
