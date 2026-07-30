$BackupDir = "C:\Users\pacoi\Downloads\CONTROL_FACTURAS_BACKUPS"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$BackupFile = "$BackupDir\Backup_$Timestamp.zip"

$SourceDir = "C:\Users\pacoi\Downloads\CONTROL  FACTURAS PROVIDENCIA"

Write-Host "Creando respaldo: $BackupFile"

# Empacar ignorando node_modules y dependencias pesadas
# Usamos robocopy porque Copy-Item no excluye directorios de forma recursiva eficientemente
$TempDir = "$BackupDir\Temp"
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Path $TempDir | Out-Null

Write-Host "Copiando archivos (excluyendo node_modules, .env, .git...)"
# robocopy devuelve códigos de error que no son necesariamente fallos (1-7 son éxito con archivos copiados)
# _respaldo_* y *.zip tambien fuera: sin esto, cada respaldo se llevaba
# dentro una copia completa del respaldo anterior y los ZIP de parches.
robocopy "$SourceDir" "$TempDir" /MIR /XD node_modules dist .git .firebase "functions\node_modules" "functions\lib" "_respaldo_*" /XF .env .env.local *.log *.zip *.tsbuildinfo
if ($LASTEXITCODE -ge 8) {
    Write-Error "Error copiando archivos con robocopy. Código: $LASTEXITCODE"
}

Write-Host "Comprimiendo..."
Compress-Archive -Path "$TempDir\*" -DestinationPath $BackupFile -Force
Remove-Item $TempDir -Recurse -Force

$Backups = Get-ChildItem -Path $BackupDir -Filter "Backup_*.zip" | Sort-Object CreationTime -Descending

if ($Backups.Count -gt 5) {
    $BackupsToKeep = $Backups | Select-Object -First 5
    $BackupsToDelete = $Backups | Where-Object { $BackupsToKeep.FullName -notcontains $_.FullName }
    
    foreach ($File in $BackupsToDelete) {
        Write-Host "Eliminando respaldo antiguo: $($File.Name)"
        Remove-Item $File.FullName -Force
    }
}
Write-Host "Respaldo completado exitosamente. Se mantienen 5 respaldos."
