#Requires -Version 5.0
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

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
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    $version = $pkg.version
  } catch {}
}

$resumen = $null
if (Test-Path "CHANGELOG.md") {
  $changelogLines = Get-Content "CHANGELOG.md"
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
  # El usuario escribio su propio nombre en vez de s/n
  $tituloCorto = $confirmar
  $mensaje = $confirmar
}

# --- 3) add + commit + push ---
Write-Host ""
Write-Host "  --- Agregando archivos ---" -ForegroundColor Yellow
git add -A
if ($LASTEXITCODE -ne 0) { Fail "git add fallo." }

Write-Host "  --- Creando commit ---" -ForegroundColor Yellow
git commit -m "$tituloCorto" -m "$mensaje" | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "git commit fallo (revisa el mensaje de arriba)." }

$rama = git rev-parse --abbrev-ref HEAD
Write-Host "  --- Subiendo a GitHub (rama: $rama) ---" -ForegroundColor Yellow
git push origin $rama
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "  [!] git push fallo. Si es la primera vez en esta rama, intenta:" -ForegroundColor Yellow
  Write-Host "      git push -u origin $rama" -ForegroundColor White
  Read-Host "  Presiona ENTER para salir"
  exit 1
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "    LISTO. Subido a GitHub como:" -ForegroundColor Green
Write-Host "    $tituloCorto" -ForegroundColor White
Write-Host "  ============================================================" -ForegroundColor Green
Read-Host "  Presiona ENTER para salir"
