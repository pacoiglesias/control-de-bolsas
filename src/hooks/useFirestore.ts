/**
 * src/hooks/useFirestore.ts - Hook de acceso y mutaciones reactivas en Firestore
 */
import { useCallback } from 'react';
import type { DocumentData, UpdateData } from 'firebase/firestore';
import { getDocById, setDocData, updateDocData, deleteDocById } from '../services/firestore';

export function useFirestore<T extends DocumentData>(collectionName: string) {
  const get = useCallback((id: string) => getDocById<T>(collectionName, id), [collectionName]);
  const set = useCallback((id: string, data: T, merge = true) => setDocData(collectionName, id, data, merge), [collectionName]);
  const update = useCallback((id: string, data: UpdateData<T>) => updateDocData(collectionName, id, data), [collectionName]);
  const remove = useCallback((id: string) => deleteDocById(collectionName, id), [collectionName]);

  return { get, set, update, remove };
}
