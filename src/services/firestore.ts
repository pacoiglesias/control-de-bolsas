/**
 * src/services/firestore.ts - Operaciones CRUD reutilizables para Cloud Firestore
 */
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  type QueryConstraint,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { db } from './firebase';

export async function getDocById<T = DocumentData>(collectionName: string, id: string): Promise<T | null> {
  const docRef = doc(db, collectionName, id);
  const snap = await getDoc(docRef);
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as T) : null;
}

export async function setDocData<T extends DocumentData>(collectionName: string, id: string, data: T, merge = true): Promise<void> {
  const docRef = doc(db, collectionName, id);
  await setDoc(docRef, data, { merge });
}

export async function updateDocData<T extends DocumentData>(collectionName: string, id: string, data: UpdateData<T>): Promise<void> {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, data);
}

export async function deleteDocById(collectionName: string, id: string): Promise<void> {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
}

export async function queryCollection<T = DocumentData>(collectionName: string, ...constraints: QueryConstraint[]): Promise<T[]> {
  const colRef = collection(db, collectionName);
  const q = query(colRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as T));
}
