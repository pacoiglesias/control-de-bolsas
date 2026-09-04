# ERP Control Bolsas — Bolsas Elemental / Grupo Textil Providencia

**Versión:** `v9.2.3`  
**Estado:** Producción Activa  
**URLs Oficiales:**
- 🌐 Dominio Principal: [https://bolsas.cobertores.com](https://bolsas.cobertores.com)
- ⚡ Mirror Firebase Hosting: [https://control-de-bolsas-69.web.app](https://control-de-bolsas-69.web.app)
- ☁️ Respaldo Firebase Hosting: [https://control-de-bolsas-89c88.web.app](https://control-de-bolsas-89c88.web.app)

---

## 🚀 Resumen del Sistema
Sistema ERP especializado en la intermediación, conciliación de remisiones físicas de báscula, facturación CFDI multi-concepto, control de contrarecibos oficiales (`TH-` y `GT-`) y auditoría de maquila con el taller de Andrés y el cliente Grupo Textil Providencia (Plantas TH-ALMACEN-1 y P4-ALM).

- **Stack:** React 18 + TypeScript 5 + Vite PWA + Firebase Cloud Functions (Node 22) + Cloud Firestore
- **Pruebas Automatizadas:** 148 pruebas unitarias matemáticas y financieras en Vitest (`npm test`)

---

## 📚 Documentación Centralizada

Toda la documentación técnica, arquitectónica y operativa se encuentra organizada en [`docs/`](./docs/README.md):

- 📖 **[Arquitectura y Reglas del Sistema](./docs/SISTEMA_ACTUAL.md)**
- 📐 **[Manual Técnico y Fórmulas Financieras](./docs/MANUAL_TECNICO.md)**
- 👥 **[Instrucciones de Uso y Operación](./docs/INSTRUCCIONES_USO.md)**
- 📜 **[Historial de Versiones (Changelog)](./docs/CHANGELOG.md)**
- 🛡️ **[Políticas de Seguridad y Firestore Rules](./docs/SECURITY.md)**
- 🤖 **[Prompt Maestro del Sistema](./docs/PROMPT_SISTEMA.md)**
- 🧠 **[Configuración de Gemini](./docs/GEMINI.md)**
- 📋 **[Bitácora de Auditoría](./docs/AUDIT_NOTEBOOK.md)**

---

## 🛠️ Scripts Operativos Unificados

Los scripts de mantenimiento y despliegue están centralizados en `scripts/`:

```bash
# Instalación limpia y verificación de tipos
sh scripts/install.sh

# Ejecución de auditoría y pruebas unitarias
sh scripts/audit.sh

# Compilación y despliegue en producción
sh scripts/deploy.sh

# Creación de respaldo comprimido seguro (.zip)
sh scripts/backup.sh

# Sincronización y commit automático en Git
sh scripts/git-helper.sh "Mensaje de commit"

# Limpieza de cachés temporales
sh scripts/utils.sh clean
```
