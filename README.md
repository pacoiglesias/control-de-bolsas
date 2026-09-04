# ERP Control Universal - Control de Bolsas

> La versión vigente del sistema es la de `package.json` (campo `version`). No repitas el número aquí: los documentos de `docs/` llegaron a tener 5 números de versión distintos y contradictorios al mismo tiempo (auditoría 2026-09-03). Si necesitas saber la versión exacta, revisa `package.json` o el `CHANGELOG.md`.

Este es el repositorio oficial del ERP de compras, maquila, entregas, facturación, cobranza, flujo de efectivo y prefacturas SAT con parametrización multi-empresa.

## 🚀 Estado del Sistema
- **URL de Producción:** https://control-de-bolsas-69.web.app
- **URL Secundaria:** https://control-de-bolsas-89c88.web.app
- **Compilación:** PWA + Vite + React 18.3 + Cloud Functions Node 22 (100% limpia)
- **Suite de Lujo:** Spotlight Universal (`Ctrl+K`), Smart Quick-Peek Drawer, Floating Quick Hub (`⚡`), Modo Privacidad Instantáneo (`Ctrl+H`) y clases de resplandor ambiental.
- **Motor Háptico & Web Audio:** Síntesis sonora nativa offline y respuesta háptica en 0 dependencias externas.
- **Parametrización Universal:** Configurable para cualquier empresa, cliente, taller maquilador y departamentos.
- **Pruebas Unitarias:** 72/72 pruebas aprobadas al 100% en Vitest.

## 🚀 Despliegue y CI/CD
El sistema cuenta con **Integración Continua (GitHub Actions)**. 
Cada vez que haces un push a la rama `main`, los servidores de GitHub compilan automáticamente el código React (Vite) y las Cloud Functions, y despliegan los cambios a Firebase Hosting y Firebase Functions en vivo.

**URL de Producción:** https://control-de-bolsas-69.web.app

## 📖 Arquitectura y Reglas del Sistema
Para entender cómo están estructuradas las bases de datos de Firebase, cómo funciona la **Inmutabilidad de los Snapshots Financieros**, y cómo la **Inteligencia Artificial (Google Gemini)** procesa los PDFs y los XML del SAT de forma bi-funcional, consulta el documento principal:

👉 **[SISTEMA_ACTUAL.md](./docs/SISTEMA_ACTUAL.md)**

Allí también encontrarás el **Prompt de Auto-Auditoría** para solicitar a cualquier IA que optimice este código en el futuro.

## 📜 Historial de Cambios
Las notas de lanzamiento y el track de versiones (hasta la actual Fase 7 Enterprise) se encuentran documentadas en:

👉 **[CHANGELOG.md](./CHANGELOG.md)**
