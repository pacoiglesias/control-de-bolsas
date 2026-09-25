// src/lib/cleanUndefined.ts
/**
 * Recursively traverses an object and replaces any undefined values with null.
 * This is required because Firestore does not accept undefined fields.
 * The function returns a new object and does not mutate the original.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === undefined) {
    // @ts-ignore - we replace undefined with null
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj as any)) {
    if (value === undefined) {
      result[key] = null; // Firestore accepts null
    } else {
      result[key] = cleanUndefined(value);
    }
  }
  return result as T;
}
