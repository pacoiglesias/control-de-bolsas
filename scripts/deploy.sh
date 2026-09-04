#!/usr/bin/env bash
# ==============================================================================
# scripts/deploy.sh - Compilación y Despliegue Unificado (Hosting & Functions)
# ==============================================================================
set -e

echo "🚀 [1/2] Compilando bundles de producción (Vite PWA + Cloud Functions)..."
npm run build

echo "☁️ [2/2] Desplegando en Firebase (Hosting y Functions)..."
npx firebase deploy --only hosting,functions

echo "✅ Despliegue en producción completado exitosamente."
