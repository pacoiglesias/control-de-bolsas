// src/lib/safeFirestore.ts
/**
 * Wrapper utilities for Firestore writes that automatically sanitize undefined values.
 * Uses cleanUndefined to recursively strip undefined fields before sending to Firestore.
 */
import {
  doc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  type DocumentReference,
  type CollectionReference,
  type SetOptions,
} from 'firebase/firestore';
import { db } from './firebase';
import { cleanUndefined } from './cleanUndefined';

/**
 * Safe setDoc that accepts either a DocumentReference or path string,
 * sanitizing undefined fields recursively.
 */
export async function safeSetDoc<T = any>(
  docRefOrPath: DocumentReference<any> | string,
  data: T,
  options?: SetOptions
): Promise<void> {
  const ref =
    typeof docRefOrPath === 'string'
      ? (doc(db, ...docRefOrPath.split('/') as [string, ...string[]]) as DocumentReference<any>)
      : docRefOrPath;
  const sanitized = cleanUndefined(data);
  return setDoc(ref, (sanitized || {}) as any, options ?? {});
}

/**
 * Safe updateDoc that accepts either a DocumentReference or path string,
 * sanitizing undefined fields recursively and falling back to setDoc merge if
 * the document does not exist yet.
 * If sanitized data is empty (no fields to update), returns gracefully.
 */
export async function safeUpdateDoc(
  docRefOrPath: DocumentReference<any> | string,
  data: any
): Promise<void> {
  const ref =
    typeof docRefOrPath === 'string'
      ? (doc(db, ...docRefOrPath.split('/') as [string, ...string[]]) as DocumentReference<any>)
      : docRefOrPath;
  const sanitized = cleanUndefined(data);
  if (!sanitized || (typeof sanitized === 'object' && Object.keys(sanitized).length === 0)) {
    return;
  }
  try {
    return await updateDoc(ref, sanitized as any);
  } catch (err: any) {
    if (err?.code === 'not-found' || (err?.message && err.message.includes('No document to update'))) {
      return await setDoc(ref, sanitized as any, { merge: true });
    }
    throw err;
  }
}

/**
 * Safe addDoc that accepts either a CollectionReference or path string,
 * sanitizing undefined fields recursively.
 */
export async function safeAddDoc<T = any>(
  colRefOrPath: CollectionReference<any> | string,
  data: T
): Promise<DocumentReference<T>> {
  const ref =
    typeof colRefOrPath === 'string'
      ? (collection(db, ...colRefOrPath.split('/') as [string, ...string[]]) as CollectionReference<any>)
      : colRefOrPath;
  const sanitized = cleanUndefined(data);
  return addDoc(ref, (sanitized || {}) as any) as Promise<DocumentReference<T>>;
}
