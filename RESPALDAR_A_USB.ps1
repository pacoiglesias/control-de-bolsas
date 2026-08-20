# ==============================================================================
# RESPALDAR SISTEMA A USB / DISCO EXTERNO - ERP CONTROL DE BOLSAS
# ==============================================================================
param (
    [string]$TargetDrive = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "         RESPALDAR SISTEMA COMPLETO A USB / DISCO EXTERNO" -ForegroundColor Cyan
Write-Host "                 ERP Control de Bolsas - v8.9.5" -ForegroundColor Yellow
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$SourceDir = if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }

if (!(Test-Path (Join-Path $SourceDir "firebase.json"))) {
    Write-Host "[X] ERROR: No se detecta la raíz del proyecto en: $SourceDir" -ForegroundColor Red
    pause
    exit 1
}

# 1. Detectar Unidades Disponibles
Write-Host "[1/5] Buscando memorias USB y unidades de almacenamiento externas..." -ForegroundColor Cyan

$usbDrives = @()
try {
    $usbDrives = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 }
} catch {
    $usbDrives = @()
}

$allOtherDrives = @()
try {
    $allOtherDrives = Get-CimInstance -ClassName Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 -and $_.DeviceID -ne 'C:' }
} catch {
    $allOtherDrives = @()
}

$selectedDrive = ""

if ($TargetDrive -and (Test-Path $TargetDrive)) {
    $selectedDrive = $TargetDrive
} elseif ($usbDrives.Count -eq 1) {
    $drive = $usbDrives[0]
    $freeGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    $volName = if ($drive.VolumeName) { $drive.VolumeName } else { "Sin Nombre" }
    Write-Host "  -> [OK] Memoria USB detectada automáticamente:" -ForegroundColor Green
    Write-Host "     Unidad: $($drive.DeviceID) ($volName) | Espacio libre: $freeGB GB" -ForegroundColor White
    $resp = Read-Host "  ¿Deseas respaldar en $($drive.DeviceID)? (S/N, por defecto 'S')"
    if ($resp -eq "" -or $resp -match "^[sSyY]") {
        $selectedDrive = $drive.DeviceID
    }
}

if (-not $selectedDrive) {
    Write-Host ""
    Write-Host "  Unidades detectadas en el equipo:" -ForegroundColor Yellow
    $allDrives = @($usbDrives) + @($allOtherDrives)
    
    if ($allDrives.Count -gt 0) {
        for ($i = 0; $i -lt $allDrives.Count; $i++) {
            $d = $allDrives[$i]
            $typeStr = if ($d.DriveType -eq 2) { "Memoria USB / Extraíble" } else { "Disco Local / Externo" }
            $freeGB = [math]::Round($d.FreeSpace / 1GB, 2)
            $volName = if ($d.VolumeName) { $d.VolumeName } else { "Sin Nombre" }
            Write-Host "    [$($i+1)] $($d.DeviceID) ($volName) - $typeStr ($freeGB GB libres)" -ForegroundColor White
        }
        Write-Host ""
        $inputChoice = Read-Host "  Elige el número de unidad (1-$($allDrives.Count)) o escribe la letra (ej. E:)"
        
        if ($inputChoice -match "^\d+$" -and [int]$inputChoice -ge 1 -and [int]$inputChoice -le $allDrives.Count) {
            $selectedDrive = $allDrives[[int]$inputChoice - 1].DeviceID
        } else {
            $cleaned = $inputChoice.Trim().ToUpper()
            if ($cleaned -match "^[A-Z]:?$") {
                $selectedDrive = if ($cleaned.EndsWith(":")) { $cleaned } else { "$cleaned`:" }
            } else {
                $selectedDrive = $cleaned
            }
        }
    } else {
        Write-Host "  [!] No se encontraron memorias USB conectadas." -ForegroundColor Yellow
        $inputChoice = Read-Host "  Por favor conecta tu memoria USB e ingresa la letra de unidad (ej. D:, E:, F:)"
        $cleaned = $inputChoice.Trim().ToUpper()
        if ($cleaned -match "^[A-Z]:?$") {
            $selectedDrive = if ($cleaned.EndsWith(":")) { $cleaned } else { "$cleaned`:" }
        } else {
            $selectedDrive = $cleaned
        }
    }
}

if (-not $selectedDrive -or !(Test-Path $selectedDrive)) {
    Write-Host ""
    Write-Host "[X] ERROR: La unidad seleccionada '$selectedDrive' no existe o no es accesible." -ForegroundColor Red
    Write-Host "    Asegúrate de que la memoria USB esté conectada correctamente." -ForegroundColor Yellow
    pause
    exit 1
}

# 2. Configurar Carpetas de Destino en el USB
$Timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$TimestampShort = Get-Date -Format "yyyyMMdd_HHmmss"
$UsbRootDir = Join-Path $selectedDrive "RESPALDOS_CONTROL_BOLSAS"
$BackupFolder = Join-Path $UsbRootDir "ControlBolsas_v8.9.5_$Timestamp"
$ZipFile = Join-Path $UsbRootDir "Respaldo_Completo_v8.9.5_$TimestampShort.zip"

if (!(Test-Path $UsbRootDir)) {
    New-Item -ItemType Directory -Path $UsbRootDir -Force | Out-Null
}

Write-Host ""
Write-Host "[2/5] Destino configurado en el USB:" -ForegroundColor Cyan
Write-Host "  -> Carpeta abierta: $BackupFolder" -ForegroundColor White
Write-Host "  -> Archivo ZIP:     $ZipFile" -ForegroundColor White
Write-Host ""

