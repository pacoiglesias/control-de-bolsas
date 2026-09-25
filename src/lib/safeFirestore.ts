// src/lib/safeFirestore.ts
/**
 * Wrapper utilities for Firestore writes that automatically sanitize undefined values.
 * Uses cleanUndefined to replace undefined fields with null before sending to Firestore.
 */
import {
  doc,
  setDoc,
  updateDoc,
  type DocumentReference,
  type SetOptions,
} from 'firebase/firestore';
import { db } from './firebase';
import { cleanUndefined } from './cleanUndefined';

/**
 * Safe setDoc that accepts either a DocumentReference or path string,
 * sanitizing undefined fields to null recursively.
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
  return setDoc(ref, sanitized as any, options ?? {});
}

/**
 * Safe updateDoc that accepts either a DocumentReference or path string,
 * sanitizing undefined fields to null recursively.
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
  return updateDoc(ref, sanitized as any);
}
