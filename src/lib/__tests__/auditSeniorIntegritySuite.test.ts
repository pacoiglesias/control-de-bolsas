import { describe, it, expect, vi } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  findExistingInvoice,
  findExistingDelivery,
  applyDocumentFast,
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
          netCashFlow: 5560.0, // 43,000 - 34,000 - 3,440
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

  describe('1. Facturas SAT y Detección de Colisiones de UUID vs Folio', () => {
    it('detecta duplicado exacto cuando el UUID fiscal ya está registrado', () => {
      const orders = [orderAlpha, orderBeta];
      // Orden canónico: folio, uuid
      const match = findExistingInvoice(orders, '6353', '11111111-2222-3333-4444-555555555555');
      expect(match.isDuplicate).toBe(true);
      expect(match.order?.id).toBe('ord-alpha-gt');
      expect(match.invoice?.id).toBe('inv-alpha-1');
      expect(match.hasFolioCollision).toBeFalsy();

      // Detección si los parámetros se envían invertidos
      const matchInverted = findExistingInvoice(orders, '11111111-2222-3333-4444-555555555555', '6353');
      expect(matchInverted.isDuplicate).toBe(true);
      expect(matchInverted.invoice?.id).toBe('inv-alpha-1');
    });

    it('identifica colisión de folio con UUID distinto como revisión (hasFolioCollision) sin bloquear en seco', () => {
      const orders = [orderAlpha, orderBeta];
      // Mismo folio '6353' pero UUID SAT completamente distinto
      const match = findExistingInvoice(orders, '6353', '99999999-9999-9999-9999-999999999999');
      expect(match.isDuplicate).toBe(false);
      expect(match.hasFolioCollision).toBe(true);
      expect(match.order?.id).toBe('ord-alpha-gt');
    });

    it('aplica factura CFDI preservando el subtotal y total leídos del SAT sin sobreescribir con fórmulas estimadas', async () => {
      const cfdiDoc: PipelineAnalysis = {
        file: dummyFile,
        docType: 'factura_cfdi',
        confidence: 'alta',
        folio: '6399',
        uuid: 'F47AC10B-58CC-4372-A567-0E02B2C3D479',
        kilos: 1250,
        subtotal: 53750.0, // Leído exacto del CFDI
        total: 62350.0,    // 53,750 + IVA 16% = 62,350
        docDate: '2026-10-08',
        matchedOrder: orderAlpha,
        isDuplicate: false,
        detectedOcNumber: '12026439784',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(cfdiDoc, orderAlpha, [orderAlpha, orderBeta]);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('factura_cfdi');
      expect(result.folio).toBe('6399');
      expect(result.total).toBe(62350.0);
      expect(result.kilos).toBe(1250);
    });
  });

  describe('2. Báscula y Entregas Físicas', () => {
    it('detecta duplicado exacto por folio de báscula', () => {
      const orders = [orderAlpha];
      const match = findExistingDelivery(orders, '6439784', 2000, '2026-10-01');
      expect(match.isDuplicate).toBe(true);
      expect(match.delivery?.id).toBe('del-alpha-1');
    });

    it('detecta duplicado sin folio cuando coinciden kilos y fecha exacta', () => {
      const orders = [orderAlpha];
      const match = findExistingDelivery(orders, undefined, 1500, '2026-10-02');
      expect(match.isDuplicate).toBe(true);
      expect(match.delivery?.id).toBe('del-alpha-nofolio');
    });

    it('detecta coincidencia sospechosa (isSuspectDuplicate) con kilos similares sin bloquear silenciosamente', () => {
      const orders = [orderAlpha];
      // 1505 kg en lugar de 1500 kg (+0.3%, dentro de +/- 1%) en la misma fecha
      const match = findExistingDelivery(orders, undefined, 1505, '2026-10-02');
      expect(match.isDuplicate).toBe(false);
      expect(match.isSuspectDuplicate).toBe(true);
      expect(match.order?.id).toBe('ord-alpha-gt');
    });
  });

  describe('3. Contrarecibos Multi-Orden y Vinculación Estricta', () => {
    it('actualiza todas las órdenes involucradas cuando el contrarecibo ampara facturas de diferentes OCs', async () => {
      const allOrders = [orderAlpha, orderBeta];
      // Contrarecibo que ampara '6353' (en orden Alpha) y '6354' (en orden Beta)
      const crMultiAnalysis: PipelineAnalysis = {
        file: dummyFile,
        docType: 'contrarecibo',
        confidence: 'alta',
        folio: 'CR-PROV-1047',
        contrareciboNumber: 'CR-PROV-1047',
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

      const result = await applyDocumentFast(crMultiAnalysis, orderAlpha, allOrders);
      expect(result.success).toBe(true);
      expect(result.docType).toBe('contrarecibo');
      expect(result.message).toContain('CR-PROV-1047');
      expect(result.message).toContain('Factura(s) #6353, #6354');
    });

    it('solicita revisión manual en vez de asignar por aproximación si no hay folios y hay múltiples facturas pendientes', async () => {
      const orderAmbiguous: PurchaseOrder = {
        ...orderAlpha,
        invoices: [
          {
            id: 'inv-amb-1',
            orderId: 'ord-alpha-gt',
            folio: '7001',
            kilos: 1000,
            creditCycle: { status: 'in_review' },
            financials: { invoiceTotal: 49880.0, salePricePerKg: 43.0, costPricePerKg: 34.0, netCashFlow: 5560.0 },
            collection: { paidAmount: 0 },
          },
          {
            id: 'inv-amb-2',
            orderId: 'ord-alpha-gt',
            folio: '7002',
            kilos: 1000,
            creditCycle: { status: 'in_review' },
            financials: { invoiceTotal: 49880.0, salePricePerKg: 43.0, costPricePerKg: 34.0, netCashFlow: 5560.0 },
            collection: { paidAmount: 0 },
          },
        ],
      };

      const crAmbiguousAnalysis: PipelineAnalysis = {
        file: dummyFile,
        docType: 'contrarecibo',
        confidence: 'media',
        folio: 'CR-AMBIGUO',
        contrareciboNumber: 'CR-AMBIGUO',
        facturaFolios: [], // Sin folios
        matchedOrder: orderAmbiguous,
        isDuplicate: false,
        kilos: 0,
        subtotal: 43000,
        total: 49880,
        docDate: '2026-10-08',
        detectedOcNumber: '',
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result = await applyDocumentFast(crAmbiguousAnalysis, orderAmbiguous, [orderAmbiguous]);
      expect(result.success).toBe(false);
      expect(result.message).toContain('No se pudieron identificar las facturas amparadas');
    });
  });

  describe('4. Pagos, Idempotencia y Saldo Derivado del Historial', () => {
    it('aplica un abono parcial calculando el saldo acumulado directamente de paymentsHistory', async () => {
      const orderToPay: PurchaseOrder = {
        ...orderAlpha,
        invoices: [
          {
            id: 'inv-pay-1',
            orderId: 'ord-alpha-gt',
            folio: '8801',
            kilos: 1000,
            creditCycle: { status: 'in_review' },
            financials: {
              invoiceTotal: 49880.0,
              salePricePerKg: 43.0,
              costPricePerKg: 34.0,
              netCashFlow: 5560.0,
            },
            collection: {
              paidAmount: 0,
              paymentsHistory: [],
            },
          },
        ],
      };

      const payment1: PipelineAnalysis = {
        file: dummyFile,
        docType: 'comprobante_pago',
        confidence: 'alta',
        folio: '8801',
        total: 20000.0,
        kilos: 0,
        subtotal: 17241.38,
        docDate: '2026-10-08',
        detectedOcNumber: 'TR-SPEI-99881',
        matchedOrder: orderToPay,
        isDuplicate: false,
        autoAssignedLabel: '',
        needsClarification: false,
      };

      const result1 = await applyDocumentFast(payment1, orderToPay);
      expect(result1.success).toBe(true);
      expect(result1.isDuplicate).toBeFalsy();

      // Verificar idempotencia: intentar aplicar el mismo comprobante de nuevo
      const resultRetry = await applyDocumentFast(payment1, orderToPay);
      // Debe reportar que ya está aplicado previamente y no duplicar el abono
      expect(resultRetry.success).toBe(true);
      expect(resultRetry.isDuplicate).toBe(true);
      expect(resultRetry.message).toContain('ya fue aplicado previamente');
    });
  });
});
