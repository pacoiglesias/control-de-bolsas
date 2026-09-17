import { describe, it, expect } from 'vitest';
import {
  normalizeFolio,
  findDuplicateContrarecibo,
  findDuplicateInvoiceFolio,
  findDuplicateOrderFolio,
  findDuplicateRemision,
  findDuplicateUuid,
  checkAllDuplicates,
} from '../duplicateGuards';
import type { PurchaseOrder } from '../types';

describe('Radar Antiduplicados (duplicateGuards)', () => {
  const mockOrders: PurchaseOrder[] = [
    {
      id: 'ord-1',
      folio: 'OC-1001',
      oc: '1001',
      client: 'GRUPO TEXTIL PROVIDENCIA',
      invoices: [
        {
          id: 'inv-1',
          folio: 'F-8890',
          uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          kilos: 1000,
          collection: {
            contrareciboNumber: 'CR-5544',
          },
        } as any,
      ],
      deliveries: [
        {
          id: 'del-1',
          docFolio: 'REM-777',
          kgNeto: 1000,
        } as any,
      ],
    } as any,
    {
      id: 'ord-2',
      folio: 'OC-2002',
      oc: '2002',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT)',
      invoices: [],
      deliveries: [],
    } as any,
  ];

  it('normaliza folios correctamente eliminando acentos y caracteres especiales', () => {
    expect(normalizeFolio(' O.C. - 1001 ')).toBe('oc1001');
    expect(normalizeFolio('CR 5544')).toBe('cr5544');
    expect(normalizeFolio(null)).toBe('');
  });

  it('detecta Folio de OC duplicado ignorando mayúsculas y espacios', () => {
    const match = findDuplicateOrderFolio(mockOrders, 'oc-1001');
    expect(match).not.toBeNull();
    expect(match?.orderFolio).toBe('OC-1001');
    expect(match?.type).toBe('oc');

    // Excluyendo la misma orden no debe alertar
    const matchExcluded = findDuplicateOrderFolio(mockOrders, 'OC-1001', 'ord-1');
    expect(matchExcluded).toBeNull();
  });

  it('detecta Folio de Factura duplicado', () => {
    const match = findDuplicateInvoiceFolio(mockOrders, 'F-8890');
    expect(match).not.toBeNull();
    expect(match?.invoiceFolio).toBe('F-8890');
    expect(match?.type).toBe('invoice');

    const notFound = findDuplicateInvoiceFolio(mockOrders, 'F-9999');
    expect(notFound).toBeNull();
  });

  it('detecta UUID SAT duplicado ignorando guiones y mayúsculas', () => {
    const match = findDuplicateUuid(mockOrders, 'A1B2C3D4E5F67890ABCDEF1234567890');
    expect(match).not.toBeNull();
    expect(match?.type).toBe('uuid');
    expect(match?.invoiceFolio).toBe('F-8890');

    const notFound = findDuplicateUuid(mockOrders, '99999999-9999-9999-9999-999999999999');
    expect(notFound).toBeNull();
  });

  it('detecta Contrarecibo y Remisión duplicados', () => {
    const matchCr = findDuplicateContrarecibo(mockOrders, 'cr-5544');
    expect(matchCr).not.toBeNull();
    expect(matchCr?.type).toBe('cr');

    const matchRem = findDuplicateRemision(mockOrders, 'rem-777');
    expect(matchRem).not.toBeNull();
    expect(matchRem?.type).toBe('remision');
  });

  it('checkAllDuplicates valida múltiples campos en una sola llamada', () => {
    const match1 = checkAllDuplicates(mockOrders, { oc: '1001' });
    expect(match1?.type).toBe('oc');

    const match2 = checkAllDuplicates(mockOrders, { invoiceFolio: 'F-8890' });
    expect(match2?.type).toBe('invoice');

    const match3 = checkAllDuplicates(mockOrders, { uuid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' });
    expect(match3?.type).toBe('uuid');

    const matchNone = checkAllDuplicates(mockOrders, { oc: 'OC-9999', invoiceFolio: 'F-0000' });
    expect(matchNone).toBeNull();
  });
});
