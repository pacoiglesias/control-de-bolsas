import { describe, it, expect } from 'vitest';
import { sha256, generateAuditSeal, verifyAuditSeal } from '../cryptoAudit';

describe('Motor Criptográfico de Auditoría (SHA-256)', () => {
  it('genera un hash hexadecimal válido y determinista', async () => {
    const hash1 = await sha256('PAGO_ANDRES_100000');
    const hash2 = await sha256('PAGO_ANDRES_100000');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBeGreaterThanOrEqual(32);
  });

  it('crea un sello encadenado para un movimiento contable y lo verifica con éxito', async () => {
    const payload = {
      user: 'admin@sistema.com',
      action: 'Cobro de Contrarecibo TH-946',
      amount: 98054.19,
      folio: 'TH-946',
      timestamp: '2026-08-30T10:00:00Z',
    };

    const seal = await generateAuditSeal(payload);
    expect(seal.hash).toBeDefined();

    const isValid = await verifyAuditSeal(seal.payloadString, seal.hash);
    expect(isValid).toBe(true);

    const isTamperedValid = await verifyAuditSeal(seal.payloadString.replace('98054.19', '99054.19'), seal.hash);
    expect(isTamperedValid).toBe(false);
  });
});
