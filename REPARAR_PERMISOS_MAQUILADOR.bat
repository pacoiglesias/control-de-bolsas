@echo off
chcp 65001 >nul
title Control Bolsas - OBSOLETO, este permiso ya no aplica
color 0E
cls
echo.
echo  ============================================================
echo    ESTE SCRIPT QUEDO OBSOLETO
echo  ============================================================
echo.
echo   REPARAR_PERMISOS_MAQUILADOR.bat le daba permiso publico
echo   con "gcloud run services add-iam-policy-binding" a un
echo   servicio de Cloud Run llamado "getmaquilaledger".
echo.
echo   Ese servicio ya no existe en el proyecto. Las funciones
echo   actuales son otras (getActiveMaquilaOrders,
echo   parseUploadedPDF, checkOverdueInvoices, etc.), y el acceso
echo   publico que necesita el portal del maquilador ya se declara
echo   directamente en el codigo:
echo.
echo     exports.getActiveMaquilaOrders = onCall(
echo       { invoker: "public", cors: true }, ...^)
echo.
echo   Es decir: cada vez que se despliega con
echo   INSTALAR_BUILD_DEPLOY.bat, Firebase ya deja ese permiso
echo   configurado solo, sin necesidad de este script.
echo.
echo   Si algun dia el portal del maquilador vuelve a dar error de
echo   permisos, lo primero es revisar la consola de Firebase
echo   Functions -^> el nombre de la funcion afectada, y correr
echo   "gcloud run services add-iam-policy-binding" con el NOMBRE
echo   REAL de esa funcion (no "getmaquilaledger"^).
echo.
pause
exit /b 0
