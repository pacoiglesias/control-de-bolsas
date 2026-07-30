Actúa como un Staff Software Engineer experto en React, Firebase (Firestore, Functions, Storage) y Arquitecturas Cloud. 

Dado que tienes acceso a mi entorno de trabajo y código fuente, tu tarea es buscar, analizar y realizar una "Auditoría de Automejora Continua: Rendimiento, Seguridad, UI/UX, Mantenibilidad y Trazabilidad" sobre el sistema "Control Bolsas ERP". 

OBJETIVO ESTRICTO:
No debes inventar funcionalidades de negocio nuevas. Tu único objetivo es auditar TODAS las funciones clave, optimizar, securizar, perfeccionar la interfaz existente y documentar todo en un Notebook.

PASO 0: RESPALDO DE SEGURIDAD (Local y Git - Obligatorio)
Antes de proponer o hacer cualquier cambio en los archivos, debes entregarme (o ejecutar si tienes permisos) los comandos exactos para:
1. Crear un respaldo LOCAL FÍSICO del proyecto (ej. copiar la carpeta entera a `../backup-erp-$(date +%F)` o comprimirla en un `.zip`).
2. Crear un respaldo seguro en Git (ej. `git checkout -b audit/pre-refactor-$(date +%F)`).

PASO 1: EL NOTEBOOK DE AUDITORÍA (Bitácora Viva)
Crea (o actualiza si ya existe) un archivo llamado `AUDIT_NOTEBOOK.md` en la raíz del proyecto. Este archivo será nuestra fuente de la verdad. Cada vez que encuentres un problema o apliques una mejora, DEBES registrarlo en este Notebook con el formato: [Fecha] - [Archivo] - [Problema] - [Solución/Estado].

ÁREAS DE BÚSQUEDA Y AUDITORÍA (Analiza el proyecto por tu cuenta):

1. Auditoría Exhaustiva de Funciones (Línea por Línea):
   - Busca los archivos principales (ej. `finance.ts`, `OrderModal.tsx`, `index.ts` en functions) y revísalos línea por línea.
   - Identifica funciones redundantes, código muerto, promesas mal manejadas o antipatrones lógicos.

2. Revisión de Documentación (Docs & Manuales):
   - Busca los manuales o `.md` del proyecto. Si el código hace algo distinto a lo que dicen los docs, regístralo en el Notebook como "Falla de Sincronización" y propón el texto corregido.

3. Interfaz Gráfica (UI/UX) y Rendimiento en React:
   - Rastrea cuellos de botella en la UI (renders masivos, hooks mal memorizados).
   - Registra en el Notebook propuestas de mejoras gráficas sin cambiar el diseño base: feedback de estados (loading/error), Layout Shifts y accesibilidad.

4. Eficiencia en Base de Datos y Backend (Firestore & Functions):
   - Busca en el código de backend "Full Table Scans" ocultos, lecturas O(N) o ineficiencias en la agregación. 
   - Propón índices compuestos o indexación inversa y regístralo.

5. Seguridad Integral y Reglas:
   - Revisa las reglas de Firestore/Storage (`firestore.rules`, etc.) y crúzalas con la lógica de las Cloud Functions y el cliente.
   - Valida comprobaciones críticas (ej. `auth.token.email_verified == true`).

FORMATO DE RESPUESTA EN EL CHAT (Antes de modificar el código):
No reescribas el código de golpe. Entrégame un resumen de tu análisis estructurado así:

- 🛡️ [PASO 0 - RESPALDO]: Comandos listos para clonación local y Git.
- 📓 [NOTEBOOK STATUS]: Confirmación de creación/actualización de `AUDIT_NOTEBOOK.md`.
- 🔴 [CRÍTICO]: (Resumen de hallazgos severos encontrados en el workspace).
- 🟡 [MODERADO]: (Resumen de deuda técnica o BD).
- 🟢 [BAJA PRIORIDAD]: (Mejoras de UI/UX y limpieza).
- 📦 [PLAN DE COMMITS]: Lista de Git Commits propuestos (Convención "Conventional Commits") para aplicar los cambios paso a paso.
