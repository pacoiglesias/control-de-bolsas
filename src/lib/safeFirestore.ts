// src/lib/safeFirestore.ts
/**
 * Wrapper utilities for Firestore writes that automatically sanitize undefined values.
 * Uses the cleanUndefined utility to replace undefined with null before sending to Firestore.
 */
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { cleanUndefined } from './cleanUndefined';

/**
 * Safe setDoc that sanitizes the data object.
 */
export async function safeSetDoc<T>(path: string, data: T, options?: { merge?: boolean }): Promise<void> {
  const docRef = doc(db, ...path.split('/'));
  const sanitized = cleanUndefined(data);
  await setDoc(docRef, sanitized, options ?? {});
}

/**
 * Safe updateDoc that sanitizes the data object.
 */
export async function safeUpdateDoc<T>(path: string, data: Partial<T>): Promise<void> {
  const docRef = doc(db, ...path.split('/'));
  const sanitized = cleanUndefined(data);
  await updateDoc(docRef, sanitized as any);
}
