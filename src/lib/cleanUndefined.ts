// src/lib/cleanUndefined.ts
/**
 * Recursively traverses an object and replaces any undefined values with null.
 * Preserves Date, Firestore Timestamp, and FieldValue instances.
 * This is required because Firestore does not accept undefined fields.
 */
export function cleanUndefined<T>(obj: T): T {
  if (obj === undefined) {
    return null as any;
  }
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  // Preserve Date, Firestore Timestamps and FieldValues without modification
  if (
    obj instanceof Date ||
    typeof (obj as any).toMillis === 'function' ||
    typeof (obj as any).isEqual === 'function' ||
    (obj as any)._methodName ||
    (obj as any).constructor?.name === 'FieldValue' ||
    (obj as any).constructor?.name === 'Timestamp'
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => cleanUndefined(item)) as any;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj as any)) {
    if (value === undefined) {
      result[key] = null;
    } else {
      result[key] = cleanUndefined(value);
    }
  }
  return result as T;
}
