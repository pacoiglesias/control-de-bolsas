import { describe, it, expect } from 'vitest';
import {
  findDuplicateContrarecibo,
  findDuplicateInvoiceFolio,
  findDuplicateOrderFolio,
  normalizeFolio,
} from '../duplicateGuards';
import type { PurchaseOrder } from '../types';

describe('duplicateGuards test suite', () => {
  const mockOrders: PurchaseOrder[] = [
    {
      id: 'ord_1',
      folio: 'OC-1001',
      client: 'Providencia',
      invoices: [
        {
          id: 'inv_1',
          folio: 'FACT-501',
          kilos: 500,
          collection: {
            contrareciboNumber: 'CR-9001',
          },
          creditCycle: {
            status: 'pending',
          },
        } as any,
      ],
    } as any,
    {
      id: 'ord_2',
      folio: 'OC-1002',
      client: 'San Marcos',
      invoices: [
        {
          id: 'inv_2',
          folio: 'FACT-502',
          kilos: 300,
          collection: {
            contrareciboNumber: 'CR-9002',
          },
          creditCycle: {
            status: 'pending',
          },
        } as any,
      ],
    } as any,
  ];

  it('normalizes alphanumeric strings properly', () => {
    expect(normalizeFolio(' CR - 9001 ')).toBe('cr9001');
    expect(normalizeFolio('OC/1001-A')).toBe('oc1001a');
    expect(normalizeFolio(null)).toBe('');
  });

  it('detects duplicate contrarecibos accurately', () => {
    const dup = findDuplicateContrarecibo(mockOrders, 'cr-9001');
    expect(dup).not.toBeNull();
    expect(dup?.orderFolio).toBe('OC-1001');
    expect(dup?.invoiceFolio).toBe('FACT-501');

    // Should ignore if same invoice ID is excluded (e.g. editing the same invoice)
    const selfCheck = findDuplicateContrarecibo(mockOrders, 'cr-9001', 'inv_1');
    expect(selfCheck).toBeNull();

    // Should return null for non-existing CR
    expect(findDuplicateContrarecibo(mockOrders, 'CR-9999')).toBeNull();
  });

  it('detects duplicate invoices accurately', () => {
    const dup = findDuplicateInvoiceFolio(mockOrders, 'fact-501');
    expect(dup).not.toBeNull();
    expect(dup?.orderFolio).toBe('OC-1001');

    // Should ignore when editing the same invoice
    expect(findDuplicateInvoiceFolio(mockOrders, 'fact-501', 'inv_1')).toBeNull();

    // Should return null for a unique invoice
    expect(findDuplicateInvoiceFolio(mockOrders, 'FACT-777')).toBeNull();
  });

  it('detects duplicate purchase order folios', () => {
    const dup = findDuplicateOrderFolio(mockOrders, 'OC-1001');
    expect(dup).not.toBeNull();
    expect(dup?.orderFolio).toBe('OC-1001');

    // Should ignore when editing the same order
    expect(findDuplicateOrderFolio(mockOrders, 'OC-1001', 'ord_1')).toBeNull();

    // Unique folio
    expect(findDuplicateOrderFolio(mockOrders, 'OC-9999')).toBeNull();
  });
});
