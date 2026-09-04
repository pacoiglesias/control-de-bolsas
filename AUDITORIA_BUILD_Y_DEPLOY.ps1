#Requires -Version 5.0
# ============================================================================
# Build + Pruebas + Deploy — generado tras la auditoría del 2026-09-03.
#
# Qué hace, en orden, DETENIÉNDOSE en el primer error:
#   1) npm run typecheck   -> revisa que TypeScript compile sin errores.
#   2) npm test             -> corre la suite de Vitest (incluye finance.test.ts).
#   3) npm run deploy       -> build de producción + `firebase deploy`.
#   4) Pregunta si quieres subir los cambios a GitHub (usa SUBIR_CAMBIOS.ps1,
#      que ya tenías, para mantener un solo flujo de commit/push).
#
# Por qué se detiene en cada paso: los cambios de esta auditoría tocan
# lógica financiera y de borrado de datos (auditEngine, autoHealEngine,
# Settings.tsx). No tiene caso desplegar si el build o las pruebas fallan.
# ============================================================================
$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Fail($msg) {
  Write-Host ""
  Write-Host "  [X] $msg" -ForegroundColor Red
  Read-Host "  Presiona ENTER para salir"
  exit 1
}

function Paso($n, $msg) {
  Write-Host ""
  Write-Host "  ── Paso $n: $msg ──────────────────────────────" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Cyan
Write-Host "    AUDITORÍA 2026-09-03: VERIFICAR, CONSTRUIR Y DESPLEGAR" -ForegroundColor Cyan
Write-Host "  ============================================================" -ForegroundColor Cyan

if (-not (Test-Path "package.json")) {
  Fail "No encuentro package.json aquí. Corre este script desde la raíz del proyecto (C:\pacoputo)."
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) { Fail "No encuentro 'npm'. Instala Node.js primero." }

$firebase = Get-Command firebase -ErrorAction SilentlyContinue
if (-not $firebase) { Fail "No encuentro 'firebase' (Firebase CLI). Instálalo con: npm install -g firebase-tools" }

# --- Paso 1: TypeScript ---
Paso 1 "Verificando que TypeScript compile (npm run typecheck)"
npm run typecheck
if ($LASTEXITCODE -ne 0) {
  Fail "TypeScript encontró errores. Revisa el mensaje de arriba antes de continuar. NO se hizo ningún deploy."
}
Write-Host "  [OK] TypeScript compila sin errores." -ForegroundColor Green

# --- Paso 2: Pruebas automatizadas ---
Paso 2 "Corriendo la suite de pruebas (npm test)"
npm test
if ($LASTEXITCODE -ne 0) {
  Fail "Al menos una prueba falló. Revisa el mensaje de arriba antes de continuar. NO se hizo ningún deploy."
}
Write-Host "  [OK] Todas las pruebas pasaron." -ForegroundColor Green

# --- Confirmación antes de tocar producción ---
Write-Host ""
Write-Host "  Esto va a construir la app y desplegarla a Firebase (producción real)." -ForegroundColor Yellow
$confirmar = Read-Host "  ¿Continuar con el deploy a producción? (s/n)"
if ($confirmar -ne 's' -and $confirmar -ne 'S') { Fail "Cancelado por el usuario. No se hizo ningún deploy." }

# --- Paso 3: Build + Deploy ---
Paso 3 "Build de producción + firebase deploy (npm run deploy)"
npm run deploy
if ($LASTEXITCODE -ne 0) {
  Fail "El build o el deploy fallaron. Revisa el mensaje de arriba. Tu código local NO se subió a GitHub todavía (eso es un paso aparte)."
}
Write-Host "  [OK] Deploy completado." -ForegroundColor Green

# --- Paso 4: opcional, subir a GitHub con el flujo que ya existe ---
Write-Host ""
$subirGit = Read-Host "  ¿Quieres subir estos cambios a GitHub ahora usando SUBIR_CAMBIOS.ps1? (s/n)"
if ($subirGit -eq 's' -or $subirGit -eq 'S') {
  if (Test-Path "SUBIR_CAMBIOS.ps1") {
    & "$PSScriptRoot\SUBIR_CAMBIOS.ps1"
  } else {
    Write-Host "  [!] No encontré SUBIR_CAMBIOS.ps1. Sube los cambios manualmente con git." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "  ============================================================" -ForegroundColor Green
Write-Host "    LISTO. Verificado, construido y desplegado." -ForegroundColor Green
Write-Host "  ============================================================" -ForegroundColor Green
Read-Host "  Presiona ENTER para salir"
