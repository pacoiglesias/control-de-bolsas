import { describe, it, expect } from 'vitest';
import { autoHealAndPurgeErpDatabase } from '../autoHealEngine';

describe('autoHealEngine', () => {
  it('exporta correctamente la función principal autoHealAndPurgeErpDatabase', () => {
    expect(typeof autoHealAndPurgeErpDatabase).toBe('function');
  });
});
