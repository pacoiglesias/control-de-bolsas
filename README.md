# ERP Control Bolsas - Grupo Providencia (v6.5.0 Enterprise)

Este es el repositorio oficial del ERP de ventas, cobranza, flujo de efectivo y emisión de Pre-Facturas CFDI 4.0 para Grupo Textil Providencia.

## 🚀 Estado del Sistema (v6.5.0 Enterprise)
- **URL de Producción:** https://control-de-bolsas-69.web.app
- **Compilación:** PWA + Vite + React 18.3 + Cloud Functions Node 22 (CommonJS/ESNext)
- **Motor Financiero Dinámico:** Implementación canónica de utilidad, despejes de comisión e impuestos (15/15 Pruebas Unitarias Pasadas).
- **Herramienta de Pre-Factura CFDI 4.0:** Generador impreso/vectorial con metadatos del SAT (`GTP930115PU1`, Clave `24141500`, Unidad `KGM`).
- **Retroalimentación Auditoria & Audio Sensorial:** Micro-tonos Web Audio API nativos integrados en notificaciones.

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
