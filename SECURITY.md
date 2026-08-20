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
- **`system_logs`**: Lectura exclusiva para `admin`. Escritura append-only, con **verificación de identidad y de sello de tiempo**: la regla exige que `request.resource.data.user` sea exactamente `request.auth.token.email` en minúsculas y que `timestamp` sea igual a `request.time` (lo que sólo se cumple usando `serverTimestamp()`). Nadie puede firmar una entrada con el correo de otro ni fechar hacia atrás. No se permiten modificaciones ni eliminaciones (`update, delete: if false`).
- **`products`**: Lectura para cualquier usuario autenticado; escritura para `admin` y `manager`. El catálogo se alimenta solo al guardar las partidas de un expediente.
- **`snapshots`**: Lectura y escritura exclusivas para `admin`, incluidas las subcolecciones (`snapshots/{id}/blob/data`, donde vive el contenido de cada respaldo).

### 4. Reglas de Seguridad Storage (`storage.rules`)
- Sólo se puede escribir bajo `uploads/`. El resto del bucket está cerrado.
- Subida y lectura: roles `admin` y `manager`. **Borrado: sólo `admin`** (los PDFs son evidencia fiscal).
- Sólo se aceptan `application/pdf`, `application/xml` y `text/xml`.
- **Límite de tamaño: 5 MB por archivo.** Es el tamaño real que alcanza a procesar la IA, porque el PDF viaja a Gemini codificado en base64 dentro del prompt. El mismo número está en tres lugares y los tres deben moverse juntos si se cambia: `MAX_UPLOAD_MB` en `functions/src/index.ts`, `MAX_MB` en `src/pages/Upload.tsx` y la regla de `storage.rules`. Cualquier archivo que supere el límite queda registrado en `manual_review` con el motivo escrito, visible en la interfaz.

### 5. Saneamiento Server-Side (`sanitizePurchaseOrder`)
- Cloud Function que recalcula los valores financieros (`saleTotal`, `costTotal`, `commission`, `netCashFlow`) a partir del snapshot histórico del expediente, para que importes alterados desde las herramientas del navegador no queden persistidos.
- **Respeta dos cosas que sí son datos legítimos y no manipulación:**
  1. Los costos y comisiones propios del expediente (`customCostPrice`, `customCommissionRate`, función *Costos variables*). Entran en la fórmula de referencia en vez de ser revertidos.
  2. El total de una factura timbrada. Si la factura trae UUID, su `invoiceTotal` viene del CFDI y **no se recalcula**: ese importe es un hecho fiscal, no un resultado de la fórmula.
- Sale temprano si el arreglo `invoices` no cambió, para no dispararse en cascada sobre sus propias escrituras ni sobre los lotes nocturnos de `checkOverdueInvoices`.

### 6. Cierres de seguridad aplicados (auditoría v8.9.2, 20 Agosto 2026)
Encontrados y corregidos en una revisión exhaustiva del sistema completo (ver `CHANGELOG.md` v8.9.2 para el detalle técnico):
- **`isBootstrapOwner()` ya no acepta cualquier correo del dominio corporativo.** Antes cualquier cuenta `@cobertores.com` verificada era super-admin automático e irrevocable (el botón "Revocar Acceso" no podía quitarlo). Ahora solo las 2 cuentas personales del dueño califican; cualquier otra cuenta se da de alta normal desde Usuarios y sí es revocable.
- **PIN del Portal Maquilador con límite de intentos.** `validarPinMaquila()` (`functions/src/index.ts`) bloquea 15 minutos tras 5 intentos fallidos seguidos, usando una transacción de Firestore para que dos intentos simultáneos no se salten el contador. Ya no existe un PIN de respaldo (`'2468'`) si la configuración no existe — la función falla cerrada en ese caso.
- **Cerradas dos reglas de Firestore (`expenses`, `error_logs`) que aceptaban cualquier sesión, incluida una anónima creada desde la consola del navegador** con la configuración pública de Firebase (no es secreta, viaja en el propio sitio). Mismo patrón ya cerrado antes para `maquilaDeliveries` (v8.8.9) y `registrarEntregaMaquila`.
- **El lector de documentos con IA (`parseDocumentData`, Gemini) ahora exige correo verificado y rol `admin`/`manager`**, no solo una sesión cualquiera — mismo criterio que `reprocessOrder`.
- **Nota de proceso:** ninguno de estos 4 huecos requería credenciales robadas para explotarse — bastaba con conocer la configuración pública de Firebase (que viaja en el propio sitio) y usar `signInAnonymously()` desde la consola del navegador. Por eso se tratan como hallazgos de auditoría normales y no como incidente de seguridad con exposición de datos confirmada.
