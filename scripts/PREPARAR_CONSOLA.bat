@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Control Bolsas - Preparar la consola de Firebase
color 0E
cls
echo.
echo  ============================================================
echo    PREPARAR LA CONSOLA DE FIREBASE
echo  ============================================================
echo.
echo   Hay cuatro cosas que Google OBLIGA a activar a mano desde la
echo   consola. Ningun script puede hacerlas por ti: son botones de
echo   "Comenzar" que solo tu puedes presionar con tu cuenta.
echo.
echo   Te voy abriendo las paginas una por una.
echo.
pause

REM ---------- 1. Plan Blaze ----------
cls
echo.
echo  ------------------------------------------------------------
echo   PASO 1 de 4 - PLAN BLAZE
echo  ------------------------------------------------------------
echo.
echo   Cloud Functions de 2a generacion y Secret Manager NO corren
echo   en el plan gratuito. Necesitas plan Blaze ^(pago por uso^).
echo.
echo   Con tu volumen seran centavos al mes, pero pide tarjeta.
echo   Puedes ponerle un limite de gasto para dormir tranquilo.
echo.
echo   EN LA PAGINA: boton "Modificar plan" - elige Blaze
echo.
set /p X="  Enter para abrir la pagina..."
start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/usage/details
echo.
set /p X="  Cuando termines, Enter para el siguiente paso..."

REM ---------- 2. Firestore ----------
cls
echo.
echo  ------------------------------------------------------------
echo   PASO 2 de 4 - FIRESTORE ^(la base de datos^)
echo  ------------------------------------------------------------
echo.
echo   EN LA PAGINA:
echo     1. Boton "Crear base de datos"
echo     2. Elige "Modo produccion"
echo     3. Ubicacion: us-central1  ^(o la mas cercana a Puebla^)
echo.
echo   OJO: la ubicacion NO se puede cambiar despues.
echo.
set /p X="  Enter para abrir la pagina..."
start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/firestore
echo.
set /p X="  Cuando termines, Enter para el siguiente paso..."

REM ---------- 3. Storage ----------
cls
echo.
echo  ------------------------------------------------------------
echo   PASO 3 de 4 - STORAGE  ^<-- ESTE ES EL QUE TE FALTA AHORA
echo  ------------------------------------------------------------
echo.
echo   Aqui se guardan los PDFs de las ordenes de compra antes de
echo   que la IA los lea. Sin esto el despliegue no pasa.
echo.
echo   EN LA PAGINA:
echo     1. Boton "Comenzar" / "Get Started"
echo     2. Acepta las reglas por omision ^(las tuyas se suben solas
echo        cuando corras INSTALL_AND_DEPLOY.bat^)
echo     3. Misma ubicacion que Firestore
echo.
set /p X="  Enter para abrir la pagina..."
start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/storage
echo.
set /p X="  Cuando termines, Enter para el siguiente paso..."

REM ---------- 4. Authentication ----------
cls
echo.
echo  ------------------------------------------------------------
echo   PASO 4 de 4 - AUTHENTICATION ^(tu usuario^)
echo  ------------------------------------------------------------
echo.
echo   EN LA PAGINA:
echo     1. "Comenzar"
echo     2. Metodo de acceso: "Correo electronico/contrasena" - Habilitar
echo     3. Pestana "Users" - "Agregar usuario" con tu correo y clave
echo     4. COPIA EL UID que aparece en la lista ^(lo necesitas ya^)
echo.
echo   Luego, en Firestore:
echo     5. "Iniciar coleccion" con ID:  admins
echo     6. Documento con ID = ese UID que copiaste
echo     7. Un campo cualquiera, por ejemplo:  email  ^(texto^) = tu correo
echo.
echo   SIN ESE DOCUMENTO NO ENTRA NADIE, NI TU.
echo.
set /p X="  Enter para abrir Authentication..."
start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/authentication/users
echo.
set /p X="  Enter para abrir Firestore y crear la coleccion admins..."
start "" https://console.firebase.google.com/project/control-de-bolsas-89c88/firestore/data

cls
color 0A
echo.
echo  ============================================================
echo    LISTO EL LADO DE LA CONSOLA
echo.
echo    Ahora, en este orden:
echo      1. CONFIGURAR_CLAVE_GEMINI.bat   ^(si aun no la cargaste^)
echo      2. INSTALL_AND_DEPLOY.bat
echo.
echo    DIAGNOSTICO.bat ahora tambien revisa el lado de Firebase
echo    y te dice si falto activar algo.
echo  ============================================================
pause
