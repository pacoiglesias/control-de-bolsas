#Requires -Version 5.0
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

# FIX: sin esto, los acentos (CRÍTICO, Andrés, etc.) se leen y se muestran
# mal (salen como "CRÃTICO", "AndrÃ©s") porque PowerShell 5.1 asume la
# codificacion ANSI del sistema para archivos sin BOM, y CHANGELOG.md esta
# en UTF-8. Forzamos consola UTF-8 aqui; la lectura de archivos de texto
# mas abajo tambien se hace con -Encoding UTF8 explicito.
try {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

function Fail($msg) {
  Write-Host ""
  Write-Host "  [X] $msg" -ForegroundColor Red
  Read-Host "  Presiona ENTER para salir"
  exit 1
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "    SUBIR CAMBIOS A GIT (con nombre automatico)" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host ""

# --- 0) Verificaciones basicas ---
if (-not (Test-Path ".git")) { Fail "Esta carpeta no es un repositorio git (no hay carpeta .git). Si estas en C:\pacoputo, corre COPIAR_GIT_A_DISCO_C.bat una vez y vuelve a intentar." }
$gh = Get-Command gh -ErrorAction SilentlyContinue
if (-not $gh) { Fail "No encuentro 'gh' (GitHub CLI). Corre INSTALAR_GH.bat primero." }
$authStatus = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) { Fail "No has iniciado sesion con 'gh'. Corre PROTEGER_CODIGO.bat o HACER_PUBLICO.bat una vez (hacen gh auth login) y vuelve a intentar." }

# --- 1) Nada que subir? ---
$statusPorcelain = git status --porcelain
if ([string]::IsNullOrWhiteSpace($statusPorcelain)) {
  Write-Host "  No hay cambios sin guardar. Todo esta al dia." -ForegroundColor Green
  Read-Host "  Presiona ENTER para salir"
  exit 0
}

# --- 2) Armar el nombre automatico del commit desde package.json + CHANGELOG.md ---
$version = $null
if (Test-Path "package.json") {
  try {
    $pkg = Get-Content "package.json" -Raw -Encoding UTF8 | ConvertFrom-Json
    $version = $pkg.version
  } catch {}
}

$resumen = $null
if (Test-Path "CHANGELOG.md") {
  $changelogLines = Get-Content "CHANGELOG.md" -Encoding UTF8
  $topLine = $changelogLines | Where-Object { $_ -match '^\s*##\s*\[v?[\d\.]+\]' } | Select-Object -First 1
  if ($topLine) {
    # Formato esperado: ## [v8.9.1] - 20 Agosto 2026 (Descripcion corta aqui)
    if ($topLine -match '\(([^)]+)\)\s*$') {
      $resumen = $matches[1]
    }
    if (-not $version -and $topLine -match '\[v?([\d\.]+)\]') {
      $version = $matches[1]
    }
  }
}

# FIX: el resumen sacado del CHANGELOG a veces trae comillas dobles dentro
# (ej. el texto habla de un valor entre comillas, como "Saldo con Andrés").
# Esas comillas dobles, al pasarlas como argumento -m "..." a un programa
# externo (git.exe) desde PowerShell, rompen el parseo de la linea de
# comandos de Windows a la mitad -- git terminaba recibiendo el mensaje
# cortado en pedazos sueltos ("pathspec 'con' did not match..."). Las
# cambiamos por comillas simples para que el commit nunca truene por esto.
if ($resumen) { $resumen = $resumen -replace '"', "'" }

$fecha = Get-Date -Format "yyyy-MM-dd HH:mm"
if ($version -and $resumen) {
  $mensaje = "v$version - $resumen"
} elseif ($version) {
  $mensaje = "v$version - actualizacion ($fecha)"
} else {
  $mensaje = "Actualizacion $fecha"
}

# Git no quiere mensajes gigantes en el titulo -- si el resumen es muy largo, lo recortamos
# y el texto completo igual queda en el cuerpo del commit.
$tituloCorto = $mensaje
if ($tituloCorto.Length -gt 100) { $tituloCorto = $tituloCorto.Substring(0,97) + "..." }

Write-Host "  --- Esto es lo que se va a subir ---" -ForegroundColor Yellow
git status --short
Write-Host ""
Write-Host "  Nombre automatico del commit:" -ForegroundColor Yellow
Write-Host "    $tituloCorto" -ForegroundColor White
Write-Host ""

$confirmar = Read-Host "  Subir estos cambios con ese nombre? (s/n, o escribe tu propio nombre)"
if ([string]::IsNullOrWhiteSpace($confirmar)) { Fail "Cancelado." }
if ($confirmar -eq 'n' -or $confirmar -eq 'N') { Fail "Cancelado por el usuario." }
if ($confirmar -ne 's' -and $confirmar -ne 'S') {
  # El usuario escribio su propio nombre en vez de s/n. Tambien le quitamos
  # comillas dobles por la misma razon de arriba -- si el escribe algo como
  # Arregle el bug de "Saldo con Andres", eso tampoco debe tronar el commit.
  $confirmar = $confirmar -replace '"', "'"
  $tituloCorto = $confirmar
  $mensaje = $confirmar
}

# --- 3) add + commit + push ---
Write-Host ""
Write-Host "  --- Agregando archivos ---" -ForegroundColor Yellow
git add -A
if ($LASTEXITCODE -ne 0) { Fail "git add fallo." }

Write-Host "  --- Creando commit ---" -ForegroundColor Yellow
# FIX: en vez de pasar el mensaje como argumento -m "..." (fragil: cualquier
# comilla, acento mal codificado o caracter especial puede romper el parseo
# de la linea de comandos de Windows al llamar a git.exe desde PowerShell),
# lo escribimos a un archivo temporal en UTF-8 y usamos "git commit -F
# archivo". Esto es inmune a comillas, signos de pesos, punto y coma, etc.
$archivoMensaje = Join-Path $env:TEMP ("control_bolsas_commit_" + [guid]::NewGuid().ToString("N") + ".txt")
if ($tituloCorto -eq $mensaje) {
  $cuerpoCommit = $tituloCorto
} else {
  $cuerpoCommit = "$tituloCorto`r`n`r`n$mensaje"
}
[System.IO.File]::WriteAllText($archivoMensaje, $cuerpoCommit, (New-Object System.Text.UTF8Encoding($false)))
try {
  git commit -F "$archivoMensaje" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "git commit fallo (revisa el mensaje de arriba)." }
} finally {
  Remove-Item -Path $archivoMensaje -ErrorAction SilentlyContinue
}

