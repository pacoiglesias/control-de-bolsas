export interface SystemRelease {
  version: string;
  date: string;
  time: string;
  summary: string;
  highlights: string[];
}

export const LATEST_RELEASE: SystemRelease = {
  version: 'v9.16.4: Diagnóstico local de la app — registro técnico para revisar fallos',
  date: '29 de Octubre de 2026',
  time: '14:05',
  summary: 'Registro de diagnóstico local reutilizando el patrón de Alacena 3.9.5: los últimos 200 eventos técnicos quedan guardados en el dispositivo y se consultan desde Configuración → Auditoría & Respaldo → Diagnóstico de la app, con Copiar, Limpiar y Actualizar. Si un guardado, la sesión o la conexión fallan, el fallo queda visible aunque Firestore falle, sin exponer ningún dato del negocio.',
  highlights: [
    'Vista "Diagnóstico de la app" en Configuración → Auditoría & Respaldo, con botones Copiar, Limpiar y Actualizar (mismo patrón que Alacena).',
    'Eventos registrados: errores de guardado en Firestore (operación y código, sin rutas ni datos), cambios de sesión y expiración, errores de inicio de sesión, errores de la app y de promesas no controladas, y cambios de conexión.',
    'Privacidad blindada: el registro nunca guarda nombres de clientes, importes, kilos, precios, folios, órdenes, documentos, RFC, correos ni teléfonos; el sanitizador borra esas claves aunque un llamador las pase por error.',
    'Complementa al registro en Firestore existente: el local sobrevive cuando lo que falla es precisamente Firestore, la autenticación o la conexión.',
  ],
};

