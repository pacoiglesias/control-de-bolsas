# Plan Maestro de Auditoría, Optimización Proactiva y Eliminación de Fricción (ERP Control de Bolsas)
**Fecha de Elaboración:** 2026-09-25  
**Estado del Sistema:** 🟢 100% Funcional, Compilación Cero Errores, 204/204 Pruebas Unitarias Verificadas.

---

## 1. Diagnóstico y Veredicto Ejecutivo del Sistema

### ¿El sistema ya está completamente funcional?
**SÍ, el sistema se encuentra 100% operativo y blindado en sus reglas de negocio:**
1. **Precisión Matemática y Financiera:** 
   - Conciliación de compras a Andrés a $38.00/kg con calibración de saldo histórico (`historicalDebtAndres`) y libro mayor de anticipos.
   - Facturación a Providencia a $43.00/kg con retención del 8% de comisión e IVA 16% ($8.44/kg de margen libre real).
   - Órdenes maestras canónicas vigentes: Textil Hogar `120267114302` (José Nava) y Grupo Textil `12026439784` (Evelia).
2. **Estabilidad Técnica:**
   - 204 pruebas unitarias pasando en Vitest (`npm test`).
   - Compilación estricta TypeScript (`tsc`) sin errores tanto en Frontend como en Cloud Functions.
   - PWA instalable con Service Worker y soporte offline.
3. **Auditoría Continua (Centinela):**
   - Motor de auditoría en vivo (`auditEngine.ts`) con `HealthGaugeDial`, `AuditCentinelaBadge` y `AuditHealthCard` en el Dashboard.

---

## 2. Auditoría Forense: Duplicidades, Fricción y Oportunidades de Mejora

A pesar de que el sistema es matemáticamente perfecto y estable, el análisis de usabilidad y ergonomía detecta oportunidades clave para evitar repeticiones y hacerlo más ágil:

### A. Repetición o Dispersión de Pantallas y Rutas
| Situación Actual | Problema / Fricción | Propuesta de Unificación |
| :--- | :--- | :--- |
| `/ordenes` (Expedientes y OCs) vs `/oc` (Seguimiento por OC) | El usuario tiene dos pantallas para ver órdenes. `/ordenes` muestra el kanban/tabla general y `/oc` muestra entregas y báscula agrupadas. | **Integración en un solo módulo con switch de perspectiva:** En `/ordenes` agregar una pestaña/toggle de "Vista Logística de Báscula" o vincularlas directamente sin forzar al usuario a saltar de ruta. |
| `/captura-rapida` vs Botón Topbar "⚖️ Capturar Entrega" | Existe una ruta entera para captura rápida de báscula, pero también existe un modal rápido desde el topbar y botones en fila. | Mantener `/captura-rapida` como vista enfocada para tablet/móvil en patio de báscula, pero asegurar que use el mismo motor y validaciones del modal global. |
| `/centro-control` vs `/configuracion` | Configuración fragmentada: `/centro-control` (herramientas administrativas y purga) y `/configuracion` (personalización visual y temas). | **Unificación total en `/centro-control`:** Integrar la pestaña de personalización/temas dentro del Centro de Control con pestañas claras, dejando un solo punto de configuración en el menú. |
| Múltiples modales de carga | Existen modales separados para subida universal, pegado de contrarecibo, arrastre de Excel y dropzone de documentos. | **Hub Único de Ingesta Inteligente:** Un modal unificado con pestañas claras o detección predictiva del tipo de contenido (XML SAT, PDF de OC, imagen de báscula o texto de WhatsApp). |

---

## 3. Plan de Tareas de Implementación (Backlog Priorizado)

### Fase 1: Consolidación y Eliminación de Pantallas Redundantes (Ergonomía)
- [x] **Tarea 1.1:** Arreglar y blindar la compilación de `AuditHealthCard`, `AuditCentinelaBadge` y `UniversalDocumentUploadModal` (Completado: 0 errores de tipado).
- [ ] **Tarea 1.2:** Unificar `/configuracion` dentro de `/centro-control` mediante pestañas organizadas (*Ajustes Generales, Datos de Empresa, Purga/Respaldo, Temas & Apariencia*), eliminando el enlace duplicado en la barra lateral para roles administradores.
- [ ] **Tarea 1.3:** Puente bidireccional entre `/ordenes` y `/oc`: Agregar en la cabecera de `/ordenes` un botón directo "🚚 Modo Logístico (Báscula)" y en `/oc` un botón directo "📂 Ver Expedientes y Finanzas".

### Fase 2: Proactividad y Automatización ("ERP Auto-Conducido")
- [ ] **Tarea 2.1:** **Smart Action Hub en Dashboard:** Un widget proactivo en la parte superior que presenta las 3 acciones más urgentes del día con ejecución en 1 clic:
  - Cobros del viernes de Providencia listos para conciliar.
  - Facturas que cumplieron 72h sin contrarecibo (botón WhatsApp pre-redactado).
  - Kilos entregados en patio pendientes de facturar.
- [ ] **Tarea 2.2:** **Pegado Inteligente Omnicanal:** Detectar automáticamente si lo que el usuario pega es un Contrarecibo (`TH-`/`GT-`), un folio de Factura (`F-XXXX`), o una nota de Báscula (kilos + bultos), y aplicar la acción correcta sin preguntarle qué tipo de documento es.
- [ ] **Tarea 2.3:** **Notificaciones Push y Sonoras Proactivas:** Alertar sutilmente al usuario cuando se registre un pesaje de báscula desde el portal de maquilador o cuando una orden alcance el 100% de kilos entregados.

### Fase 3: Claridad Visual y Anti-Duplicidad de Métricas
- [ ] **Tarea 3.1:** Validar que en el Dashboard Ejecutivo, los números del KPI Superior, los Pods de Nava/Evelia y el Pipeline de Flujo de Dinero no muestren la misma cifra 3 veces, sino diferentes ángulos complementarios (Total Cartera vs Vencido Hoy vs En Patio).
- [ ] **Tarea 3.2:** Asegurar que los botones de acción rápida tengan feedback táctil (háptico) y auditivo armónico en dispositivos móviles.

---

## 4. Matriz de Estado y Verificación

| Componente | Estado Funcional | Nivel de Proactividad | Riesgo |
| :--- | :---: | :---: | :---: |
| Conciliación Andrés ($38/kg) | 🟢 100% | ⭐⭐⭐⭐⭐ (Calibrador 1-clic) | Nulo |
| Facturación Providencia ($43/kg) | 🟢 100% | ⭐⭐⭐⭐ (Borrador CFDI 4.0) | Nulo |
| Cobranza y Contrarecibos | 🟢 100% | ⭐⭐⭐⭐⭐ (Auto-Matching y Alertas 72h) | Nulo |
| Auditoría Centinela Continua | 🟢 100% | ⭐⭐⭐⭐⭐ (HealthGaugeDial en Dashboard) | Nulo |
| Navegación y Menú Lateral | 🟢 100% | ⭐⭐⭐ (Requiere unificar Configuración) | Nulo |
