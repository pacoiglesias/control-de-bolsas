import { describe, expect, it } from 'vitest';
import { normalizeActiveMaquilaOrders } from '../../pages/MaquiladorPortal.shared';

describe('normalizeActiveMaquilaOrders', () => {
  it('supports the backend legacy orderId shape and supplies the UI id', () => {
    expect(normalizeActiveMaquilaOrders([{ orderId: 'oc-1', folio: '43/9784' }])).toEqual([
      { id: 'oc-1', orderId: 'oc-1', folio: '43/9784' },
    ]);
  });

  it('keeps the current id shape and normalizes its alias', () => {
    expect(normalizeActiveMaquilaOrders([{ id: 'oc-2', folio: '71/14302' }])).toEqual([
      { id: 'oc-2', orderId: 'oc-2', folio: '71/14302' },
    ]);
  });

  it('rejects malformed rows and non-array payloads', () => {
    expect(normalizeActiveMaquilaOrders([{ folio: 'missing id' }, null, 3])).toEqual([]);
    expect(normalizeActiveMaquilaOrders({ orders: [] })).toEqual([]);
  });
});
