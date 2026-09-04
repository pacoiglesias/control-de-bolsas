#!/usr/bin/env bash
# ==============================================================================
# scripts/utils.sh - Utilidades operativas (limpieza de caché y diagnóstico)
# ==============================================================================
set -e

ACTION=${1:-"clean"}

case "$ACTION" in
  clean)
    echo "🧹 Limpiando cachés de Vite, temporales y builds..."
    rm -rf dist node_modules/.vite *.tsbuildinfo
    echo "✅ Caché y artefactos temporales eliminados."
    ;;
  check-deps)
    echo "🔍 Verificando versiones y posibles vulnerabilidades en dependencias..."
    npm audit --audit-level=high || true
    ;;
  *)
    echo "Uso: scripts/utils.sh [clean | check-deps]"
    exit 1
    ;;
esac
