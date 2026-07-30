import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

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
