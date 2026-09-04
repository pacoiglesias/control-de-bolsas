#!/usr/bin/env bash
# ==============================================================================
# scripts/install.sh - Instalación y verificación unificada de dependencias
# ==============================================================================
set -e

echo "📦 [1/3] Instalando dependencias de raíz (Frontend)..."
npm install

echo "📦 [2/3] Instalando dependencias de Cloud Functions..."
cd functions && npm install && cd ..

echo "🔍 [3/3] Verificando compilación de tipos TypeScript..."
npm run typecheck

echo "✅ Instalación completada exitosamente sin errores."