$rama = git rev-parse --abbrev-ref HEAD

# FIX: si el repositorio quedo en "detached HEAD" (no parado sobre ninguna
# rama real -- pasa cuando se copia la carpeta .git desde otro lado, ej. la
# USB, en ese estado), "git rev-parse --abbrev-ref HEAD" devuelve literalmente
# la palabra "HEAD" en vez del nombre de tu rama. Entonces "git push origin
# HEAD" no tiene a donde publicarlo y truena con "not a full refname". Aqui
# se detecta ese caso y se para la rama real (main, o la que ya exista)
# encima del commit actual antes de subir -- no se pierde nada, solo se
# mueve el puntero de la rama a donde ya estaba el commit recien hecho.
if ($rama -eq 'HEAD') {
  Write-Host ""
  Write-Host "  [!] El repositorio esta en modo 'detached HEAD' (sin rama real)." -ForegroundColor Yellow
  Write-Host "      Reparando antes de subir..." -ForegroundColor Yellow

  $ramaDestino = $null
  $defaultRemoto = git symbolic-ref -q --short refs/remotes/origin/HEAD 2>$null
  if ($LASTEXITCODE -eq 0 -and $defaultRemoto) {
    $ramaDestino = $defaultRemoto -replace '^origin/', ''
  }
  if (-not $ramaDestino) {
    $ramasLocales = git branch --format='%(refname:short)' 2>$null
    if ($ramasLocales -contains 'main') { $ramaDestino = 'main' }
    elseif ($ramasLocales -contains 'master') { $ramaDestino = 'master' }
  }
  if (-not $ramaDestino) { $ramaDestino = 'main' }

  git branch -f $ramaDestino HEAD
  if ($LASTEXITCODE -ne 0) { Fail "No se pudo crear/mover la rama '$ramaDestino' sobre el commit actual." }
  git checkout $ramaDestino
  if ($LASTEXITCODE -ne 0) { Fail "No se pudo cambiar a la rama '$ramaDestino'." }

  $rama = $ramaDestino
  Write-Host "  [OK] Reparado. Ahora paras sobre la rama '$rama'." -ForegroundColor Green
}

Write-Host "  --- Subiendo a GitHub (rama: $rama) ---" -ForegroundColor Yellow
git push -u origin $rama
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "  [!] git push fallo. Causa mas comun: el remoto tiene commits que tu no." -ForegroundColor Yellow
  $r = Read-Host "  Intento 'git pull --rebase' y vuelvo a subir? (s/n)"
  if ($r -eq 's' -or $r -eq 'S') {
    git pull --rebase origin $rama
    if ($LASTEXITCODE -ne 0) { Fail "El rebase tiene conflictos. Resuelvelos a mano y vuelve a correr esto." }
    git push -u origin $rama
    if ($LASTEXITCODE -ne 0) { Fail "Sigue fallando el push despues del rebase. Revisa el mensaje de arriba." }
  } else {
    Read-Host "  Presiona ENTER para salir"
    exit 1
  }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "    LISTO. Subido a GitHub como:" -ForegroundColor Green
Write-Host "    $tituloCorto" -ForegroundColor White
Write-Host "  ============================================================" -ForegroundColor Green

# Respaldo local (rota y deja los ultimos 5) -- mismo paso final que ya
# hacia PUSH_TO_GIT.bat, para no perder esa funcion al dejar un solo script.
if (Test-Path "backup.ps1") {
  Write-Host ""
  Write-Host "  --- Respaldo local ---" -ForegroundColor Yellow
  & .\backup.ps1
}

Read-Host "  Presiona ENTER para salir"
