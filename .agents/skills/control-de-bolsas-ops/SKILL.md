---
name: control-de-bolsas-ops
description: Runbook and operational guidelines for building, testing, and deploying the Control de Bolsas ERP project.
---

# Control de Bolsas ERP - Manual de Operaciones

Guía de referencia rápida para que los agentes de Antigravity puedan revisar, probar, compilar y desplegar el sistema.

---

## 🛠️ Comandos de Desarrollo y Compilación

### 1. Compilación del Sistema (Build)
*   **Comando:** `npm run build`
*   **Archivos Generados:** Compila la interfaz cliente en `./dist` y las Cloud Functions en `./functions/lib`.
*   **Nota:** Ejecútalo siempre antes de realizar cualquier despliegue.

### 2. Pruebas Unitarias (Tests)
*   **Comando:** `npx vitest run src/lib/__tests__` o `npm test`
*   **Frecuencia:** Ejecútalo después de modificar lógica matemática o financiera para asegurar que el balance cuadre al centavo.

### 3. Despliegue de Cambios (Deploy)
*   **Solo Interfaz y Reglas (Recomendado si no hay cambios en Functions):**
    ```powershell
    npx firebase deploy --only hosting,firestore
    ```
*   **Despliegue Completo:**
    ```powershell
    npx firebase deploy
    ```

---

## 📊 Conciliación Financiera y Cuentas de Andrés

### 1. Convención de Signos (`historicalDebtAndres`)
*   **Valores Positivos (+):** Saldo a favor de Andrés (anticipo entregado por la empresa).
*   **Valores Negativos (-):** Deuda de la empresa con Andrés.

### 2. Calibración Automática de Saldo
*   Si el saldo de Andrés en pantalla no coincide con el saldo físico real (por ejemplo, `$227,628.94`), no calcules el ajuste manualmente.
*   Dirígete a [Compras.tsx](file:///c:/pacoputo/src/pages/Compras.tsx), presiona el botón **"🔧 Calibrar Saldo"**, e ingresa la cantidad exacta. El sistema calibrará la base en Firestore de forma automática.

### 3. Sincronización y Purga de Datos
*   **Sincronizar:** Al presionar "Sincronizar" en Cobranza, el sistema importa los 11 contrarecibos oficiales activos de Providencia y las facturas en revisión.
*   **Purga:** En la pantalla de Configuración, la herramienta de purga de expedientes de prueba protege automáticamente las entregas activas de Andrés (estatus `pedido`) y las facturas en revisión oficiales (`6198` y `6193`).
