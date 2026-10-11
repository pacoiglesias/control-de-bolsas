import { describe, expect, it } from 'vitest';
import { shouldQueueOfflineDeliveryError } from '../maquilaPortalErrors';

describe('shouldQueueOfflineDeliveryError', () => {
  it('queues when the device is offline', () => {
    expect(shouldQueueOfflineDeliveryError({ code: 'functions/invalid-argument' }, false)).toBe(true);
  });

  it.each(['unavailable', 'functions/unavailable', 'deadline-exceeded', 'functions/deadline-exceeded'])(
    'queues transient callable error %s',
    (code) => expect(shouldQueueOfflineDeliveryError({ code }, true)).toBe(true),
  );

  it.each(['functions/invalid-argument', 'functions/permission-denied', 'functions/failed-precondition']) (
    'does not queue business error %s',
    (code) => expect(shouldQueueOfflineDeliveryError({ code }, true)).toBe(false),
  );

  it('queues browser fetch/network failures but not arbitrary errors', () => {
    expect(shouldQueueOfflineDeliveryError(new TypeError('Failed to fetch'), true)).toBe(true);
    expect(shouldQueueOfflineDeliveryError(new Error('Invalid kilograms'), true)).toBe(false);
  });
});
