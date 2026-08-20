# ERP Control Bolsas — Bolsas Elemental / Grupo Textil Providencia (v8.9.4)

Este es el repositorio oficial del ERP de compras, maquila, entregas, facturación, cobranza, flujo de efectivo y prefacturas SAT de **Bolsas Elemental**, para la intermediación de bolsas plásticas con el cliente **Grupo Textil Providencia** (departamentos TH/GT) y el maquilador **Andrés**.

## 🚀 Estado del Sistema (v8.9.4)
- **URL de Producción:** https://control-de-bolsas-69.web.app
- **URL Secundaria:** https://control-de-bolsas-89c88.web.app
- **Proyecto Firebase:** `control-de-bolsas-89c88`
- **Compilación:** PWA + Vite + React 18.3 + Cloud Functions Node 22
- **Pruebas Unitarias:** 72/72 pruebas aprobadas en Vitest, `tsc --noEmit` limpio (frontend y backend), `eslint` 0 errores.
- **Suite de Productividad:** Spotlight Universal (`Ctrl+K`), Smart Quick-Peek Drawer, Floating Quick Hub (`⚡`), Modo Privacidad Instantáneo (`Ctrl+H`), Kanban de expedientes/compras/logística con drag & drop, Motor Háptico & Web Audio offline.
- **Portal Maquilador:** acceso por PIN (con bloqueo tras 5 intentos fallidos), registro de entregas y bitácora, pensado para celular en el taller.
- **Parametrización Universal:** empresa, cliente principal, taller maquilador y departamentos configurables desde Ajustes (`/centro-control`), sin nombres fijos en el código.

## 🚀 Despliegue
El sistema se instala, compila y despliega con `INSTALAR_BUILD_DEPLOY.bat` (dependencias → typecheck → pruebas → lint → build → deploy en orden Reglas → Cloud Functions → Hosting). Los cambios se suben a GitHub con `SUBIR_CAMBIOS.bat` (mensaje de commit automático a partir de `CHANGELOG.md`).

**URL de Producción:** https://control-de-bolsas-69.web.app

## 📖 Arquitectura y Reglas del Sistema
Para entender cómo están estructuradas las bases de datos de Firebase, la inmutabilidad de los snapshots financieros y cómo la Inteligencia Artificial (Google Gemini) procesa los PDFs y XML del SAT, consulta:

👉 **[docs/SISTEMA_ACTUAL.md](./docs/SISTEMA_ACTUAL.md)** — arquitectura, modelo de datos y reglas de negocio.
👉 **[docs/MANUAL_TECNICO_Y_ARQUITECTURA.md](./docs/MANUAL_TECNICO_Y_ARQUITECTURA.md)** — fórmulas financieras y catálogo técnico de módulos.
👉 **[docs/INSTRUCCIONES_USO.md](./docs/INSTRUCCIONES_USO.md)** — manual de uso para el equipo.
👉 **[SECURITY.md](./SECURITY.md)** — modelo de seguridad y permisos.
👉 **[PROMPT_SISTEMA.md](./PROMPT_SISTEMA.md)** — contexto maestro para pedirle a cualquier IA que audite o mejore el sistema.

## 📜 Historial de Cambios
Las notas de lanzamiento y el track de versiones se encuentran en:

👉 **[CHANGELOG.md](./CHANGELOG.md)** — historial técnico detallado, versión por versión.
👉 **[AUDIT_NOTEBOOK.md](./AUDIT_NOTEBOOK.md)** — bitácora viva de auditoría (hallazgos, impacto, solución, verificación) para cada mejora de fondo.
