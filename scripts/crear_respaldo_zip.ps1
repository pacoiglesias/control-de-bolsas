# Script para crear respaldo ZIP limpio del ERP
$ErrorActionPreference = 'Stop'
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$destDir = "c:\pacoputo\Respaldos"
if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
$destZip = Join-Path $destDir "Backup_Actual_$ts.zip"
$tempDir = Join-Path $destDir "temp_$ts"

Write-Host "Iniciando respaldo en: $destZip" -ForegroundColor Cyan
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Copiar con robocopy excluyendo carpetas pesadas y regenerables
    $params = @(
        "c:\pacoputo",
        $tempDir,
        "/MIR",
        "/R:1",
        "/W:1",
        "/NP",
        "/XD", "node_modules", "dist", ".firebase", "functions\node_modules", "functions\lib", "Respaldos", ".git", "scratch", ".system_generated",
        "/XF", "*.log", "*.tsbuildinfo", "vite.config.ts.timestamp-*.mjs"
    )
    & robocopy @params | Out-Null

    Write-Host "Comprimiendo archivo ZIP..." -ForegroundColor Yellow
    Compress-Archive -Path "$tempDir\*" -DestinationPath $destZip -Force

    $item = Get-Item $destZip
    $mb = [math]::Round($item.Length / 1MB, 2)
    Write-Host "¡Respaldo ZIP creado con éxito! Archivo: $destZip ($mb MB)" -ForegroundColor Green
}
finally {
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
