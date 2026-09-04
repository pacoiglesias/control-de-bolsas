/**
 * src/services/storage.ts - Operaciones de archivos en Firebase Cloud Storage
 */
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export async function uploadStorageFile(path: string, file: Blob | Uint8Array | ArrayBuffer): Promise<string> {
  const fileRef = ref(storage, path);
  const snap = await uploadBytes(fileRef, file);
  return await getDownloadURL(snap.ref);
}

export async function getStorageFileUrl(path: string): Promise<string> {
  const fileRef = ref(storage, path);
  return await getDownloadURL(fileRef);
}

export async function deleteStorageFile(path: string): Promise<void> {
  const fileRef = ref(storage, path);
  await deleteObject(fileRef);
}
