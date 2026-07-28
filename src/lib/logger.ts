import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function logAction(userEmail: string | undefined | null, action: string, details: any) {
  try {
    if (!userEmail) return;
    await addDoc(collection(db, 'system_logs'), {
      user: userEmail,
      action,
      details,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error('Failed to write log:', err);
  }
}
