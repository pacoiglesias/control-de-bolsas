/**
 * documentStorage.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Capa de persistencia para documentos originales (PDFs, XMLs, imágenes).
 *
 * Estrategia:
 *  - Los archivos binarios se guardan en Firebase Storage bajo la ruta
 *    "documentos/{tipo}/{año-mes}/{fileName}".
 *  - Sus metadatos (folio, tipo, OC asociada, URL de descarga, etc.) se
 *    guardan en la colección Firestore "storedDocuments" para poder listarlos,
 *    buscarlos y borrarlos sin tener que listar Storage directamente.
 *
 * Tipos de documento soportados (StoredDocKind):
 *   oc_providencia | pago_providencia | factura_cfdi | ticket_bascula |
 *   contrarecibo | remision | desconocido
 */

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { storage, db } from './firebase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type StoredDocKind =
  | 'oc_providencia'
  | 'pago_providencia'
  | 'factura_cfdi'
  | 'ticket_bascula'
  | 'contrarecibo'
  | 'remision'
  | 'desconocido';

export interface StoredDocument {
  /** ID del documento Firestore */
  id: string;
  /** Nombre original del archivo (ej. "OC-12026439806.pdf") */
  fileName: string;
  /** Ruta en Firebase Storage (ej. "documentos/oc_providencia/2026-10/...") */
  storagePath: string;
  /** URL pública de descarga (con token de Firebase Storage) */
  downloadUrl: string;
  /** Tipo de documento detectado */
  docKind: StoredDocKind;
  /** Folio extraído (nro. de factura, nro. OC corto, nro. transferencia, etc.) */
  folio: string;
  /** Número de OC de Providencia (largo: 12026XXXXXX) */
  ocNumber?: string;
  /** ID de la Orden de Compra en Firestore con la que se asoció */
  orderId?: string;
  /** Folio/etiqueta de la orden (para mostrar en UI sin query adicional) */
  orderFolio?: string;
  /** Kilos extraídos del documento (0 para pagos) */
  kilos: number;
  /** Importe total extraído */
  total: number;
  /** Fecha del documento (ISO string YYYY-MM-DD) */
  docDate: string;
  /** Notas adicionales (ej. resultado del OCR) */
  notes?: string;
  /** Cuándo se subió al sistema */
  uploadedAt: Timestamp;
  /** Tamaño del archivo en bytes */
  sizeBytes: number;
  /** MIME type del archivo */
  mimeType: string;
}

// Colección en Firestore
const DOCS_COLLECTION = 'storedDocuments';

// ─── Subir documento ──────────────────────────────────────────────────────────

export interface UploadDocumentOptions {
  file: File;
  docKind: StoredDocKind;
  folio: string;
  ocNumber?: string;
  orderId?: string;
  orderFolio?: string;
  kilos: number;
  total: number;
  docDate: string;
  notes?: string;
}

/**
 * Sube el archivo a Firebase Storage y guarda sus metadatos en Firestore.
 * Retorna el StoredDocument creado (con su id de Firestore).
 */
export async function uploadDocument(opts: UploadDocumentOptions): Promise<StoredDocument> {
  const {
    file, docKind, folio, ocNumber, orderId, orderFolio,
    kilos, total, docDate, notes,
  } = opts;

  // Ruta organizada por tipo y mes
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `documentos/${docKind}/${monthStr}/${Date.now()}_${safeFileName}`;

  // 1. Subir binario a Storage
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/pdf',
    customMetadata: {
      docKind,
      folio,
      orderId: orderId || '',
      uploadedBy: 'sistema',
    },
  });

  // 2. Obtener URL de descarga
  const downloadUrl = await getDownloadURL(storageRef);

  // 3. Guardar metadatos en Firestore
  const meta: Omit<StoredDocument, 'id'> = {
    fileName: file.name,
    storagePath,
    downloadUrl,
    docKind,
    folio,
    ocNumber: ocNumber || '',
    orderId: orderId || '',
    orderFolio: orderFolio || '',
    kilos,
    total,
    docDate,
    notes: notes || '',
    uploadedAt: Timestamp.now(),
    sizeBytes: file.size,
    mimeType: file.type || 'application/pdf',
  };

  const docRef = await addDoc(collection(db, DOCS_COLLECTION), meta);

  return { id: docRef.id, ...meta };
}

// ─── Listar documentos ────────────────────────────────────────────────────────

export interface ListDocumentsFilter {
  docKind?: StoredDocKind;
  orderId?: string;
}

/**
 * Retorna todos los documentos almacenados, opcionalmente filtrados por tipo u OC.
 * Se ordenan del más reciente al más antiguo.
 */
export async function listStoredDocuments(filter?: ListDocumentsFilter): Promise<StoredDocument[]> {
  let q = query(
    collection(db, DOCS_COLLECTION),
    orderBy('uploadedAt', 'desc'),
  );

  if (filter?.docKind) {
    q = query(
      collection(db, DOCS_COLLECTION),
      where('docKind', '==', filter.docKind),
      orderBy('uploadedAt', 'desc'),
    );
  } else if (filter?.orderId) {
    q = query(
      collection(db, DOCS_COLLECTION),
      where('orderId', '==', filter.orderId),
      orderBy('uploadedAt', 'desc'),
    );
  }

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StoredDocument));
}

// ─── Actualizar notas / folio ─────────────────────────────────────────────────

export async function updateStoredDocument(
  docId: string,
  updates: Partial<Pick<StoredDocument, 'folio' | 'notes' | 'orderId' | 'orderFolio' | 'kilos' | 'total' | 'docDate'>>,
): Promise<void> {
  await updateDoc(doc(db, DOCS_COLLECTION, docId), updates);
}

// ─── Eliminar documento ───────────────────────────────────────────────────────

/**
 * Elimina el archivo de Firebase Storage y el registro de Firestore.
 */
export async function deleteStoredDocument(storedDoc: StoredDocument): Promise<void> {
  // 1. Eliminar del Storage (si falla, igual borramos Firestore para no dejar registros huerfanos)
  try {
    const storageRef = ref(storage, storedDoc.storagePath);
    await deleteObject(storageRef);
  } catch (err) {
    console.warn('No se pudo eliminar el archivo de Storage (puede que ya no exista):', err);
  }

  // 2. Eliminar metadata de Firestore
  await deleteDoc(doc(db, DOCS_COLLECTION, storedDoc.id));
}

// ─── Helper: tamaño legible ───────────────────────────────────────────────────

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Helper: icono por tipo ───────────────────────────────────────────────────

export function docKindIcon(kind: StoredDocKind): string {
  switch (kind) {
    case 'oc_providencia': return '📋';
    case 'pago_providencia': return '💵';
    case 'factura_cfdi': return '🧾';
    case 'ticket_bascula': return '⚖️';
    case 'contrarecibo': return '📑';
    case 'remision': return '🚚';
    default: return '📄';
  }
}

export function docKindLabel(kind: StoredDocKind): string {
  switch (kind) {
    case 'oc_providencia': return 'Orden de Compra';
    case 'pago_providencia': return 'Comprobante de Pago';
    case 'factura_cfdi': return 'Factura CFDI';
    case 'ticket_bascula': return 'Ticket de Bascula';
    case 'contrarecibo': return 'Contrarecibo';
    case 'remision': return 'Remision';
    default: return 'Documento';
  }
}
