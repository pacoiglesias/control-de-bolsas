// Diagnóstico local de la app — módulo pequeño y reutilizable.
//
// Propósito: que una revisión posterior (humana o automática) pueda ver
// QUÉ pasó en el dispositivo del usuario sin estar delante de su pantalla:
// errores de guardado en Firestore, cambios de sesión, expiración,
// errores de sincronización y errores generales de la app, con su código
// o mensaje técnico. Nació en Alacena 3.9.5 (scannerDiag.js), cuando el
// escáner llevaba cuatro versiones en negro en el iPhone real mientras
// en las pruebas con cámara simulada todo salía en verde: sin registro,
// el fallo era invisible desde fuera. Este módulo es la adaptación de
// ese mismo patrón a Control de Bolsas.
//
// Diferencia con src/lib/logger.ts: ese logger escribe en Firestore
// (colecciones error_logs / system_logs), así que si lo que falla es
// precisamente Firestore, la autenticación o la conexión, el registro
// mismo falla en silencio. Este diagnóstico vive en localStorage del
// dispositivo y se puede abrir y copiar desde la propia app
// (Configuración → Auditoría & Respaldo → Diagnóstico de la app), sin
// depender de la nube.
//
// PRIVACIDAD — regla dura: aquí solo entran eventos técnicos. NUNCA se
// registran nombres de clientes, importes, kilos, precios, folios,
// órdenes, documentos, RFC, correos, teléfonos ni ningún otro dato del
// negocio. Los puntos de instrumentación solo pasan el tipo de evento
// y el código de error de Firebase (p. ej. "permission-denied"), nunca
// rutas de documentos ni contenidos. Como red de seguridad,
// sanitizeDetails() borra cualquier clave sospechosa aunque algún
// llamador la pase por error, y recorta los textos a 200 caracteres.
//
// Almacenamiento: localStorage, últimos 200 eventos (se descartan los
// más viejos). Si no hay almacenamiento disponible, no rompe nada: los
// eventos solo viven en memoria de la sesión.
import { LATEST_RELEASE } from './latestRelease';

export const APP_DIAG_KEY = 'bolsas:app_diag';
export const APP_DIAG_MAX_EVENTS = 200;

// Versión visible de la app (de la fuente única: latestRelease.ts).
const VERSION_MATCH = /v\d+\.\d+\.\d+/.exec(LATEST_RELEASE.version);
export const APP_VERSION = VERSION_MATCH ? VERSION_MATCH[0] : 'desconocida';

// Claves que nunca deben quedar en el registro, ni por error de un llamador.
// Incluye datos del negocio (cliente, importes, kilos, folios, documentos)
// e identidad (correo, uid, token, contraseña).
const FORBIDDEN_KEYS = new Set([
  'cliente', 'client', 'customer', 'proveedor', 'supplier', 'andres',
  'nombre', 'name', 'razon', 'rfc', 'email', 'correo', 'telefono', 'phone',
  'direccion', 'address', 'uid', 'user', 'usuario',
  'importe', 'amount', 'total', 'kilos', 'kg', 'precio', 'price', 'costo',
  'cost', 'subtotal', 'iva', 'saldo', 'balance', 'deuda', 'pago', 'payment',
  'documento', 'document', 'folio', 'oc', 'orden', 'order', 'remision',
  'factura', 'invoice', 'uuid', 'cfdi', 'contrarecibo', 'producto',
  'product', 'partida', 'concepto', 'concept', 'descripcion', 'description',
  'code', 'barcode', 'qr', 'text', 'value', 'items', 'list', 'photo',
  'image', 'dataurl', 'data_url', 'src', 'password', 'token', 'stack',
  'componentstack', 'component_stack',
]);

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [key: string]: JsonValue };

function sanitizeValue(value: unknown, depth = 0): JsonValue {
  if (typeof value === 'string') return value.slice(0, 200);
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    return depth > 2 ? '[...]' : value.slice(0, 20).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(String(k).toLowerCase())) continue;
      out[String(k).slice(0, 40)] = sanitizeValue(v, depth + 1);
    }
    return out;
  }
  return String(value).slice(0, 200);
}

