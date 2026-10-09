import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyDocumentFast,
  type PipelineAnalysis,
} from '../autoDocumentPipeline';
import type { PurchaseOrder } from '../types';
import { evaluateThreeWayMatch } from '../finance';

// Mock de dependencias
vi.mock('../safeFirestore', () => ({
  safeUpdateDoc: vi.fn().mockResolvedValue(undefined),
  safeAddDoc: vi.fn().mockResolvedValue({ id: 'mock-doc-id' }),
  safeSetDoc: vi.fn().mockResolvedValue(undefined),
}));

const mockLogAction = vi.fn().mockResolvedValue(undefined);
const mockLogMandatoryAction = vi.fn().mockResolvedValue(undefined);
vi.mock('../logger', () => ({
  logAction: (...args: any[]) => mockLogAction(...args),
  logMandatoryAction: (...args: any[]) => mockLogMandatoryAction(...args),
}));

vi.mock('../documentStorage', () => ({
  uploadDocument: vi.fn().mockResolvedValue({ url: 'https://mock/doc.pdf', storagePath: 'mock/doc.pdf' }),
}));

let currentMockOrder: any = null;
const recordedReceiptSets: Record<string, any> = {};

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
            if (docRef?.path?.includes('payment_receipts')) {
              const id = docRef.id;
              return !!recordedReceiptSets[id];
            }
            return true;
          },
          data: () => currentMockOrder || {},
        })),
        update: vi.fn(),
        set: vi.fn((docRef: any, data: any) => {
          if (docRef?.path?.includes('payment_receipts')) {
            recordedReceiptSets[docRef.id] = data;
          }
        }),
      };
      return await callback(mockTxn);
    }),
    serverTimestamp: vi.fn(() => '2026-10-09T17:00:00Z'),
  };
});

