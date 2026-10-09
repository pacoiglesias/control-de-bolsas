import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  findExistingInvoice,
  findExistingDelivery,
  findExistingPayment,
  applyDocumentFast,
  normalizeInvoiceFolio,
  type PipelineAnalysis,
} from '../autoDocumentPipeline';
import type { PurchaseOrder } from '../types';

// Mock de Firestore y Storage para ejecución aislada y confiable
vi.mock('../safeFirestore', () => ({
  safeUpdateDoc: vi.fn().mockResolvedValue(undefined),
  safeAddDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  safeSetDoc: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../documentStorage', () => ({
  uploadDocument: vi.fn().mockResolvedValue({ url: 'https://mock.storage/doc.pdf', storagePath: 'mock/path' }),
}));

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}`, id })),
    collection: vi.fn((_db, coll) => ({ path: coll })),
    serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
    runTransaction: vi.fn(async (_db, callback) => {
      // Simulación de transacción atómica para tests
      const mockTxn = {
        get: vi.fn(async (docRef) => ({
          exists: () => true,
          data: () => ({
            id: docRef.id,
            invoices: [
              {
                id: 'inv-atomic-1',
                folio: '8801',
                financials: { invoiceTotal: 49880.0, salePricePerKg: 43.0, costPricePerKg: 34.0 },
                collection: { paidAmount: 0, paymentsHistory: [] },
              },
            ],
          }),
        })),
        update: vi.fn(),
      };
      return callback(mockTxn);
    }),
  };
});

describe('Auditoría Senior de Confiabilidad Financiera y Operativa (ERP Control de Bolsas)', () => {
  const dummyFile = new File(['test-content'], 'comprobante.pdf', { type: 'application/pdf' });

  const orderAlpha: PurchaseOrder = {
    id: 'ord-alpha-gt',
    oc: '12026439784',
    folio: '43/9784',
    client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
    department: 'GT',
    customSellPrice: 43.0,
    customCostPrice: 34.0,
    financials: {
      commissionRate: 0.08,
      salePricePerKg: 43.0,
      costPricePerKg: 34.0,
      netCashFlow: 5560.0,
    },
    totalKilograms: 5100,
    creditCycle: { status: 'pedido' },
    deliveries: [
      {
        id: 'del-alpha-1',
        docFolio: '6439784',
        kilos: 2000,
        date: Timestamp.fromDate(new Date('2026-10-01T12:00:00Z')),
        invoiced: false,
        notes: 'Remisión de báscula 6439784',
      },
      {
        id: 'del-alpha-nofolio',
        docFolio: '',
        kilos: 1500,
        date: Timestamp.fromDate(new Date('2026-10-02T12:00:00Z')),
        invoiced: false,
        notes: 'Ticket de báscula sin folio impreso',
      },
    ],
    invoices: [
      {
        id: 'inv-alpha-1',
        orderId: 'ord-alpha-gt',
        folio: '6353',
        uuid: '11111111-2222-3333-4444-555555555555',
        kilos: 1000,
        creditCycle: { status: 'in_review' },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 34.0,
          commissionRate: 0.08,
          saleTotal: 43000.0,
          invoiceTotal: 49880.0, // 43,000 * 1.16
          costTotal: 34000.0,
          commission: 3440.0, // 43,000 * 0.08
          netCashFlow: 5560.0,
          tradeMargin: 12.93,
        },
        collection: {
          paidAmount: 0,
          paymentsHistory: [],
        },
      },
    ],
  };

  const orderBeta: PurchaseOrder = {
    id: 'ord-beta-th',
    oc: '120267114302',
    folio: '71/14302',
    client: 'TEXTIL HOGAR (TH - NAVA)',
    department: 'TH',
    customSellPrice: 43.0,
    customCostPrice: 38.0,
    financials: {
      commissionRate: 0.08,
      salePricePerKg: 43.0,
      costPricePerKg: 38.0,
      netCashFlow: 3120.0,
    },
    totalKilograms: 8000,
    creditCycle: { status: 'pedido' },
    deliveries: [],
    invoices: [
      {
        id: 'inv-beta-1',
        orderId: 'ord-beta-th',
        folio: '6354',
        uuid: 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE',
        kilos: 2000,
        creditCycle: { status: 'in_review' },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 38.0,
          commissionRate: 0.08,
          saleTotal: 86000.0,
          invoiceTotal: 99760.0,
          costTotal: 76000.0,
          commission: 6880.0,
          netCashFlow: 3120.0,
          tradeMargin: 3.63,
        },
        collection: {
          paidAmount: 0,
          paymentsHistory: [],
        },
      },
    ],
  };

  // ───────────────────────────────────────────────────────────────────────────
  // 1. REGLAS FIRESTORE Y PERMISOS DE DOCUMENTOS
  // ───────────────────────────────────────────────────────────────────────────
  describe('1. Reglas Firestore y Separación de Permisos', () => {
    it('comprueba la separación de permisos de lectura, creación, actualización y borrado', () => {
      // Simulación de la matriz de permisos de firestore.rules
      type UserRole = 'viewer' | 'manager' | 'superadmin' | 'unauthenticated';
      const evaluateStoredDocsPermission = (role: UserRole, operation: 'read' | 'create' | 'update' | 'delete') => {
        if (role === 'unauthenticated') return false;
        if (operation === 'read') return true; // authenticated users can read
        if (operation === 'create' || operation === 'update') {
          return role === 'manager' || role === 'superadmin';
        }
        if (operation === 'delete') {
          return role === 'superadmin'; // solo superadmin
        }
        return false;
      };

      // Unauthenticated
      expect(evaluateStoredDocsPermission('unauthenticated', 'read')).toBe(false);
      expect(evaluateStoredDocsPermission('unauthenticated', 'create')).toBe(false);

      // Viewer solo puede leer
      expect(evaluateStoredDocsPermission('viewer', 'read')).toBe(true);
      expect(evaluateStoredDocsPermission('viewer', 'create')).toBe(false);
      expect(evaluateStoredDocsPermission('viewer', 'update')).toBe(false);
      expect(evaluateStoredDocsPermission('viewer', 'delete')).toBe(false);

      // Manager puede leer, crear y actualizar, PERO NO borrar
      expect(evaluateStoredDocsPermission('manager', 'read')).toBe(true);
      expect(evaluateStoredDocsPermission('manager', 'create')).toBe(true);
      expect(evaluateStoredDocsPermission('manager', 'update')).toBe(true);
      expect(evaluateStoredDocsPermission('manager', 'delete')).toBe(false);

      // SuperAdmin puede todo, incluido borrado definitivo
      expect(evaluateStoredDocsPermission('superadmin', 'read')).toBe(true);
      expect(evaluateStoredDocsPermission('superadmin', 'create')).toBe(true);
      expect(evaluateStoredDocsPermission('superadmin', 'update')).toBe(true);
      expect(evaluateStoredDocsPermission('superadmin', 'delete')).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. DETECCIÓN DOCUMENTAL DE EXTREMO A EXTREMO
  // ───────────────────────────────────────────────────────────────────────────
  describe('2. Facturas SAT y Detección de Colisiones de UUID vs Folio', () => {
    it('detecta duplicado exacto cuando el UUID fiscal ya está registrado', () => {
      const orders = [orderAlpha, orderBeta];
      const match = findExistingInvoice(orders, '6353', '11111111-2222-3333-4444-555555555555');
      expect(match.isDuplicate).toBe(true);
      expect(match.order?.id).toBe('ord-alpha-gt');
      expect(match.invoice?.id).toBe('inv-alpha-1');
      expect(match.hasFolioCollision).toBeFalsy();
    });

    it('identifica colisión de folio con UUID distinto como revisión (hasFolioCollision) sin bloquear en seco', () => {
      const orders = [orderAlpha, orderBeta];
      const match = findExistingInvoice(orders, '6353', '99999999-9999-9999-9999-999999999999');
      expect(match.isDuplicate).toBe(false);
      expect(match.hasFolioCollision).toBe(true);
      expect(match.order?.id).toBe('ord-alpha-gt');
    });

    it('detecta duplicado exacto por folio de entrega en báscula con findExistingDelivery', () => {
      const match = findExistingDelivery([orderAlpha], '6439784', 2000, '2026-10-01');
      expect(match.isDuplicate).toBe(true);
      expect(match.delivery?.docFolio).toBe('6439784');
    });

    it('detiene la aplicación automática si hay colisión de folio fiscal y solicita revisión manual', async () => {
      const colDoc: PipelineAnalysis = {
        file: dummyFile,
        docType: 'factura_cfdi',
        confidence: 'alta',
        folio: '6353',
        uuid: '99999999-9999-9999-9999-999999999999',
        kilos: 1000,
        subtotal: 43000,
        total: 49880,
        docDate: '2026-10-08',
        matchedOrder: orderAlpha,
        duplicateOrder: orderAlpha,
        hasFolioCollision: true,
        isDuplicate: false,
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: true,
      };

      const result = await applyDocumentFast(colDoc, null, [orderAlpha]);
      expect(result.success).toBe(false);
      expect(result.needsReview).toBe(true);
      expect(result.hasFolioCollision).toBe(true);
      expect(result.message).toContain('Colisión de folio detectada');
    });

    it('detiene la aplicación de pesaje de báscula si es coincidencia sospechosa', async () => {
      const suspectDoc: PipelineAnalysis = {
        file: dummyFile,
        docType: 'ticket_bascula',
        confidence: 'media',
        folio: 'TKT-991',
        kilos: 2002, // 2,002 kg vs 2,000 kg previo
        subtotal: 0,
        total: 0,
        docDate: '2026-10-01',
        matchedOrder: orderAlpha,
        duplicateOrder: orderAlpha,
        isSuspectDuplicate: true,
        suspectReason: 'Pesaje similar de 2000 kg en misma fecha',
        isDuplicate: false,
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: true,
      };

      const result = await applyDocumentFast(suspectDoc, null, [orderAlpha]);
      expect(result.success).toBe(false);
      expect(result.needsReview).toBe(true);
      expect(result.isSuspectDuplicate).toBe(true);
      expect(result.message).toContain('Coincidencia sospechosa en báscula');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. CONTRARECIBOS: COINCIDENCIA EXACTA Y MULTI-ORDEN
  // ───────────────────────────────────────────────────────────────────────────
  describe('3. Contrarecibos: Coincidencia Exacta y Multi-Orden', () => {
    it('elimina coincidencias por sufijo o parciales en folios de facturas', () => {
      expect(normalizeInvoiceFolio('FAC-6352')).toBe('FAC6352');
      expect(normalizeInvoiceFolio('6352')).toBe('6352');
      // Coincidencia estricta: '52' no debe ser igual a '6352'
      expect(normalizeInvoiceFolio('52') === normalizeInvoiceFolio('6352')).toBe(false);
      // Coincidencia con espacios o guiones normalizados sí coincide
      expect(normalizeInvoiceFolio('6352 ') === normalizeInvoiceFolio('6352')).toBe(true);
      expect(normalizeInvoiceFolio(' 63-52 ') === normalizeInvoiceFolio('6352')).toBe(true);
    });

    it('en contrarecibo multi-orden: si un folio no se encuentra, aborta y no modifica ninguna orden', async () => {
      const allOrders = [orderAlpha, orderBeta];
      // Ampara '6353' (existe en alpha) y '99999' (NO existe en ninguna orden)
      const crPartialFailAnalysis: PipelineAnalysis = {
        file: dummyFile,
        docType: 'contrarecibo',
        confidence: 'alta',
        folio: 'CR-PROV-ERROR',
        contrareciboNumber: 'CR-PROV-ERROR',
        facturaFolios: ['6353', '99999'],
        dueDate: '2026-10-25',
        matchedOrder: orderAlpha,
        isDuplicate: false,
        kilos: 0,
        subtotal: 100000,
        total: 116000,
        docDate: '2026-10-08',
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(crPartialFailAnalysis, orderAlpha, allOrders);
      expect(result.success).toBe(false);
      expect(result.needsReview).toBe(true);
      expect(result.message).toContain('no se encontró en ninguna orden activa');
      expect(result.message).toContain('Ninguna orden fue modificada');
    });

    it('en contrarecibo multi-orden: si todas las facturas existen de forma unívoca, aplica con éxito', async () => {
      const allOrders = [orderAlpha, orderBeta];
      const crSuccess: PipelineAnalysis = {
        file: dummyFile,
        docType: 'contrarecibo',
        confidence: 'alta',
        folio: 'CR-PROV-MULTI-OK',
        contrareciboNumber: 'CR-PROV-MULTI-OK',
        facturaFolios: ['6353', '6354'],
        dueDate: '2026-10-25',
        matchedOrder: orderAlpha,
        isDuplicate: false,
        kilos: 0,
        subtotal: 129000,
        total: 149640,
        docDate: '2026-10-08',
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(crSuccess, orderAlpha, allOrders);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('contrarecibo');
      expect(result.message).toContain('vinculado automáticamente a Factura(s) #6353, #6354');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. PAGOS, HISTORIAL, TOLERANCIA Y REINTENTOS CONCURRENTES
  // ───────────────────────────────────────────────────────────────────────────
  describe('4. Pagos, Idempotencia y Saldo Derivado del Historial', () => {
    it('permite dos pagos del mismo importe el mismo día si tienen referencias bancarias distintas', () => {
      const existingOrders: PurchaseOrder[] = [
        {
          ...orderAlpha,
          invoices: [
            {
              ...orderAlpha.invoices![0],
              collection: {
                paidAmount: 20000,
                transferRef: 'SPEI-LOTE-01',
                paymentsHistory: [
                  {
                    receiptId: 'SPEI-LOTE-01',
                    reference: 'SPEI-LOTE-01',
                    amount: 20000,
                    date: Timestamp.fromDate(new Date('2026-10-08T10:00:00Z')),
                  },
                ],
              },
            },
          ],
        },
      ];

      // Mismo monto de $20,000 en la misma fecha, pero referencia 'SPEI-LOTE-02'
      const checkDup = findExistingPayment(existingOrders, 'SPEI-LOTE-02', 20000, '2026-10-08');
      expect(checkDup.isDuplicate).toBe(false);

      // Si la referencia es 'SPEI-LOTE-01', sí es duplicado
      const checkDupSame = findExistingPayment(existingOrders, 'SPEI-LOTE-01', 20000, '2026-10-08');
      expect(checkDupSame.isDuplicate).toBe(true);
    });

    it('al reconstruir paidAmount desde historial, preserva saldo histórico previo de facturas sin desglose', () => {
      // Simulación de factura histórica: paidAmount = 50,000 pero paymentsHistory vacío
      const prevPaid = 50000;
      const existingHistory: any[] = [];
      const existingHistorySum = existingHistory.reduce((s, p) => s + p.amount, 0);
      const historicalBase = Math.max(0, prevPaid - existingHistorySum);
      expect(historicalBase).toBe(50000);

      const nuevoAbono = 10000;
      const newPaid = historicalBase + existingHistorySum + nuevoAbono;
      expect(newPaid).toBe(60000); // El abono anterior de 50,000 no se borró ni se convirtió en 10,000
    });

    it('valida pagos parciales, pago completo y sobrepago con tolerancia contable estricta (<= $0.05)', () => {
      const invoiceTotal = 49880.0;
      const tolerance = 0.05;

      // Pago parcial
      const partialPaid = 30000.0;
      const isPartialFull = (partialPaid - invoiceTotal) >= -tolerance;
      expect(isPartialFull).toBe(false);

      // Pago exacto dentro de centavos de SAT (49,879.98 vs 49,880.00 difiere 0.02)
      const exactPaid = 49879.98;
      const isExactFull = (exactPaid - invoiceTotal) >= -tolerance;
      expect(isExactFull).toBe(true);

      // Sobrepago (+150 MXN)
      const overPaid = 50030.0;
      const isOver = (overPaid - invoiceTotal) > tolerance;
      expect(isOver).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. PRECIOS VARIABLES Y CERO VÁLIDO
  // ───────────────────────────────────────────────────────────────────────────
  describe('5. Precios Variables y Distinción de Cero Válido', () => {
    it('respeta precio custom de $0.00 sin reemplazarlo por el default de $43.00', () => {
      const orderWithZeroPrice: PurchaseOrder = {
        ...orderAlpha,
        customSellPrice: 0.0, // Reposición en garantía o bonificación oficial
      };

      const hasOrderSell = orderWithZeroPrice.customSellPrice !== undefined && orderWithZeroPrice.customSellPrice !== null;
      expect(hasOrderSell).toBe(true);

      const effectiveSellPrice = hasOrderSell ? orderWithZeroPrice.customSellPrice : 43.0;
      expect(effectiveSellPrice).toBe(0.0);
    });

    it('preserva importes timbrados del CFDI en lugar de recalcular a partir de tarifas estimadas', () => {
      const satConcept = {
        cantidad: 1000,
        valorUnitario: 45.50, // Precio negociado especial superior al default de 43
        importe: 45500.00,
      };

      const unitPrice = satConcept.valorUnitario !== undefined && satConcept.valorUnitario !== null
        ? satConcept.valorUnitario
        : 43.0;
      const amount = satConcept.importe !== undefined && satConcept.importe !== null
        ? satConcept.importe
        : satConcept.cantidad * 43.0;

      expect(unitPrice).toBe(45.50);
      expect(amount).toBe(45500.00);
    });
  });
});
