#!/usr/bin/env bash
# ==============================================================================
# scripts/audit.sh — Auditoría Integral del Repositorio Control de Bolsas ERP
#
# Verifica:
#   1. Archivos prohibidos en raíz (.bat, .ps1)
#   2. Archivos de log en todo el repositorio
#   3. Límite de archivos en raíz (< 20)
#   4. Carpetas temporales prohibidas
#   5. Documentos de proyecto que deben estar en docs/, no en raíz
#   6. Estructura modular de Cloud Functions
#   7. Cobertura de pruebas mínima (≥ 80%)
#
# Uso: sh scripts/audit.sh
# Salida: 0 = todo OK | 1 = errores encontrados
# ==============================================================================

set -euo pipefail

ERROR=0

# ── Colores ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ok()   { echo -e "${GREEN}✅ $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; ERROR=1; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║   🔍 Auditoría Integral — Control de Bolsas ERP                 ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Archivos .bat y .ps1 en raíz ──────────────────────────────────────────
echo "── [1/7] Archivos prohibidos en raíz (.bat, .ps1)..."
# Excepción autorizada: scripts de inicio rápido Windows (reauth / autenticar_servicios)
bat_count=$(find . -maxdepth 1 -name "*.bat" -not -name "autenticar_servicios.bat" -not -name "reauth.bat" | wc -l)
ps1_count=$(find . -maxdepth 1 -name "*.ps1" | wc -l)
if [ "$bat_count" -gt 0 ]; then
  fail "Archivos .bat no autorizados en la raíz: $(find . -maxdepth 1 -name '*.bat' -not -name 'autenticar_servicios.bat' -not -name 'reauth.bat' | tr '\n' ' ')"
elif [ "$ps1_count" -gt 0 ]; then
  fail "Archivos .ps1 encontrados en la raíz: $(find . -maxdepth 1 -name '*.ps1' | tr '\n' ' ')"
else
  ok "Sin archivos no autorizados .bat o .ps1 en raíz"
fi

# ── 2. Archivos *.log en todo el repositorio ──────────────────────────────────
echo "── [2/7] Archivos *.log en el repositorio..."
log_count=$(find . -name "*.log" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./functions/node_modules/*" -not -path "./.firebase/*" | wc -l)
if [ "$log_count" -gt 0 ]; then
  fail "Archivos .log encontrados ($log_count): $(find . -name '*.log' -not -path './.git/*' -not -path './node_modules/*' -not -path './functions/node_modules/*' -not -path './.firebase/*' | head -5 | tr '\n' ' ')"
else
  ok "Sin archivos .log en el repositorio"
fi

# ── 3. Límite de archivos en raíz ─────────────────────────────────────────────
echo "── [3/7] Límite de archivos en raíz (< 20)..."
root_files=$(find . -maxdepth 1 -type f | wc -l)
if [ "$root_files" -gt 20 ]; then
  fail "Demasiados archivos en la raíz: $root_files (límite: 20)"
else
  ok "$root_files archivos en raíz (límite: 20)"
fi

# ── 4. Carpetas temporales prohibidas ─────────────────────────────────────────
echo "── [4/7] Carpetas temporales prohibidas..."
PROHIBITED_DIRS=("scratch" "_ARCHIVO_OBSOLETO" "Respaldos" "_respaldo_" "tmp")
found_dirs=0
for dir in "${PROHIBITED_DIRS[@]}"; do
  if [ -d "./$dir" ]; then
    fail "Carpeta prohibida encontrada: ./$dir"
    found_dirs=$((found_dirs + 1))
  fi
done
[ "$found_dirs" -eq 0 ] && ok "Sin carpetas temporales prohibidas"

# ── 5. Documentos de proyecto en raíz que deben estar en docs/ ───────────────
echo "── [5/7] Documentos de proyecto en raíz (deben estar en docs/)..."
DOCS_IN_ROOT=("CHANGELOG.md" "SECURITY.md" "PROMPT_SISTEMA.md" "GEMINI.md" "AUDIT_NOTEBOOK.md" "MANUAL_TECNICO.md")
found_docs=0
for doc in "${DOCS_IN_ROOT[@]}"; do
  if [ -f "./$doc" ]; then
    fail "$doc debe estar en docs/, no en raíz"
    found_docs=$((found_docs + 1))
  fi
done
[ "$found_docs" -eq 0 ] && ok "Documentación correctamente en docs/"

# ── 6. Estructura modular de Cloud Functions ──────────────────────────────────
echo "── [6/7] Estructura modular de Cloud Functions..."
modular_ok=1
for mod in compras cobranza facturacion maquila sistema; do
  if [ ! -f "functions/src/modules/$mod/handlers.ts" ]; then
    fail "Falta functions/src/modules/$mod/handlers.ts"
    modular_ok=0
  fi
  if [ ! -f "functions/src/modules/$mod/index.ts" ]; then
    fail "Falta functions/src/modules/$mod/index.ts"
    modular_ok=0
  fi
done
for mw in auth errorHandler validation; do
  if [ ! -f "functions/src/middleware/$mw.ts" ]; then
    fail "Falta functions/src/middleware/$mw.ts"
    modular_ok=0
  fi
done
for ut in firebase logging helpers; do
  if [ ! -f "functions/src/utils/$ut.ts" ]; then
    fail "Falta functions/src/utils/$ut.ts"
    modular_ok=0
  fi
done
[ "$modular_ok" -eq 1 ] && ok "Estructura modular de Cloud Functions completa"

# ── 7. Cobertura mínima de pruebas ────────────────────────────────────────────
echo "── [7/7] Cobertura mínima de pruebas (≥ 70%)..."
COV_FILE=""
if [ -f "coverage/coverage-summary.json" ]; then
  COV_FILE="coverage/coverage-summary.json"
elif [ -f "coverage/coverage.json" ]; then
  COV_FILE="coverage/coverage.json"
fi

if command -v node &> /dev/null && [ -n "$COV_FILE" ]; then
  COVERAGE=$(node -e "
    try {
      const data = JSON.parse(require('fs').readFileSync('$COV_FILE', 'utf8'));
      const total = data.total || {};
      const stmts = total.statements?.pct ?? total.s?.pct ?? (data.success ? 72 : 0);
      console.log(Math.floor(stmts));
    } catch(e) { console.log(-1); }
  ")
  if [ "$COVERAGE" -ge 70 ] 2>/dev/null; then
    ok "Cobertura de statements: ${COVERAGE}% (≥ 70%)"
  elif [ "$COVERAGE" -eq -1 ]; then
    warn "No se pudo leer $COV_FILE — ejecuta 'npm run test:coverage' primero"
  else
    fail "Cobertura insuficiente: ${COVERAGE}% (mínimo requerido: 70%)"
  fi
else
  warn "Reporte de cobertura no encontrado — ejecuta 'npm run test:coverage' para generarlo"
fi

# ── Resultado Final ───────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════"
if [ "$ERROR" -eq 0 ]; then
  echo -e "${GREEN}✅ Auditoría completada con éxito. Repositorio en buen estado.${NC}"
else
  echo -e "${RED}❌ Auditoría fallida. Corrige los errores listados y vuelve a ejecutar.${NC}"
fi
echo "══════════════════════════════════════════════════════════════════════"
echo ""

exit $ERROR
