# ERP Control Bolsas — Bolsas Elemental / Grupo Textil Providencia

**Versión:** `v9.3.0`  
**Estado:** Producción Activa  
**URLs Oficiales:**
- 🌐 Dominio Principal: [https://bolsas.cobertores.com](https://bolsas.cobertores.com)
- ⚡ Mirror Firebase Hosting: [https://control-de-bolsas-69.web.app](https://control-de-bolsas-69.web.app)
- ☁️ Respaldo Firebase Hosting: [https://control-de-bolsas-89c88.web.app](https://control-de-bolsas-89c88.web.app)

---

## 🚀 Resumen del Sistema

Sistema ERP especializado en la intermediación, conciliación de remisiones físicas de báscula, facturación CFDI multi-concepto, control de contrarecibos oficiales (`TH-` y `GT-`) y auditoría de maquila con el taller de Andrés y el cliente Grupo Textil Providencia (Plantas TH-ALMACEN-1 y P4-ALM).

- **Stack:** React 18 + TypeScript 5 + Vite PWA + Firebase Cloud Functions (Node 22) + Cloud Firestore
- **Pruebas Automatizadas:** 148+ pruebas unitarias matemáticas y financieras en Vitest (`npm test`)
- **Cobertura mínima:** 80% (statements, branches, functions, lines) — validado en CI

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

## 🛠️ Scripts de Desarrollo

```bash
# Servidor de desarrollo (carga .env.development automáticamente)
npm run dev

# Compilación estándar (producción)
npm run build

# Compilación para staging
npm run build:staging

# Compilación para producción (explícito)
npm run build:prod

# Ver TypeScript errors
npm run typecheck

# Linting (ESLint)
npm run lint
```

## 🧪 Pruebas y Cobertura

```bash
# Ejecutar pruebas unitarias
npm test

# Ejecutar con reporte de cobertura (HTML + LCOV)
npm run test:coverage

# Modo CI: genera coverage/coverage.json para auditoría
npm run test:ci
```

El reporte HTML se genera en `coverage/index.html`. El umbral mínimo es **80%** en todos los métricas.

---

## 🚀 Scripts de Despliegue

```bash
# Despliegue completo (usa proyecto prod por defecto)
npm run deploy

# Despliegue a staging
npm run deploy:staging

# Despliegue a producción
npm run deploy:prod
```

---

## 🔧 Scripts Operativos de Mantenimiento

Los scripts de mantenimiento están centralizados en `scripts/`:

```bash
# Auditoría integral del repositorio (estructura, logs, cobertura, módulos)
sh scripts/audit.sh
# o equivalente:
npm run audit

# Instalación limpia de dependencias
sh scripts/install.sh

# Creación de respaldo comprimido seguro (.zip)
sh scripts/backup.sh

# Limpieza de cachés temporales
sh scripts/utils.sh clean
```

---

## 🏗️ Arquitectura de Cloud Functions

Las Cloud Functions están completamente modularizadas en `functions/src/`:

```
functions/src/
├── modules/
│   ├── compras/          → sanitizePurchaseOrder, processPurchaseOrder
│   ├── cobranza/         → checkOverdueInvoices, validateContrarecibo
│   ├── facturacion/      → validateInvoiceCFDI, getInvoicesByOrder, validateInvoiceData
│   ├── maquila/          → getActiveMaquilaOrders, registrarEntregaMaquila, importarEntregaMaquilaPendiente
│   └── sistema/          → scheduledMidnightBackup, updateCajaChicaBalance
├── middleware/
│   ├── auth.ts           → ensureAuthenticated (callable), validateAuth (HTTP)
│   ├── validation.ts     → validateSchema (Zod wrapper)
│   └── errorHandler.ts   → ValidationError, AuthenticationError, handleFunctionError
├── utils/
│   ├── firebase.ts       → db, auth, storage (singletons)
│   ├── logging.ts        → loggerPro, logStructured
│   └── helpers.ts        → round2, safeNumber
├── handlers/             → handlers legacy (maquilaPortal, notifications, uploadProcessing)
├── ai/                   → parseDocumentData (Gemini)
└── index.ts              → barrel de re-exportaciones
```

---

## 🌍 Variables de Entorno

Copia `.env.example` y completa con tus valores:

```bash
cp .env.example .env.development  # desarrollo local
cp .env.example .env.staging      # staging
cp .env.example .env.production   # producción
```

Las variables `VITE_*` se inyectan automáticamente según el modo de build (`--mode development|staging|production`).

> ⚠️ **Los archivos `.env.*` con valores reales están en `.gitignore`** y nunca deben commitearse.
> En CI/CD se configuran como GitHub Secrets del repositorio.

---

## 🔄 CI/CD — GitHub Actions

El workflow `.github/workflows/ci.yml` ejecuta automáticamente en cada PR y push a `main`:

1. **Auditoría Estructural** — verifica archivos prohibidos, logs, límite de raíz
2. **Auditoría Modular** — verifica que todos los módulos de Cloud Functions existan
3. **TypeCheck** — `tsc --noEmit` en raíz y en `functions/`
4. **Tests** — `vitest run`
5. **Cobertura** — `vitest run --coverage` con umbral mínimo 80%
6. **Lint** — ESLint
7. **Build** — compilación completa (Frontend + Functions)

Las variables de entorno en CI se leen de **GitHub Secrets** del repositorio con fallback a placeholders no funcionales.

---

## 🔥 Proyectos Firebase

| Alias | Proyecto | Uso |
|-------|----------|-----|
| `dev` | `control-de-bolsas-dev` | Desarrollo local / emulador |
| `staging` | `control-de-bolsas-staging` | Pre-producción |
| `prod` | `control-de-bolsas-89c88` | Producción activa |

```bash
# Cambiar entre proyectos
firebase use dev
firebase use staging
firebase use prod
```
