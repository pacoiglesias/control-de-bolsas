@echo off
color 0B
chcp 65001 >nul
title Protector de Codigo - ERP Providencia
echo =========================================================
echo               PROTECTOR DE REPOSITORIO GITHUB
echo =========================================================
echo.
echo Para hacer tu codigo Privado de forma automatizada,
echo GitHub nos exige un Token de Acceso (Personal Access Token).
echo Si no tienes uno, es mas rapido entrar a github.com y 
echo hacerlo desde la seccion Settings - Danger Zone.
echo.
echo Pero si tienes tu Token a la mano, hazlo desde aqui:
echo.
set /p TOKEN="Pega tu GitHub Token aqui: "
set /p USER="Tu usuario de GitHub (ej. pacoiglesias): "
set /p REPO="El nombre del repo (ej. control-de-bolsas): "
echo.
echo Cambiando a Privado (Nadie mas podra ver el codigo)...
echo.
curl -L -X PATCH -H "Accept: application/vnd.github+json" -H "Authorization: Bearer %TOKEN%" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/repos/%USER%/%REPO% -d "{\"private\":true}"
echo.
echo.
echo ¡Proceso terminado! 
echo Revisa arriba si dice "private": true. Si sale un error de
echo "Bad credentials", significa que tu token vencio o esta mal.
pause