export function sanitizeDiagDetails(details: Record<string, unknown> = {}): {
  [key: string]: JsonValue;
} {
  if (!details || typeof details !== 'object') return {};
  const cleaned = sanitizeValue(details);
  return typeof cleaned === 'object' && cleaned !== null && !Array.isArray(cleaned)
    ? (cleaned as { [key: string]: JsonValue })
    : {};
}

export interface DiagEvent {
  t: string;
  v: string;
  ev: string;
  d: { [key: string]: JsonValue };
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function readStored(key: string): DiagEvent[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DiagEvent[]) : [];
  } catch {
    return [];
  }
}

function writeStored(key: string, events: DiagEvent[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(events));
  } catch {
    // Sin almacenamiento: el registro solo vive en memoria esta sesión.
  }
}

// Fábrica para poder reutilizarlo en otras apps con otra clave.
export function createAppDiag(storageKey: string = APP_DIAG_KEY) {
  let memoryFallback: DiagEvent[] = [];

  function log(event: string, details: Record<string, unknown> = {}): DiagEvent {
    const entry: DiagEvent = {
      t: new Date().toISOString(),
      v: APP_VERSION,
      ev: String(event).slice(0, 60),
      d: sanitizeDiagDetails(details),
    };
    // Sin almacenamiento, el evento iría a un arreglo local que nadie
    // vuelve a leer: va directo al respaldo en memoria. (Sin este
    // desvío, writeStored() no haría nada y el evento se perdería.)
    if (!getStorage()) {
      memoryFallback.push(entry);
      while (memoryFallback.length > APP_DIAG_MAX_EVENTS) memoryFallback.shift();
      return entry;
    }
    try {
      const events = readStored(storageKey);
      events.push(entry);
      while (events.length > APP_DIAG_MAX_EVENTS) events.shift();
      writeStored(storageKey, events);
    } catch {
      memoryFallback.push(entry);
      while (memoryFallback.length > APP_DIAG_MAX_EVENTS) memoryFallback.shift();
    }
    return entry;
  }

  function getEvents(): DiagEvent[] {
    try {
      const events = readStored(storageKey);
      if (events.length > 0) return events;
    } catch {
      // Cae al respaldo en memoria.
    }
    return [...memoryFallback];
  }

  function clear(): void {
    memoryFallback = [];
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.removeItem(storageKey);
    } catch {
      // Nada que limpiar.
    }
  }

  // Texto plano para Copiar y pasar a quien revisa el problema.
  function toText(): string {
    const events = getEvents();
    const lines = [
      `Control de Bolsas ${APP_VERSION} — diagnóstico de la app`,
      `Agente: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'desconocido'}`,
      `Eventos: ${events.length} (los más recientes al final)`,
      '',
    ];
    for (const e of events) {
      lines.push(`${e.t} [${e.ev}] ${JSON.stringify(e.d)}`);
    }
    return lines.join('\n');
  }

  return { log, getEvents, clear, toText };
}

// Instancia por defecto para Control de Bolsas.
const diag = createAppDiag();

export const diagLog = (event: string, details: Record<string, unknown> = {}): DiagEvent =>
  diag.log(event, details);
export const getDiagEvents = (): DiagEvent[] => diag.getEvents();
export const clearDiag = (): void => diag.clear();
export const diagText = (): string => diag.toText();

// Evento inicial de sesión: versión, navegador, contexto seguro y
// conexión. Sin identidad del usuario ni datos del negocio.
export function diagSessionStart(extra: Record<string, unknown> = {}): DiagEvent {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  return diag.log('session_start', {
    ua: (nav as Navigator).userAgent || 'desconocido',
    secure: typeof window !== 'undefined' ? window.isSecureContext : false,
    online: (nav as Navigator).onLine ?? 'desconocido',
    ...extra,
  });
}
