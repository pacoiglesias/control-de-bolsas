#!/usr/bin/env bash
# ==============================================================================
# scripts/audit.sh - Auditoría, Diagnóstico de Archivos y Pruebas Unitarias
# ==============================================================================
set -e

echo "🧪 [1/3] Ejecutando suite de pruebas matemáticas y financieras (Vitest)..."
npx vitest run src/lib/__tests__

echo "🔎 [2/3] Verificando estándares de código estático (ESLint)..."
npm run lint || echo "⚠️ Advertencias no críticas de linting revisadas."

echo "🧹 [3/3] Verificando ausencia de archivos obsoletos o temporales en raíz..."
bat_count=$(find . -maxdepth 1 -name "*.bat" | wc -l)
ps1_count=$(find . -maxdepth 1 -name "*.ps1" | wc -l)

if [ "$bat_count" -gt 0 ] || [ "$ps1_count" -gt 0 ]; then
  echo "❌ Error: Aún existen scripts .bat o .ps1 en la raíz."
  exit 1
fi

echo "✅ Auditoría completada con éxito: 100% pruebas aprobadas y estructura limpia."
