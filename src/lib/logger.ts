import { collection, serverTimestamp, type DocumentReference } from 'firebase/firestore';
import { safeUpdateDoc, safeAddDoc } from './safeFirestore';
import { db } from './firebase';

export async function logError(error: unknown, context?: Record<string, unknown>) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? (error.stack || null) : null;
    
    let safeContext: Record<string, unknown> | null = null;
    if (context && typeof context === 'object') {
      try {
        safeContext = JSON.parse(JSON.stringify(context));
      } catch {
        safeContext = { unformatted: String(context) };
      }
    }

    await safeAddDoc(collection(db, 'error_logs'), {
      message,
      stack,
      context: safeContext,
      appVersion: '8.9.13',
      url: typeof window !== 'undefined' ? window.location.href : null,
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('No se pudo guardar el log de error en Firestore:', err);
  }
}

export async function logAction(userEmail: string | undefined | null, action: string, details: any) {
  try {
    if (!userEmail) return;
    // Se normaliza para que coincida EXACTAMENTE con request.auth.token.email:
    // firestore.rules compara ambos con .lower() y una mayuscula de mas basta
    // para que la escritura de bitacora sea rechazada. Como el catch de abajo
    // se traga el error, el fallo seria invisible.
    await safeAddDoc(collection(db, 'system_logs'), {
      user: userEmail.toLowerCase().trim(),
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}

/**
 * Registra una acción de auditoría obligatoria. Si el usuario no está autenticado
 * o la escritura a la bitácora falla, arroja un error para abortar la operación sin dejarla sin trazabilidad.
 */
export async function logMandatoryAction(userEmail: string | undefined | null, action: string, details: any): Promise<void> {
  if (!userEmail || !userEmail.trim()) {
    throw new Error('No se puede completar la operación de auditoría obligatoria: falta identidad de usuario autenticado.');
  }
  const normalizedEmail = userEmail.toLowerCase().trim();
  try {
    await safeAddDoc(collection(db, 'system_logs'), {
      user: normalizedEmail,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err: any) {
    console.error('Error crítico al escribir bitácora obligatoria:', err);
    throw new Error(`Fallo crítico de auditoría obligatoria: ${err?.message || err}. Operación abortada.`);
  }
}

/**
 * Auditoría de Borrados (Soft Deletes / Papelera).
 * Registra el objeto completo en la bitácora y lo marca como eliminado (isDeleted).
 */
export async function safeDeleteDoc(userEmail: string | undefined | null, docRef: DocumentReference, originalData: any) {
  if (!userEmail) throw new Error("No user email provided for deletion audit");
  
  // 1. Respaldar en la bitácora
  await logAction(userEmail, 'SOFT_DELETE_RECORD', {
    collection: docRef.parent.id,
    docId: docRef.id,
    data: originalData
  });

  // 2. Ejecutar el soft delete
  await safeUpdateDoc(docRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userEmail
  });
}
