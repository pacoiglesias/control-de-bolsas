Write-Host ''
Write-Host '============================================================'
Write-Host '  DIAGNOSTICO DE VELOCIDAD DEL PROYECTO'
Write-Host '============================================================'
Write-Host ''

$folder = (Get-Location).Path
$letter = $folder.Substring(0,1)
Write-Host "Carpeta: $folder"
Write-Host "Unidad:  $($letter):"
Write-Host ''

Write-Host '--- Tipo de unidad ---'
$driveType = & fsutil fsinfo drivetype "$($letter):"
Write-Host "  $driveType"
if ($driveType -match 'Removable') {
    Write-Host '  [!] Windows ve esta unidad como REMOVIBLE (USB). Ese es probablemente'
    Write-Host '      el principal culpable de la lentitud: node_modules crea decenas de'
    Write-Host '      miles de archivos chiquitos, y una memoria USB es mucho mas lenta'
    Write-Host '      que un disco interno para ese tipo de trabajo (aunque la USB sea'
    Write-Host '      rapida "copiando un video", npm no copia un archivo grande: escribe'
    Write-Host '      miles de archivos pequenos, que es el peor caso para USB).'
}
Write-Host ''

Write-Host '--- Disco fisico (si se puede determinar) ---'
try {
    $part = Get-Partition -DriveLetter $letter -ErrorAction Stop
    $disk = Get-Disk -Number $part.DiskNumber -ErrorAction Stop
    Write-Host ("  Disco: {0}" -f $disk.FriendlyName)
    Write-Host ("  Bus: {0}   Tipo de medio: {1}" -f $disk.BusType, $disk.MediaType)
} catch {
    Write-Host '  (No se pudo determinar -- prueba corriendo este script como Administrador)'
}
Write-Host ''

Write-Host '--- Windows Defender ---'
try {
    $status = Get-MpComputerStatus -ErrorAction Stop
    Write-Host ("  Proteccion en tiempo real: {0}" -f $status.RealTimeProtectionEnabled)
    $prefs = Get-MpPreference -ErrorAction Stop
    $yaExcluida = $false
    foreach ($p in $prefs.ExclusionPath) {
        if ($p -and $folder.ToLower().StartsWith($p.ToLower())) { $yaExcluida = $true }
    }
    if ($yaExcluida) {
        Write-Host '  [OK] Esta carpeta YA esta excluida de Defender.'
    } else {
        Write-Host '  [!] Esta carpeta NO esta excluida de Defender todavia.'
        Write-Host '      Windows Security -> Proteccion contra virus y amenazas ->'
        Write-Host '      Administrar configuracion -> Agregar o quitar exclusiones ->'
        Write-Host '      Agregar una exclusion -> Carpeta -> selecciona esta carpeta.'
    }
} catch {
    Write-Host '  (No se pudo consultar Defender -- puede que uses otro antivirus, o falten permisos)'
}
Write-Host ''

Write-Host '--- Prueba real de escritura (20 MB) ---'
$testFile = Join-Path $folder 'cb_speedtest.tmp'
try {
    $bytes = New-Object byte[] (20MB)
    (New-Object Random).NextBytes($bytes)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    [System.IO.File]::WriteAllBytes($testFile, $bytes)
    $sw.Stop()
    Remove-Item $testFile -Force
    $mbps = [math]::Round(20 / $sw.Elapsed.TotalSeconds, 1)
    Write-Host "  Velocidad: $mbps MB/s"
    if ($mbps -lt 15) {
        Write-Host '  [!] Eso es MUY lento para desarrollo. Un SSD interno normal da 200+ MB/s;'
        Write-Host '      y con miles de archivos chiquitos (como hace npm) el numero real que'
        Write-Host '      sientes es todavia peor que este promedio de un archivo grande.'
    } elseif ($mbps -lt 60) {
        Write-Host '  [!] Velocidad baja/media -- probablemente USB o disco de red.'
    } else {
        Write-Host '  [OK] Velocidad razonable de disco.'
    }
} catch {
    Write-Host "  (No se pudo probar: $($_.Exception.Message))"
    if (Test-Path $testFile) { Remove-Item $testFile -Force -ErrorAction SilentlyContinue }
}

Write-Host ''
Write-Host '============================================================'
Write-Host '  RECOMENDACION'
Write-Host '============================================================'
Write-Host '  1. Excluye esta carpeta del antivirus (arriba te digo como).'
Write-Host '  2. Si la unidad salio como "Removable" o la velocidad salio baja,'
Write-Host '     copia el proyecto completo a tu disco interno (C:) para trabajar'
Write-Host '     dia a dia -- usa la USB solo para respaldo/transporte. Eso suele'
Write-Host '     ser lo que mas cambia el tiempo de "npm ci" y del build/deploy.'
Write-Host ''
Read-Host 'Presiona Enter para salir'
