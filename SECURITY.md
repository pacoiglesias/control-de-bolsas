# 🛡️ Política y Modelo de Seguridad — Control Bolsas ERP

## 🔐 Modelo de Autenticación y Permisos (Zero Trust)

### 1. Autenticación Nivel App
- Únicamente usuarios autenticados mediante Firebase Auth pueden ingresar a las rutas de la aplicación.
- Requiere correo verificado (`email_verified == true`) o autenticación mediante Google Sign-In para cuentas organizacionales autorizadas.

### 2. Jerarquía de Roles
- **`admin`**: Acceso total al sistema, configuraciones globales, caja chica, respaldo, bitácora de auditoría y ejecución de herramientas de seed/reset.
- **`manager`**: Acceso a ventas, subir facturas, cobranza, catálogo y seguimiento de Órdenes de Compra.
- **`viewer`**: Acceso de lectura únicamente a tableros principales y listados de órdenes/ventas.

### 3. Reglas de Seguridad Firestore (`firestore.rules`)
- **`orders`**: Lectura y escritura permitida únicamente a usuarios autenticados con rol verificado (`admin`/`manager`).
- **`system_settings`**: Lectura para usuarios autenticados; escritura exclusiva para el rol `admin`.
- **`system_logs`**: Lectura exclusiva para `admin`. Escritura append-only para usuarios autenticados con validación de campos (`user`, `action`, `timestamp`). No se permiten modificaciones ni eliminaciones (`update, delete: if false`).

### 4. Reglas de Seguridad Storage (`storage.rules`)
- Archivos de facturas, PDFs y XMLs restringidos a usuarios autenticados.
- Límite de tamaño:
  - Documentos / PDFs / imágenes: Máximo 25 MB.
  - Archivos XML: Máximo 10 MB.

### 5. Sanitización Server-Side Mandatoria (`sanitizePurchaseOrder`)
- Cloud Function en backend que recalcula automáticamente y de forma estricta los valores financieros (`saleTotal`, `costTotal`, `commission`, `netCashFlow`) usando los snapshots inmutables del expediente o la configuración histórica.
- Evita que importes manipulados desde las herramientas del desarrollador (DevTools) persistan en la base de datos.
