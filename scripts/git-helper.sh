#!/usr/bin/env bash
# ==============================================================================
# scripts/git-helper.sh - Automatización segura de commits y sincronización Git
# ==============================================================================
set -e

MSG=${1:-"Auto-commit: Actualización y sincronización de ERP"}
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "📌 Agregando cambios al índice de Git..."
git add -A

echo "💾 Registrando commit: \"$MSG\"..."
git commit -m "$MSG" || echo "ℹ️ No había cambios pendientes por confirmar."

echo "🚀 Enviando a origin ($BRANCH)..."
git push origin "$BRANCH"

echo "✅ Sincronización Git finalizada exitosamente en rama $BRANCH."
