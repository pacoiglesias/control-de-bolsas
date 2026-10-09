import { describe, it, expect, vi, beforeEach } from 'vitest';
import { autoHealAndPurgeErpDatabase, OFFICIAL_ACTIVE_CRS } from '../autoHealEngine';
import * as firestore from 'firebase/firestore';

vi.mock('firebase/firestore', async () => {
  const actual: any = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    collection: vi.fn(() => ({})),
    doc: vi.fn((_db, _path, id) => ({ id })),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    writeBatch: vi.fn(),
    serverTimestamp: vi.fn(() => ({ type: 'serverTimestamp' })),
  };
});

describe('autoHealEngine Extended Unit Tests', () => {
  let batchSetMock: any;
  let batchDeleteMock: any;
  let batchCommitMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    batchSetMock = vi.fn();
    batchDeleteMock = vi.fn();
    batchCommitMock = vi.fn().mockResolvedValue(undefined);

    (firestore.writeBatch as any).mockReturnValue({
      set: batchSetMock,
      delete: batchDeleteMock,
      commit: batchCommitMock,
    });
  });

  it('purges seed/test documents without touching valid production OCs', async () => {
    const mockDocs = [
      {
        id: 'SEED-123',
        data: () => ({ oc: 'SEED-123', folio: 'SEED-123', status: 'borrador' }),
      },
      {
        id: 'real-order-1',
        data: () => ({ oc: '12026439784', folio: '43/9784', status: 'pedido' }),
      },
      {
        id: 'DUMMY-999',
        data: () => ({ oc: 'DUMMY-999', status: 'archivado' }),
      },
    ];

    (firestore.getDocs as any).mockResolvedValue({ docs: mockDocs });

    const result = await autoHealAndPurgeErpDatabase();

    expect(result.purgedCount).toBe(2);
    expect(result.healedCount).toBe(0);
    expect(batchDeleteMock).toHaveBeenCalledTimes(2);
    expect(batchCommitMock).toHaveBeenCalled();
    expect(result.message).toContain('No se modificó ningún contrarecibo');
  });

  it('re-seeds historical CRs only when explicitly requested and never revives deleted ones', async () => {
    (firestore.getDocs as any).mockResolvedValue({ docs: [] });

    // Mock getDoc: first CR was marked isDeleted by user, second is not
    (firestore.getDoc as any).mockImplementation((docRef: any) => {
      if (docRef.id.includes('gt651')) {
        return Promise.resolve({
          exists: () => true,
          data: () => ({ isDeleted: true }),
        });
      }
      return Promise.resolve({
        exists: () => false,
        data: () => ({}),
      });
    });

    const result = await autoHealAndPurgeErpDatabase({ reseedHistoricalCrs: true });

    expect(result.purgedCount).toBe(0);
    // 1 CR skipped because isDeleted: true
    expect(result.healedCount).toBe(OFFICIAL_ACTIVE_CRS.length - 1);
    expect(batchSetMock).toHaveBeenCalledTimes(OFFICIAL_ACTIVE_CRS.length - 1);
    expect(batchCommitMock).toHaveBeenCalled();
    expect(result.message).toContain('Se restauraron');
  });
});
