#!/usr/bin/env bash
# ==============================================================================
# scripts/backup.sh - Generación de respaldo comprimido seguro (.zip)
# Comprime src/, functions/, docs/ en un archivo .zip (Reemplaza RESPALDAR_A_USB)
# ==============================================================================
set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="backup_control_bolsas_${TIMESTAMP}.zip"

echo "📦 Generando archivo de respaldo ${BACKUP_NAME} de src/, functions/ y docs/..."
zip -r "${BACKUP_NAME}" src functions docs -x "functions/node_modules/*" "functions/lib/*" || git archive -o "${BACKUP_NAME}" HEAD src functions docs

echo "✅ Respaldo generado correctamente en ${BACKUP_NAME}."
