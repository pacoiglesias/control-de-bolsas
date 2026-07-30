# Ficha Técnica y Reporte de Funciones: Control Bolsas ERP (v5.7.0)

## Resumen del Sistema y Arquitectura

- **Producción URL:** `https://control-de-bolsas-69.web.app/`
- **Proyecto Firebase:** `control-de-bolsas-89c88`
- **Versión Actual:** `v5.7.0`

### Reglas del Dominio Operativo
1. **Diferenciación GT / TH vs Folio:**
   - **GT-xxx / TH-xxx** son números de **Contrarecibo (CR)**.
   - Cada factura individual tiene su **Folio numérico de Factura** (ej: `#6084`, `#6054`).
2. **Flujo Financiero y Cobranza:**
   - El cliente (GT/TH) paga vía transferencia electrónica al contador. Factura en estado `paid` (🟡 Con el Contador).
   - El contador entrega el dinero físico/efectivo menos su comisión (ej: 6.9%).
   - Se marca como `collected` (💵 Recibida del Contador), ingresando automáticamente el **monto neto** a Caja Chica.
3. **Módulo de Órdenes de Compra (`/oc`):**
   - Rastreo de kilos contratados por OC vs kilos facturados/surtidos.
4. **Respaldo HTML Offline:**
   - Permite descargar la base de datos completa encapsulada en un archivo `.html` funcional sin servidor.

## 2. Fórmulas Financieras Clave (¡NUNCA OLVIDAR!)
Para evitar confusiones futuras, el negocio opera bajo la siguiente lógica matemática estricta:
- **El IVA cobrado ES PARTE DE LA UTILIDAD INTERNA**, ya que el manejo de impuestos se hace por fuera del sistema.
- **Ingreso Total Facturado:** `(Kilos Totales * Precio de Venta [ej. 47]) + 16% IVA`
- **Costo de Compra (Andrés):** `Kilos Totales * Precio de Compra [ej. 42]`
- **Comisión Contabilidad:** `Ingreso Total Facturado * Porcentaje [ej. 6.9%]` (si config = total).
- **UTILIDAD LÍQUIDA REAL (Lo que queda libre):** `Ingreso Total Facturado - Costo de Compra - Comisión`.
  *(Ejemplo: 47 Venta + IVA = 54.52 Ingreso. Utilidad = 54.52 - 42 Costo - Comisión).*

## 3. Módulos Operativos

### 1.1 Módulo de Inteligencia Artificial (Lectura de Documentos)
- **Extracción de Órdenes de Compra (PDF):** La IA (Gemini 2.0 Flash) es capaz de leer PDFs de órdenes de compra, extrayendo el Folio, Cliente, Kilos Totales y una tabla detallada de artículos (Cantidad, Unidad, Descripción, Precio Unitario, Importe).
- **Extracción de Facturas de Venta (PDF):** La IA detecta cuando un documento es una Factura, extrae la referencia de la orden de compra original, valida el UUID y anexa la factura al expediente correspondiente de manera automática.
- **Procesamiento de Complementos de Pago (XML):** Lector nativo en la nube que analiza los nodos `pago20:DoctoRelacionado` de un CFDI de pago, extrae los UUIDs y busca instantáneamente (O(1)) las facturas pagadas en la base de datos para emitir un aviso.

### 1.2 Módulo de Ventas (Órdenes / Expedientes)
- Creación manual y/o mediante IA.
- Control multi-entregas: Registro de entregas parciales por fecha y notas de remisión.
- Generación nativa de **Remisiones en PDF** listas para imprimir.
- Semáforo de estatus en tiempo real: *Pedido*, *Revisión Manual*, *Facturado*, *Por Cobrar*, *Vencida*, *Cobrada*.

### 1.3 Módulo de Cobranza Ágil
- Tabla de "Antigüedad de Saldos" agrupada por Cliente (Al corriente, 30 días, 60 días, 90+ días).
- Botón **💰 Marcar Cobrada** (Acción rápida a 1-clic).
- **Agrupación por Lotes:** Permite agrupar múltiples facturas bajo el mismo número de Contrarecibo y liquidarlas juntas con un solo botón ("Pagar Lote").
- **Alertas Visuales:** Sistema de advertencia automático (globos rojos) indicando exactamente cuántos días de atraso lleva una factura vencida.
- Manejo de Estatus de Complemento de Pago (REP: Pendiente/Emitido).

### 1.4 Módulo de Compras a Fabricante
- Registro manual de kilos pedidos vs kilos recibidos del proveedor.
- Control de cuentas por pagar al proveedor (Deuda pendiente).

### 1.5 Módulo de Caja Chica / Flujo
- Panel para registrar egresos menores y gastos operativos.
- Impacto directo en el cálculo de la liquidez real.

