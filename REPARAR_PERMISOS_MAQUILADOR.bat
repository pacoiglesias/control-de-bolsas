@echo off
echo =======================================================
echo     REPARANDO PERMISOS DEL PORTAL MAQUILADOR EN LA NUBE
echo =======================================================
echo.
echo Este script hara publica la nueva funcion del portal
echo para que Andres pueda ver su estado de cuenta.
echo.
echo Paso 1: Intentando aplicar el permiso con gcloud...
call gcloud run services add-iam-policy-binding getmaquilaledger --region=us-east1 --member=allUsers --role=roles/run.invoker --project=control-de-bolsas-89c88

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] Necesitas iniciar sesion en Google Cloud.
    echo Abriendo una ventana de navegador para que inicies sesion...
    call gcloud auth login
    echo.
    echo Intentando de nuevo despues del login...
    call gcloud run services add-iam-policy-binding getmaquilaledger --region=us-east1 --member=allUsers --role=roles/run.invoker --project=control-de-bolsas-89c88
)

echo.
echo =======================================================
echo PROCESO TERMINADO.
echo Si ves un mensaje arriba diciendo "Updated IAM policy", 
echo entonces el portal maquilador ya funciona al 100%%.
echo =======================================================
pause
