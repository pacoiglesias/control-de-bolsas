const TRANSIENT_CALLABLE_CODES = new Set([
  'unavailable',
  'functions/unavailable',
  'deadline-exceeded',
  'functions/deadline-exceeded',
  'cancelled',
  'functions/cancelled',
]);

/** Only queue a delivery when retrying later is appropriate. Validation,
 * permission, and business-rule failures must be shown to the operator. */
export function shouldQueueOfflineDeliveryError(
  error: unknown,
  isOnline: boolean,
): boolean {
  if (!isOnline) return true;

  const candidate = error as { code?: unknown; name?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code.toLowerCase() : '';
  if (TRANSIENT_CALLABLE_CODES.has(code)) return true;

  const message = typeof candidate?.message === 'string' ? candidate.message.toLowerCase() : '';
  const isFetchFailure = candidate?.name === 'TypeError' &&
    (message.includes('fetch') || message.includes('network'));
  return isFetchFailure;
}