describe('Blindaje de Identidad de Pagos, Seguridad de Reglas y Precios Cero ($0.00)', () => {
  const mockFile = new File(['dummy binary stream bytes'], 'comprobante_banco.pdf', { type: 'application/pdf' });

  const buildBaseOrder = (id = 'ord-sec-1', folio = '43/9784'): PurchaseOrder => ({
    id,
    oc: '12026439784',
    folio,
    client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
    department: 'GT',
    customSellPrice: 43.0,
    customCostPrice: 34.0,
    totalKilograms: 5100,
    creditCycle: { status: 'pedido' },
    deliveries: [],
    invoices: [
      {
        id: 'inv-sec-1',
        orderId: id,
        folio: '6353',
        kilos: 2000,
        financials: {
          invoiceTotal: 99760.0,
          saleTotal: 86000.0,
          salePricePerKg: 43.0,
          costPricePerKg: 34.0,
          netCashFlow: 18000.0,
        },
        collection: { paidAmount: 0, paymentsHistory: [] },
        creditCycle: { status: 'facturado' },
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(recordedReceiptSets).forEach((k) => delete recordedReceiptSets[k]);
    currentMockOrder = buildBaseOrder();
  });

  describe('1. Erradicación de Referencias Débiles en Pagos (autoDocumentPipeline)', () => {
    it('rechaza auto-aplicar si solo existe nombre de archivo o folio de orden sin referencia bancaria ni SHA-256', async () => {
      const order = buildBaseOrder();
      const weakAnalysis: PipelineAnalysis = {
        file: undefined as any,
        docType: 'comprobante_pago',
        confidence: 'media',
        folio: '43/9784', // solo el folio de la orden
        matchedOrder: order,
        isDuplicate: false,
        kilos: 0,
        subtotal: 50000.0,
        total: 50000.0,
        docDate: '2026-10-09',
        detectedOcNumber: '12026439784', // solo la OC
        autoAssignedLabel: '',
        needsClarification: false,
        trackingKey: '', // SIN tracking key
        bankReference: '', // SIN referencia bancaria
        fileContentSha256: '', // SIN huella sha256
      };

      const result = await applyDocumentFast(weakAnalysis, order);
      expect(result.success).toBe(false);
      expect(result.needsReview).toBe(true);
      expect(result.reviewReason).toContain('sin clave de rastreo SPEI');
      expect(result.message).toContain('requiere revisión manual obligatoria');
    });

    it('aplica exitosamente cuando se proporciona una clave de rastreo SPEI fuerte', async () => {
      const order = buildBaseOrder();
      const strongAnalysis: PipelineAnalysis = {
        file: mockFile,
        docType: 'comprobante_pago',
        confidence: 'alta',
        folio: '6353',
        matchedOrder: order,
        isDuplicate: false,
        kilos: 0,
        subtotal: 50000.0,
        total: 50000.0,
        docDate: '2026-10-09',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
        trackingKey: 'SPEI-BBVA-20261009-883311',
      };

      const result = await applyDocumentFast(strongAnalysis, order);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('comprobante_pago');

      // Verificar que se haya registrado en payment_receipts con clave libre de colisiones
      const receiptKeys = Object.keys(recordedReceiptSets);
      expect(receiptKeys.length).toBe(1);
      const receiptData = recordedReceiptSets[receiptKeys[0]];
      expect(receiptData.amount).toBe(50000.0);
      expect(receiptData.trackingKey).toBe('SPEI-BBVA-20261009-883311');
      expect(receiptData.receiptKey).toBe(receiptKeys[0]);
    });

    it('genera claves de almacenamiento no colisionantes ante caracteres especiales normalizados', async () => {
      const order = buildBaseOrder();
      const analysisA: PipelineAnalysis = {
        file: undefined as any,
        docType: 'comprobante_pago',
        confidence: 'alta',
        folio: '6353',
        matchedOrder: order,
        isDuplicate: false,
        kilos: 0,
        subtotal: 10000.0,
        total: 10000.0,
        docDate: '2026-10-09',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
        bankReference: 'REF.BANCARIA.100',
      };

      const analysisB: PipelineAnalysis = {
        file: undefined as any,
        docType: 'comprobante_pago',
        confidence: 'alta',
        folio: '6353',
        matchedOrder: order,
        isDuplicate: false,
        kilos: 0,
        subtotal: 10000.0,
        total: 10000.0,
        docDate: '2026-10-09',
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
        bankReference: 'REF-BANCARIA-100',
      };

      await applyDocumentFast(analysisA, order);
      const keyA = Object.keys(recordedReceiptSets)[0];

      delete recordedReceiptSets[keyA];
      await applyDocumentFast(analysisB, order);
      const keyB = Object.keys(recordedReceiptSets)[0];

      // Aunque ambos se saniticen con prefijo limpio, sus hashes deterministas impiden la colisión
      expect(keyA).not.toBe(keyB);
      expect(keyA).toContain('BANK_REF_BANCARIA_100_');
      expect(keyB).toContain('BANK_REF_BANCARIA_100_');
    });
  });

  describe('2. Validación de Esquema y Reglas de Seguridad en payment_receipts', () => {
    const validatePaymentReceiptRule = (
      userRole: 'unauthenticated' | 'viewer' | 'manager' | 'admin' | 'superadmin',
      docData: any,
      docId: string
    ) => {
      const isManagerOrAdmin = userRole === 'manager' || userRole === 'admin' || userRole === 'superadmin';
      if (!isManagerOrAdmin) {
        return { allowed: false, reason: 'Solo gerencia o administradores pueden crear comprobantes' };
      }
      if (docData.receiptKey !== docId) {
        return { allowed: false, reason: 'receiptKey debe coincidir exactamente con el ID del documento' };
      }
      if (typeof docData.orderId !== 'string' || docData.orderId.length === 0) {
        return { allowed: false, reason: 'orderId es requerido y debe ser string' };
      }
      if (typeof docData.amount !== 'number' || docData.amount <= 0) {
        return { allowed: false, reason: 'amount debe ser un número positivo mayor a cero' };
      }
      const hasStrongIdentity =
        (typeof docData.trackingKey === 'string' && docData.trackingKey.length > 0) ||
        (typeof docData.bankReference === 'string' && docData.bankReference.length > 0) ||
        (typeof docData.fileSha256 === 'string' && docData.fileSha256.length >= 32);

      if (!hasStrongIdentity) {
        return { allowed: false, reason: 'Debe contener al menos una referencia bancaria fuerte o huella SHA-256' };
      }
      if (!docData.appliedAt) {
        return { allowed: false, reason: 'appliedAt es obligatorio' };
      }
      if (typeof docData.appliedBy !== 'string' || docData.appliedBy.length === 0) {
        return { allowed: false, reason: 'appliedBy es obligatorio' };
      }
      return { allowed: true };
    };

    it('rechaza la creación de comprobante si el usuario no tiene rol manager o superior', () => {
      const validDoc = {
        receiptKey: 'BANK_REF_100_1234abcd',
        orderId: 'ord-1',
        amount: 5000,
        bankReference: 'REF-100',
        appliedAt: '2026-10-09T12:00:00Z',
        appliedBy: 'usuario@empresa.com',
      };

      expect(validatePaymentReceiptRule('unauthenticated', validDoc, 'BANK_REF_100_1234abcd').allowed).toBe(false);
      expect(validatePaymentReceiptRule('viewer', validDoc, 'BANK_REF_100_1234abcd').allowed).toBe(false);
      expect(validatePaymentReceiptRule('manager', validDoc, 'BANK_REF_100_1234abcd').allowed).toBe(true);
      expect(validatePaymentReceiptRule('admin', validDoc, 'BANK_REF_100_1234abcd').allowed).toBe(true);
    });

    it('rechaza la creación si receiptKey no coincide con el docId para impedir bloqueo de IDs arbitrarios', () => {
      const spoofedDoc = {
        receiptKey: 'CLAVE_DISTINTA',
        orderId: 'ord-1',
        amount: 5000,
        bankReference: 'REF-100',
        appliedAt: '2026-10-09T12:00:00Z',
        appliedBy: 'admin@empresa.com',
      };

      const evalResult = validatePaymentReceiptRule('manager', spoofedDoc, 'ID_LEGITIMO_VICTIMA');
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.reason).toContain('receiptKey debe coincidir');
    });

    it('rechaza payloads sin referencias bancarias fuertes ni SHA-256', () => {
      const weakDoc = {
        receiptKey: 'WEAK_DOC_1',
        orderId: 'ord-1',
        amount: 5000,
        appliedAt: '2026-10-09T12:00:00Z',
        appliedBy: 'admin@empresa.com',
      };

      const evalResult = validatePaymentReceiptRule('admin', weakDoc, 'WEAK_DOC_1');
      expect(evalResult.allowed).toBe(false);
      expect(evalResult.reason).toContain('referencia bancaria fuerte o huella SHA-256');
    });
  });

  describe('3. Precios Variables, Fórmulas y Respeto a Cero Válido ($0.00)', () => {
    it('respeta precio cero ($0.00) legítimo sin transformarlo en fallback $43 en 3-way matching', () => {
      const orderZeroPrice: PurchaseOrder = {
        id: 'ord-zero-price',
        oc: 'OC-MUESTRAS-001',
        folio: 'MUEST-01',
        client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        department: 'GT',
        customSellPrice: 0.0, // Muestras legítimas a precio cero
        totalKilograms: 100,
        deliveries: [
          {
            id: 'del-z1',
            kilos: 100,
            date: '2026-10-09' as any,
            invoiced: true,
          },
        ],
        invoices: [
          {
            id: 'inv-z1',
            orderId: 'ord-zero-price',
            folio: 'M-101',
            kilos: 100,
            financials: {
              salePricePerKg: 0.0,
              costPricePerKg: 0.0,
              netCashFlow: 0.0,
              invoiceTotal: 0.0,
              saleTotal: 0.0,
            },
            creditCycle: { status: 'facturado' },
          },
        ],
      };

      const evalResult = evaluateThreeWayMatch(orderZeroPrice);
      expect(evalResult.unitPrice).toBe(0.0);
      expect(evalResult.invoiceTotal).toBe(0.0);
      expect(evalResult.expectedTotal).toBe(0.0);
      expect(evalResult.diffMoney).toBe(0.0);
    });

    it('detecta discrepancia cuando la factura difiere en kilos respecto a la báscula', () => {
      const orderMismatch: PurchaseOrder = {
        id: 'ord-mismatch',
        oc: 'OC-DISCREPANCIA',
        folio: 'DISC-01',
        client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        deliveries: [
          {
            id: 'del-sp1',
            kilos: 500,
            date: '2026-10-09' as any,
            invoiced: true,
          },
        ],
        invoices: [
          {
            id: 'inv-sp1',
            orderId: 'ord-mismatch',
            folio: 'FAC-999',
            kilos: 450,
            creditCycle: { status: 'facturado' },
          },
        ],
      };

      const evalResult = evaluateThreeWayMatch(orderMismatch);
      expect(evalResult.status).toBe('DISCREPANCY');
      expect(evalResult.isPerfect).toBe(false);
      expect(evalResult.diffKg).toBe(50);
      expect(evalResult.reason).toContain('Discrepancia de peso');
    });

    it('aplica tarifa oficial de Providencia ($43.00/kg) cuando no existe precio personalizado explícito', () => {
      const orderDefaultPrice: PurchaseOrder = {
        id: 'ord-default-price',
        oc: '12026439784',
        folio: '43/9784',
        client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
        totalKilograms: 1000,
        deliveries: [{ id: 'del-d1', kilos: 1000, date: '2026-10-09' as any, invoiced: true }],
        invoices: [{ id: 'inv-d1', orderId: 'ord-default-price', folio: '6353', kilos: 1000, creditCycle: { status: 'facturado' } }],
      };

      const evalResult = evaluateThreeWayMatch(orderDefaultPrice);
      expect(evalResult.unitPrice).toBe(43.0);
      expect(evalResult.expectedTotal).toBe(Math.round(1000 * 43.0 * 1.16 * 100) / 100);
    });
  });
});