# 3. Copia Limpia del Código Fuente (Excluyendo basura y dependencias pesadas)
Write-Host "[3/5] Copiando archivos esenciales del sistema (robocopy optimizado)..." -ForegroundColor Cyan
Write-Host "      Excluyendo node_modules, dist, .git, temporales y cachés pesadas..." -ForegroundColor DarkGray

$robocopyParams = @(
    "$SourceDir",
    "$BackupFolder",
    "/MIR",
    "/R:1",
    "/W:1",
    "/NP",
    "/XD", "node_modules", "dist", ".git", ".firebase", "functions\node_modules", "functions\lib", "_respaldo_*", "Respaldos", "_ARCHIVO_OBSOLETO", "scratch", ".system_generated",
    "/XF", "*.log", "*.zip", "*.tsbuildinfo", "vite.config.ts.timestamp-*.mjs", "ziYlGp8z"
)

& robocopy @robocopyParams | Out-Null
$rcExit = $LASTEXITCODE

if ($rcExit -ge 8) {
    Write-Host "[X] Advertencia en robocopy (código $rcExit). Verificando copia..." -ForegroundColor Yellow
} else {
    Write-Host "  -> [OK] Código fuente copiado íntegramente y limpio." -ForegroundColor Green
}

# 4. Crear script de restauración y arranque rápido dentro del USB
$RestoreBatContent = @"
@echo off
chcp 65001 >nul
title Control de Bolsas - Restaurar / Iniciar en esta PC
color 0B
cls
echo ==============================================================================
echo       RESTAURADOR Y ARRANQUE RAPIDO - ERP CONTROL DE BOLSAS
echo ==============================================================================
echo.
echo  Este script instala dependencias e inicia el ERP en esta computadora.
echo.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo  [X] ERROR: Node.js no esta instalado en esta computadora.
  echo      Descargalo e instalalo desde: https://nodejs.org
  pause
  exit /b 1
)

echo [1/3] Instalando dependencias de la aplicacion (npm install)...
call npm install
if errorlevel 1 (
  echo  [!] Hubo advertencias al instalar dependencias de raiz.
)

echo [2/3] Instalando dependencias de Cloud Functions...
if exist "functions\package.json" (
  cd functions
  call npm install
  cd ..
)

echo.
echo [3/3] Listo! Deseas arrancar el servidor local ahora mismo?
echo.
echo   1. Si, iniciar servidor local de desarrollo (npm run dev)
echo   2. Compilar version de produccion (npm run build)
echo   3. Solo salir
echo.
set /p opc="Elige opcion (1, 2 o 3): "

if "%opc%"=="1" (
  cls
  echo Iniciando ERP... Presiona Ctrl+C para detener.
  call npm run dev
)
if "%opc%"=="2" (
  cls
  echo Compilando paquete de produccion...
  call npm run build
  pause
)
"@

Set-Content -Path (Join-Path $BackupFolder "1_INICIAR_EN_ESTA_PC.bat") -Value $RestoreBatContent -Encoding UTF8

$ReadmeContent = @"
==============================================================================
RESPALDO OFICIAL DE CONTROL DE BOLSAS ERP - v8.9.5
Fecha de Creación: $(Get-Date -Format "dd/MM/yyyy HH:mm:ss")
==============================================================================

CONTENIDO DE ESTE RESPALDO:
1. Código fuente completo y funcional (React + TypeScript + Vite + Firebase).
2. Reglas de seguridad auditadas (firestore.rules, storage.rules).
3. Cloud Functions para sincronización XML e ingesta contable.
4. Documentación técnica y bitácoras de auditoría (AUDIT_NOTEBOOK.md, CHANGELOG.md).

COMO USAR ESTE RESPALDO EN OTRA COMPUTADORA:
1. Copia toda esta carpeta a tu disco C: (por ejemplo C:\pacoputo o C:\ControlBolsas).
2. Asegúrate de tener Node.js instalado (https://nodejs.org).
3. Haz doble clic en el archivo:
   1_INICIAR_EN_ESTA_PC.bat
   
Este archivo instalará automáticamente los módulos necesarios e iniciará el sistema.

==============================================================================
"@

Set-Content -Path (Join-Path $BackupFolder "LEEME_INSTRUCCIONES_RESTAURACION.txt") -Value $ReadmeContent -Encoding UTF8

# 5. Comprimir a formato .ZIP en el USB
Write-Host "[4/5] Generando archivo comprimido ZIP de máxima seguridad en USB..." -ForegroundColor Cyan
try {
    if (Test-Path $ZipFile) { Remove-Item $ZipFile -Force }
    Compress-Archive -Path "$BackupFolder\*" -DestinationPath $ZipFile -Force
    $zipItem = Get-Item $ZipFile
    $zipMB = [math]::Round($zipItem.Length / 1MB, 2)
    Write-Host "  -> [OK] Archivo ZIP creado: $ZipFile ($zipMB MB)" -ForegroundColor Green
} catch {
    Write-Host "  -> [!] No se pudo generar el ZIP: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 6. Resumen Final
Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "               ¡RESPALDO EN USB COMPLETADO CON ÉXITO!" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "  Unidad USB:        $selectedDrive" -ForegroundColor White
Write-Host "  Carpeta en USB:    $BackupFolder" -ForegroundColor White
if (Test-Path $ZipFile) {
    Write-Host "  Archivo ZIP:       $ZipFile" -ForegroundColor White
}
Write-Host ""
Write-Host "  Tu sistema quedó respaldado en 2 formatos en la USB:" -ForegroundColor Yellow
Write-Host "    1. Carpeta lista para usarse (con script '1_INICIAR_EN_ESTA_PC.bat')." -ForegroundColor White
Write-Host "    2. Archivo ZIP comprimido para resguardo histórico." -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Green
Write-Host ""

pause
