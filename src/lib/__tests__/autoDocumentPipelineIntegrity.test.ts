import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  findExistingDelivery,
  findExistingPayment,
  applyDocumentFast,
  type PipelineAnalysis,
} from '../autoDocumentPipeline';
import type { PurchaseOrder } from '../types';

// Mock de Firestore y Storage para aislamiento de pruebas unitarias
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
    writeBatch: vi.fn(() => ({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    })),
    runTransaction: vi.fn(async (_db, callback) => {
      const mockTxn = {
        get: vi.fn(async (docRef: any) => ({
          exists: () => {
            if (docRef?.path?.includes('payment_receipts')) return false;
            return true;
          },
          data: () => ({}),
        })),
        update: vi.fn(),
        set: vi.fn(),
      };
      return callback(mockTxn);
    }),
    serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  };
});

describe('Integridad del Pipeline de Documentos Automático (v9.10.24)', () => {
  const mockFile = new File(['test'], 'doc.pdf', { type: 'application/pdf' });

  const baseOrder: PurchaseOrder = {
    id: 'ord-gt-1',
    oc: '12026439784',
    folio: '43/9784',
    client: 'GRUPO TEXTIL PROVIDENCIA',
    department: 'ALMACÉN P4',
    totalKilograms: 5100,
    creditCycle: { status: 'pedido' },
    deliveries: [
      {
        id: 'del-1',
        docFolio: '6439784',
        kilos: 2000,
        date: Timestamp.fromDate(new Date('2026-10-01T12:00:00Z')),
        invoiced: false,
        notes: 'Entrega lote 6439784 de bolsas',
      },
      {
        id: 'del-sin-folio',
        docFolio: '',
        kilos: 1500,
        date: Timestamp.fromDate(new Date('2026-10-02T12:00:00Z')),
        invoiced: false,
        notes: 'Ticket de báscula sin folio impreso',
      },
    ],
    invoices: [
      {
        id: 'inv-6353',
        orderId: 'ord-gt-1',
        folio: '6353',
        uuid: '7E1F2FE9-0D09-418E-8D29-1358A7664920',
        kilos: 1350,
        creditCycle: { status: 'facturado' },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 34.0,
          invoiceTotal: 67338.0,
          saleTotal: 58050.0,
          netCashFlow: 16794.0,
        },
        collection: {
          contrareciboNumber: '',
          transferRef: 'SPEI-778899',
          paymentsHistory: [
            {
              receiptId: 'SPEI-778899',
              amount: 67338.0,
              date: '2026-10-05',
              reference: 'SPEI-778899',
            },
          ],
        },
      },
    ],
  };

  describe('1. Báscula y Detección de Duplicados', () => {
    it('detecta duplicado sin folio cuando coinciden kilos y fecha exacta', () => {
      const orders = [baseOrder];
      // Buscamos un ticket sin folio con 1500 kg y misma fecha
      const match = findExistingDelivery(orders, undefined, 1500, '2026-10-02');
      expect(match.isDuplicate).toBe(true);
      expect(match.delivery?.id).toBe('del-sin-folio');
      expect(match.order?.id).toBe('ord-gt-1');
    });

    it('no marca duplicado si kilos o fecha no coinciden en remisión sin folio', () => {
      const orders = [baseOrder];
      const matchDiffKg = findExistingDelivery(orders, undefined, 1505, '2026-10-02');
      expect(matchDiffKg.isDuplicate).toBe(false);

      const matchDiffDate = findExistingDelivery(orders, undefined, 1500, '2026-10-05');
      expect(matchDiffDate.isDuplicate).toBe(false);
    });

    it('evita falsos positivos en notas usando límites de palabra estricto', () => {
      const orderWithNotes: PurchaseOrder = {
        ...baseOrder,
        deliveries: [
          {
            id: 'del-notes',
            docFolio: '99',
            kilos: 500,
            date: Timestamp.fromDate(new Date('2026-10-03T12:00:00Z')),
            notes: 'Ref lote 9999 y paquete 199',
          },
        ],
      };
      // Folio 99 está en docFolio, pero si buscamos folio "9" no debe coincidir solo porque "99" contiene "9"
      const matchSubstr = findExistingDelivery([orderWithNotes], '9', 500);
      expect(matchSubstr.isDuplicate).toBe(false);

      // En cambio, folio "99" sí debe coincidir con docFolio
      const matchExact = findExistingDelivery([orderWithNotes], '99', 500);
      expect(matchExact.isDuplicate).toBe(true);
      expect(matchExact.delivery?.id).toBe('del-notes');
    });
  });

  describe('2. Duplicados con Orden Destino Prioritaria', () => {
    it('resuelve duplicidad sin error de "sin orden destino" cuando matchedOrder es null', async () => {
      const analysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'remision',
        confidence: 'alta',
        folio: '6439784',
        matchedOrder: null, // matchedOrder es null
        duplicateOrder: baseOrder, // pero duplicateOrder sí existe
        isDuplicate: true,
        kilos: 2000,
        subtotal: 0,
        total: 0,
        docDate: '2026-10-01',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(analysis, null);
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.message).toContain('ya está registrado previamente');
      expect(result.orderFolio).toBe('43/9784');
    });
  });

  describe('3. Idempotencia y Ambigüedad de Pagos Bancarios', () => {
    it('detecta pago ya registrado por referencia bancaria en paymentsHistory', () => {
      const match = findExistingPayment([baseOrder], 'SPEI-778899', 67338.0);
      expect(match.isDuplicate).toBe(true);
      expect(match.order?.id).toBe('ord-gt-1');
      expect(match.invoice?.folio).toBe('6353');
    });

    it('rechaza procesar comprobante bancario duplicado en applyDocumentFast', async () => {
      const paymentAnalysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'comprobante_pago',
        confidence: 'alta',
        folio: 'SPEI-778899',
        matchedOrder: baseOrder,
        isDuplicate: true,
        duplicateOrder: baseOrder,
        kilos: 0,
        subtotal: 67338.0,
        total: 67338.0,
        docDate: '2026-10-05',
        detectedOcNumber: 'SPEI-778899',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(paymentAnalysis, baseOrder);
      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(true);
      expect(result.message).toContain('ya está registrado previamente');
    });

    it('alerta ambigüedad si existen múltiples facturas con el mismo saldo pendiente y sin referencia exacta', async () => {
      const orderAmbiguous: PurchaseOrder = {
        ...baseOrder,
        invoices: [
          {
            id: 'inv-A',
            orderId: 'ord-gt-1',
            folio: '7001',
            kilos: 1000,
            financials: { invoiceTotal: 50000, netCashFlow: 10000, salePricePerKg: 43, costPricePerKg: 34 },
            collection: { paymentsHistory: [] },
            creditCycle: { status: 'facturado' },
          },
          {
            id: 'inv-B',
            orderId: 'ord-gt-1',
            folio: '7002',
            kilos: 1000,
            financials: { invoiceTotal: 50000, netCashFlow: 10000, salePricePerKg: 43, costPricePerKg: 34 },
            collection: { paymentsHistory: [] },
            creditCycle: { status: 'facturado' },
          },
        ],
      };

      const analysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'comprobante_pago',
        confidence: 'media',
        folio: '',
        matchedOrder: orderAmbiguous,
        isDuplicate: false,
        kilos: 0,
        subtotal: 50000,
        total: 50000,
        docDate: '2026-10-06',
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(analysis, orderAmbiguous);
      expect(result.success).toBe(false);
      expect(result.message).toContain('coincide con múltiples facturas pendientes con el mismo saldo exacto');
    });
  });

  describe('4. Prevalencia de Precios Reales y Flags de Estimación en CFDI', () => {
    it('respeta precios pactados en la orden sobre defaults de configuración', async () => {
      const orderWithSpecialPrice: PurchaseOrder = {
        ...baseOrder,
        customSellPrice: 45.0,
        customCostPrice: 38.0,
      };

      const cfdiAnalysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'factura_cfdi',
        confidence: 'alta',
        folio: '6999',
        uuid: 'UUID-NUEVA-FACTURA-1234-5678-ABCD',
        matchedOrder: orderWithSpecialPrice,
        kilos: 1000,
        subtotal: 45000,
        total: 52200, // 1000 * 45 * 1.16 = 52,200
        isDuplicate: false,
        docDate: '2026-10-07',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(cfdiAnalysis, orderWithSpecialPrice);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('factura_cfdi');
      expect(result.folio).toBe('6999');
      expect(result.total).toBe(52200);
    });
  });

  describe('5. Contrarecibos: Integridad y no asignación a ciegas', () => {
    it('no asigna a ciegas un contrarecibo sin folios si hay ambigüedad entre facturas', async () => {
      const orderMultipleInvoices: PurchaseOrder = {
        ...baseOrder,
        invoices: [
          {
            id: 'inv-1',
            orderId: 'ord-gt-1',
            folio: '6001',
            kilos: 500,
            financials: { invoiceTotal: 30000, netCashFlow: 5000, salePricePerKg: 43, costPricePerKg: 34 },
            creditCycle: { status: 'facturado' },
          },
          {
            id: 'inv-2',
            orderId: 'ord-gt-1',
            folio: '6002',
            kilos: 700,
            financials: { invoiceTotal: 40000, netCashFlow: 7000, salePricePerKg: 43, costPricePerKg: 34 },
            creditCycle: { status: 'facturado' },
          },
        ],
      };

      const crAnalysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'contrarecibo',
        confidence: 'media',
        folio: 'CR-SIN-FOLIOS-DETECTADOS',
        contrareciboNumber: 'CR-SIN-FOLIOS-DETECTADOS',
        facturaFolios: [], // sin folios
        matchedOrder: orderMultipleInvoices,
        isDuplicate: false,
        kilos: 0,
        subtotal: 70000,
        total: 70000,
        docDate: '2026-10-07',
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(crAnalysis, orderMultipleInvoices);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No se pudieron identificar las facturas amparadas');
    });

    it('asocia con éxito si el contrarecibo especifica el folio de factura', async () => {
      const crAnalysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'contrarecibo',
        confidence: 'alta',
        folio: 'CR-OFICIAL-88',
        contrareciboNumber: 'CR-OFICIAL-88',
        facturaFolios: ['6353'],
        matchedOrder: baseOrder,
        isDuplicate: false,
        kilos: 0,
        subtotal: 67338,
        total: 67338,
        docDate: '2026-10-08',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(crAnalysis, baseOrder);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('contrarecibo');
      expect(result.message).toContain('vinculado automáticamente a Factura(s) #6353');
    });
  });
});
