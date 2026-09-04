# Control de Bolsas ERP - PowerShell Tools Menu
Clear-Host

function Show-Menu {
    Clear-Host
    Write-Host "=======================================================================" -ForegroundColor Cyan
    Write-Host "             CONTROL DE BOLSAS ERP - MENU DE HERRAMIENTAS               " -ForegroundColor Cyan
    Write-Host "=======================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] 🔑 Renovar Autenticacion Google Cloud / Firebase (Error RAPT)" -ForegroundColor Yellow
    Write-Host "  [2] 🚀 Compilar y Desplegar (Build + Deploy Hosting/Firestore)" -ForegroundColor Green
    Write-Host "  [3] 🧪 Ejecutar Pruebas Unitarias (104 Tests)" -ForegroundColor Magenta
    Write-Host "  [4] 📦 Ver Estado de Git" -ForegroundColor White
    Write-Host "  [5] 🚪 Salir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "=======================================================================" -ForegroundColor Cyan
}

do {
    Show-Menu
    $choice = Read-Host "Selecciona una opcion (1-5)"
    
    switch ($choice) {
        "1" {
            Clear-Host
            Write-Host "Renovando Google Cloud ADC..." -ForegroundColor Yellow
            gcloud auth application-default login
            Write-Host "Renovando Firebase..." -ForegroundColor Yellow
            npx firebase login --reauth
            npx firebase use control-de-bolsas-89c88
            Write-Host "Completado." -ForegroundColor Green
            Read-Host "Presiona Enter para continuar..."
        }
        "2" {
            Clear-Host
            Write-Host "Compilando..." -ForegroundColor Green
            npm run build
            if ($LASTEXITCODE -eq 0) {
                Write-Host "Desplegando..." -ForegroundColor Green
                npx firebase deploy --only hosting,firestore,storage
            } else {
                Write-Host "Error en build. Despliegue cancelado." -ForegroundColor Red
            }
            Read-Host "Presiona Enter para continuar..."
        }
        "3" {
            Clear-Host
            Write-Host "Ejecutando pruebas..." -ForegroundColor Magenta
            npx vitest run src/lib/__tests__
            Read-Host "Presiona Enter para continuar..."
        }
        "4" {
            Clear-Host
            git status
            Read-Host "Presiona Enter para continuar..."
        }
    }
} while ($choice -ne "5")
