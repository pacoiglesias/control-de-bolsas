import { addDoc, collection, serverTimestamp, updateDoc, type DocumentReference } from 'firebase/firestore';
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

    await addDoc(collection(db, 'error_logs'), {
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
    await addDoc(collection(db, 'system_logs'), {
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
  await updateDoc(docRef, {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: userEmail
  });
}