### 1.6 Dashboard Gerencial
- Gráficas de Rentabilidad (Venta, Costo, Utilidad).
- Tarjetas de KPIs: Kilos Pedidos vs Entregados, Cuentas por Cobrar, Deuda Vencida.

### 1.7 Respaldo de Seguridad
- Exportación total de la base de datos a **Excel (.xlsx)** estructurado por pestañas.

## 2. Tecnologías y Seguridad

- **Frontend:** React, TypeScript, Vite. Progressive Web App (PWA) instalable en escritorio (Windows/Mac) y Móviles (iOS/Android) con soporte Offline Parcial.
- **Backend:** Firebase Authentication, Firestore Database, Firebase Storage, Cloud Functions (Node.js).
- **Seguridad (Zero-Trust):** 
  - Reglas de Firestore y Storage limitadas por dominios aprobados.
  - Exigencia estricta de `email_verified == true`.
  - Archivos protegidos mediante el SDK de Administración en el servidor.
- **Infraestructura Local:** Orquestación total (Inicio, Pruebas, Despliegue) mediante `CONTROL_MAESTRO.bat`. Privacidad de GitHub administrada por `PROTEGER_CODIGO.bat`.

## 4. Limitaciones / Reglas de Negocio
- La comisión estándar y parámetros globales se calculan en base a configuraciones que quedan inmutables una vez la factura ha sido creada.
- El sistema no maneja inventario físico de bodega, asumiendo un flujo directo *"Compra a proveedor -> Entrega a cliente"*.

## 5. Auditoría y Automejora Continua (Prompt Staff)

Para mantener la base de código libre de deuda técnica y prevenir caídas de memoria, utilizar periódicamente el siguiente prompt en la IA:

```text
Actúa como un Principal Software Engineer (Staff+) experto en React, Firebase y Arquitecturas Cloud a gran escala. 
Tu tarea es realizar una "Auditoría de Automejora Continua y Resiliencia" sobre este sistema (Control Bolsas ERP).

CONTEXTO DEL NEGOCIO: Es un ERP SaaS de control financiero para un mayorista (compras, ventas, comisiones, expedientes PDF). Existen diferentes roles (admin, viewer). 

PASOS A SEGUIR:
1. Revisión Arquitectónica: Audita los archivos críticos: src/lib/finance.ts, src/pages/OrderModal.tsx, functions/src/index.ts, los archivos de Firebase Rules (firestore.rules, storage.rules) y los gestores de estado (src/hooks/useOrders.ts).
2. Rendimiento Frontend: Identifica cuellos de botella de renderizado (renders masivos por inputs, loops O(N) ineficientes en los reduce financieros o dependencias de useMemo mal diseñadas).
3. Escalabilidad Firestore: Identifica "Full Table Scans" o suscripciones onSnapshot globales que colapsarán el navegador cuando la base crezca a 10,000+ registros. Propón estrategias de paginación, límites o agregación en la nube.
4. Resiliencia de Cloud Functions: Revisa el manejo de errores y timeouts en la nube (ej. ¿Qué sucede si la API de Gemini falla al leer un PDF? ¿Existen dead-letter queues o mecanismos de fallback?).
6. Despliegues (Build & Deploy): 
   - Siempre correr `npm run build` antes de un despliegue de frontend.
   - **Regla Estricta:** Inmediatamente DESPUÉS de hacer un despliegue exitoso (sea de funciones, reglas o frontend), el agente **SIEMPRE** debe hacer dos cosas:
     1. Hacer commit y push de todos los cambios a GitHub (`git add .`, `git commit -m "..."`, `git push`).
     2. Ejecutar el script `pwsh .\backup.ps1` para generar el ZIP local de seguridad.
7. Seguridad y Desajustes: Identifica vulnerabilidades de seguridad. Verifica que el cliente no pueda ejecutar escrituras que no le corresponden, y asegúrate de que condiciones críticas estén presentes en las reglas.
8. Auditoría UI/UX (Estética y Modernización): Evalúa la interfaz (CSS, Tailwind, animaciones). Identifica donde se pueden aplicar principios de diseño premium (Glassmorphism, sombras sutiles, paletas de color armónicas), micro-interacciones proactivas (Smart Hovers) y feedback sensorial o visual para mantener la plataforma al nivel de las mejores SaaS del mercado.
9. Limpieza: Identifica deuda técnica, código muerto o funciones que se ejecutan innecesariamente múltiples veces.
10. REGLA DE ORO: NO implementes nuevas funcionalidades ni modifiques código fuente en este paso. Tu único objetivo es optimizar, limpiar, refactorizar y proponer mejoras de estabilidad visuales y arquitectónicas.
11. Entregable: Entrégame un "Plan de Refactorización" en formato Markdown antes de tocar el código. Divídelo estrictamente en tres categorías: P0 (Crítico - Riesgo inminente), P1 (Recomendado - Performance/Escalabilidad) y P2 (Nice to have - Deuda técnica leve o mejoras visuales).
```
