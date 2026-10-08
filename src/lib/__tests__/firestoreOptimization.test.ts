import { describe, it, expect } from 'vitest';
import indexesConfig from '../../../firestore.indexes.json';
import type { PurchaseOrder } from '../types';

describe('Fase 2: Optimización de Índices de Firestore & Estructura de Consultas', () => {
  it('valida que firestore.indexes.json contenga índices compuestos para todas las colecciones críticas', () => {
    expect(indexesConfig).toBeDefined();
    expect(Array.isArray(indexesConfig.indexes)).toBe(true);

    const collectionGroups = indexesConfig.indexes.map((idx: any) => idx.collectionGroup);
    
    // purchaseOrders
    expect(collectionGroups).toContain('purchaseOrders');
    // stored_documents
    expect(collectionGroups).toContain('stored_documents');
    // history
    expect(collectionGroups).toContain('history');
    // notifications
    expect(collectionGroups).toContain('notifications');
    // maquilaDeliveries
    expect(collectionGroups).toContain('maquilaDeliveries');
    // expenses
    expect(collectionGroups).toContain('expenses');
    // system_logs
    expect(collectionGroups).toContain('system_logs');
  });

  it('verifica que history tenga índice compuesto para userId + type + lastUsed', () => {
    const historyIndex = indexesConfig.indexes.find(
      (idx: any) =>
        idx.collectionGroup === 'history' &&
        idx.fields.some((f: any) => f.fieldPath === 'type') &&
        idx.fields.some((f: any) => f.fieldPath === 'lastUsed')
    );

    expect(historyIndex).toBeDefined();
    expect(historyIndex!.fields).toHaveLength(3);
    expect(historyIndex!.fields[0].fieldPath).toBe('userId');
    expect(historyIndex!.fields[1].fieldPath).toBe('type');
    expect(historyIndex!.fields[2].fieldPath).toBe('lastUsed');
  });

  it('verifica que stored_documents tenga índices por docKind y por orderId', () => {
    const docKindIndex = indexesConfig.indexes.find(
      (idx: any) =>
        idx.collectionGroup === 'stored_documents' &&
        idx.fields.some((f: any) => f.fieldPath === 'docKind')
    );
    const orderIdIndex = indexesConfig.indexes.find(
      (idx: any) =>
        idx.collectionGroup === 'stored_documents' &&
        idx.fields.some((f: any) => f.fieldPath === 'orderId')
    );

    expect(docKindIndex).toBeDefined();
    expect(orderIdIndex).toBeDefined();
  });

  it('verifica que purchaseOrders tenga índices para estados de ciclo, eliminación lógica y cierre', () => {
    const deletedIndex = indexesConfig.indexes.find(
      (idx: any) =>
        idx.collectionGroup === 'purchaseOrders' &&
        idx.fields.some((f: any) => f.fieldPath === 'isDeleted')
    );
    const closedIndex = indexesConfig.indexes.find(
      (idx: any) =>
        idx.collectionGroup === 'purchaseOrders' &&
        idx.fields.some((f: any) => f.fieldPath === 'isClosedShort')
    );

    expect(deletedIndex).toBeDefined();
    expect(closedIndex).toBeDefined();
  });
});

describe('Fase 2: Segregación Inteligente de Órdenes Activas vs Cerradas (Memoria & CPU)', () => {
  const sampleOrders: PurchaseOrder[] = [
    {
      id: 'oc-1',
      oc: '12026439784',
      isClosedShort: false,
      creditCycle: { status: 'pedido' },
      totalKilograms: 5100,
    } as PurchaseOrder,
    {
      id: 'oc-2',
      oc: '120267114302',
      isClosedShort: false,
      creditCycle: { status: 'facturado' },
      totalKilograms: 8000,
    } as PurchaseOrder,
    {
      id: 'oc-3',
      oc: '120260000001',
      isClosedShort: true, // Cierre corto (concluida)
      creditCycle: { status: 'facturado' },
      totalKilograms: 3000,
    } as PurchaseOrder,
    {
      id: 'oc-4',
      oc: '120260000002',
      isClosedShort: false,
      creditCycle: { status: 'completed' }, // Finiquitada
      totalKilograms: 2000,
    } as PurchaseOrder,
  ];

  it('clasifica correctamente órdenes activas (no cerradas y no completed)', () => {
    const active = sampleOrders.filter((o) => !o.isClosedShort && o.creditCycle?.status !== 'completed');
    expect(active).toHaveLength(2);
    expect(active.map((o) => o.id)).toEqual(['oc-1', 'oc-2']);
  });

  it('clasifica correctamente órdenes cerradas / históricas (isClosedShort o status completed)', () => {
    const closed = sampleOrders.filter((o) => o.isClosedShort || o.creditCycle?.status === 'completed');
    expect(closed).toHaveLength(2);
    expect(closed.map((o) => o.id)).toEqual(['oc-3', 'oc-4']);
  });
});
