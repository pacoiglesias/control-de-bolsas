import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  findExistingPayment,
  computeFileContentFingerprint,
  applyDocumentFast,
  type PipelineAnalysis,
} from '../autoDocumentPipeline';
import type { PurchaseOrder } from '../types';

// Mock de safeFirestore y logger
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

let mockUploadError = false;
vi.mock('../documentStorage', () => ({
  uploadDocument: vi.fn().mockImplementation(async () => {
    if (mockUploadError) {
      throw new Error('Firebase Storage Network Timeout 503');
    }
    return { url: 'https://mock.storage/doc.pdf', storagePath: 'mock/path/doc.pdf' };
  }),
}));

const mockBatchUpdate = vi.fn();
const mockBatchCommit = vi.fn().mockResolvedValue(undefined);

let currentMockOrder: any = null;

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<any>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, coll, id) => ({ path: `${coll}/${id}`, id })),
    collection: vi.fn((_db, coll) => ({ path: coll })),
    writeBatch: vi.fn(() => ({
      update: mockBatchUpdate,
      commit: mockBatchCommit,
    })),
    runTransaction: vi.fn(async (_db, callback) => {
      const mockTxn = {
        get: vi.fn(async (docRef: any) => ({
          exists: () => {
            if (docRef?.path?.includes('payment_receipts')) return false;
            return true;
          },
          data: () => currentMockOrder || {},
        })),
        update: vi.fn(),
        set: vi.fn(),
      };
      return await callback(mockTxn);
    }),
    serverTimestamp: vi.fn(() => 'MOCK_SERVER_TIMESTAMP'),
  };
});

describe('System Hardening & Resilience Suite (12 Core Scenarios)', () => {
  const mockFile = new File(['mock content data bytes 12345'], 'recibo_pago.pdf', { type: 'application/pdf' });

  const buildBaseOrder = (id = 'ord-1', folio = '43/9784'): PurchaseOrder => ({
    id,
    oc: '12026439784',
    folio,
    client: 'GRUPO TEXTIL PROVIDENCIA',
    department: 'ALMACÉN P4',
    totalKilograms: 5100,
    creditCycle: { status: 'pedido' },
    deliveries: [],
    invoices: [
      {
        id: 'inv-101',
        orderId: id,
        folio: '6353',
        uuid: 'UUID-INV-101',
        kilos: 1000,
        creditCycle: { status: 'facturado' },
        financials: {
          salePricePerKg: 43.0,
          costPricePerKg: 34.0,
          invoiceTotal: 50000.0,
          saleTotal: 43000.0,
          netCashFlow: 9000.0,
        },
        collection: {
          contrareciboNumber: '',
          paymentsHistory: [],
        },
      },
    ],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadError = false;
    currentMockOrder = null;
  });

  // 1. Colisión de folio y rechazo sin orden seleccionada
  it('1. Rechaza procesar sin orden destino y NUNCA auto-asigna a órdenes aleatorias', async () => {
    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'factura_cfdi',
      confidence: 'media',
      folio: '9999',
      matchedOrder: null,
      duplicateOrder: undefined,
      isDuplicate: false,
      kilos: 500,
      subtotal: 21500,
      total: 24940,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: true,
    };

    // Al no haber matchedOrder ni targetOrderOverride, debe fallar de inmediato
    const result = await applyDocumentFast(analysis, undefined);
    expect(result.success).toBe(false);
    expect(result.message).toContain('No se pudo asociar automáticamente a una Orden de Compra');
  });

  // 2. Cancelación de importación sin escrituras espurias
  it('2. Cancelación / Rechazo temprano no genera escrituras en base de datos', async () => {
    const { safeUpdateDoc } = await import('../safeFirestore');
    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'baja',
      folio: 'CR-INEXISTENTE',
      facturaFolios: ['FOLIO-NO-EXISTE'],
      matchedOrder: buildBaseOrder(),
      isDuplicate: false,
      kilos: 0,
      subtotal: 0,
      total: 0,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: true,
    };

    const result = await applyDocumentFast(analysis, buildBaseOrder());
    expect(result.success).toBe(false);
    expect(safeUpdateDoc).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  // 3. Contrarrecibo con folio inválido o ambiguo
  it('3. Contrarrecibo con folios no coincidentes rechaza vinculación ambigua', async () => {
    const order = buildBaseOrder();
    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'media',
      folio: 'CR-900',
      contrareciboNumber: 'CR-900',
      facturaFolios: ['8888', '7777'], // No existen en order
      matchedOrder: order,
      isDuplicate: false,
      kilos: 0,
      subtotal: 50000,
      total: 50000,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const result = await applyDocumentFast(analysis, order);
    expect(result.success).toBe(false);
    expect(result.message).toContain('no se encontró en ninguna orden activa');
  });

  // 4. Contrarrecibo que detecta colisión con otro existente (hasCrCollision)
  it('4. Detecta colisión si factura ya tiene contrarrecibo asignado y requiere forceReplaceCr', async () => {
    const orderWithCr = buildBaseOrder();
    orderWithCr.invoices![0].collection!.contrareciboNumber = 'CR-ANTERIOR-01';

    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'alta',
      folio: 'CR-NUEVO-99',
      contrareciboNumber: 'CR-NUEVO-99',
      facturaFolios: ['6353'],
      matchedOrder: orderWithCr,
      isDuplicate: false,
      kilos: 0,
      subtotal: 50000,
      total: 50000,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    // Intento sin forceReplaceCr: debe alertar colisión
    const resultCollision = await applyDocumentFast(analysis, orderWithCr);
    expect(resultCollision.success).toBe(false);
    expect(resultCollision.hasCrCollision).toBe(true);
    expect(resultCollision.existingCr).toBe('CR-ANTERIOR-01');
    expect(resultCollision.newCr).toBe('CR-NUEVO-99');

    // Con forceReplaceCr: debe permitir reemplazo
    const resultReplaced = await applyDocumentFast(analysis, orderWithCr, undefined, {
      forceReplaceCr: true,
      manualDecisionAudit: {
        userEmail: 'auditor@ruenisco.com',
        reason: 'Sustitución aprobada por cliente',
        selectedOrderId: orderWithCr.id,
      },
    });
    expect(resultReplaced.success).toBe(true);
    expect(resultReplaced.message).toContain('vinculado automáticamente a Factura(s) #6353');
  });

  // 5. Fallo atómico multiorden con writeBatch y storageWarning
  it('5. Aplica contrarrecibo multiorden atómicamente con writeBatch y reporta storageWarning si Storage falla', async () => {
    mockUploadError = true; // Simular fallo de Storage

    const order1 = buildBaseOrder('ord-1', '43/9784');
    const order2 = buildBaseOrder('ord-2', '71/14302');
    order2.invoices![0].id = 'inv-202';
    order2.invoices![0].folio = '6354';

    const allOrders = [order1, order2];

    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'alta',
      folio: 'CR-MULTI-01',
      contrareciboNumber: 'CR-MULTI-01',
      facturaFolios: ['6353', '6354'],
      matchedOrder: order1,
      isDuplicate: false,
      kilos: 0,
      subtotal: 100000,
      total: 100000,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const result = await applyDocumentFast(analysis, order1, allOrders);
    expect(result.success).toBe(true);
    expect(result.storageWarning).toBe(true);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  // 6. Precios variables: precio ausente (marca revisión), precio $0.00 válido respetado, sin inventar $43
  it('6. Maneja precios unitarios variables: $0.00 válido y marca needsReview si no hay precio determinable', async () => {
    // Caso A: Factura con precio $0.00 explícito en la orden (muestra sin costo)
    const orderWithZeroPrice: PurchaseOrder = {
      ...buildBaseOrder(),
      customSellPrice: 0,
      customCostPrice: 0,
    };

    const zeroPriceAnalysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'factura_cfdi',
      confidence: 'alta',
      folio: '7000',
      uuid: 'UUID-ZERO-PRICE',
      matchedOrder: orderWithZeroPrice,
      isDuplicate: false,
      kilos: 100,
      subtotal: 0,
      total: 0,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const resultZero = await applyDocumentFast(zeroPriceAnalysis, orderWithZeroPrice);
    expect(resultZero.success).toBe(true);

    // Caso B: Factura sin subtotal, sin kilos y sin precios definidos en la orden -> marca needsReview
    const orderWithoutDefaults: PurchaseOrder = {
      ...buildBaseOrder(),
      customSellPrice: undefined,
      customCostPrice: undefined,
      financials: undefined,
    };

    const missingPriceAnalysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'factura_cfdi',
      confidence: 'baja',
      folio: '7001',
      uuid: 'UUID-MISSING-PRICE',
      matchedOrder: orderWithoutDefaults,
      isDuplicate: false,
      kilos: 0,
      subtotal: 0,
      total: 0,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const resultMissing = await applyDocumentFast(missingPriceAnalysis, orderWithoutDefaults);
    expect(resultMissing.success).toBe(false);
    expect(resultMissing.needsReview).toBe(true);
  });

  // 7. Pago parcial, exacto, sobrepago (+X.XX) y selección con múltiples facturas candidatas
  it('7. Registra pagos parciales, exactos, sobrepagos y resuelve ambigüedad mediante targetInvoiceIdOverride', async () => {
    const order = buildBaseOrder();
    order.invoices = [
      {
        id: 'inv-A',
        orderId: order.id,
        folio: '8001',
        kilos: 500,
        financials: { invoiceTotal: 25000, salePricePerKg: 43, costPricePerKg: 34, netCashFlow: 5000 },
        creditCycle: { status: 'facturado' },
        collection: { paymentsHistory: [] },
      },
      {
        id: 'inv-B',
        orderId: order.id,
        folio: '8002',
        kilos: 500,
        financials: { invoiceTotal: 25000, salePricePerKg: 43, costPricePerKg: 34, netCashFlow: 5000 },
        creditCycle: { status: 'facturado' },
        collection: { paymentsHistory: [] },
      },
    ];

    // Ambigüedad: Dos facturas con idéntico saldo de $25,000
    const ambiguousPayment: PipelineAnalysis = {
      file: mockFile,
      docType: 'comprobante_pago',
      confidence: 'media',
      folio: '',
      matchedOrder: order,
      isDuplicate: false,
      kilos: 0,
      subtotal: 25000,
      total: 25000,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const resAmbiguous = await applyDocumentFast(ambiguousPayment, order);
    expect(resAmbiguous.success).toBe(false);
    expect(resAmbiguous.multipleInvoicesCandidate).toBe(true);
    expect(resAmbiguous.candidateInvoices?.length).toBe(2);

    // Con targetInvoiceIdOverride explícito a 'inv-B' y con sobrepago de $28,000 (+$3,000 sobre saldo)
    const overPaymentAnalysis: PipelineAnalysis = {
      ...ambiguousPayment,
      total: 28000,
      subtotal: 28000,
    };

    currentMockOrder = order;
    const resResolved = await applyDocumentFast(overPaymentAnalysis, order, undefined, {
      targetInvoiceIdOverride: 'inv-B',
    });

    expect(resResolved.success).toBe(true);
    expect(resResolved.message).toContain('Factura #8002');
  });

  // 8. Deduplicación por SHA-256 cuando cambia el nombre de archivo
  it('8. Detecta duplicado vía hash SHA-256 aunque el archivo tenga distinto nombre', async () => {
    const file1 = new File(['PAYMENT-BUFFER-IDENTICAL-BYTES-9988'], 'recibo_banco_banamex.pdf', { type: 'application/pdf' });
    const file2 = new File(['PAYMENT-BUFFER-IDENTICAL-BYTES-9988'], 'escaneo_nuevo_sin_nombre.pdf', { type: 'application/pdf' });

    const hash1 = await computeFileContentFingerprint(file1);
    const hash2 = await computeFileContentFingerprint(file2);
    expect(hash1).toBe(hash2);

    const order = buildBaseOrder();
    order.invoices![0].collection!.paymentsHistory = [
      {
        receiptId: 'REC-1',
        amount: 50000,
        date: '2026-10-09',
        reference: 'SPEI-HASH-TEST',
        fileSha256: hash1,
      } as any,
    ];

    const match = findExistingPayment([order], undefined, 50000, '2026-10-09', hash2);
    expect(match.isDuplicate).toBe(true);
    expect(match.reason).toContain('Huella digital SHA-256');
  });

  // 9. Dos comprobantes con metadatos similares pero hashes distintos no chocan falsamente
  it('9. Dos comprobantes con mismo monto y fecha pero distinto hash no generan falso positivo', async () => {
    const fileA = new File(['PAYMENT-RECORD-BATCH-A'], 'pago_a.pdf', { type: 'application/pdf' });
    const fileB = new File(['PAYMENT-RECORD-BATCH-B'], 'pago_b.pdf', { type: 'application/pdf' });

    const hashA = await computeFileContentFingerprint(fileA);
    const hashB = await computeFileContentFingerprint(fileB);

    const order = buildBaseOrder();
    order.invoices![0].collection!.paymentsHistory = [
      {
        receiptId: 'REC-A',
        amount: 25000,
        date: '2026-10-09',
        reference: 'REF-ALPHA',
        fileSha256: hashA,
      } as any,
    ];

    const match = findExistingPayment([order], 'REF-BETA', 25000, '2026-10-09', hashB);
    expect(match.isDuplicate).toBe(false);
  });

  // 10. Bloqueo de concurrencia y doble clic en vuelo (inFlightOperations)
  it('10. Bloquea llamadas simultáneas con la misma huella mientras una está en vuelo', async () => {
    const order = buildBaseOrder();
    const testFile = new File(['UNIQUE-FILE-IN-FLIGHT-TEST-DATA'], 'in_flight.pdf', { type: 'application/pdf' });

    const analysis: PipelineAnalysis = {
      file: testFile,
      docType: 'factura_cfdi',
      confidence: 'alta',
      folio: '7555',
      uuid: 'UUID-FLIGHT-TEST',
      matchedOrder: order,
      isDuplicate: false,
      kilos: 500,
      subtotal: 21500,
      total: 24940,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    // Lanzar dos promesas concurrentes
    const promise1 = applyDocumentFast(analysis, order);
    const promise2 = applyDocumentFast(analysis, order);

    const [res1, res2] = await Promise.all([promise1, promise2]);

    // Una debe tener éxito y la otra ser rechazada por concurrencia
    const successCount = [res1.success, res2.success].filter(Boolean).length;
    const lockedCount = [res1.message, res2.message].filter((m) => m?.includes('Operación en curso')).length;

    expect(successCount).toBe(1);
    expect(lockedCount).toBe(1);
  });

  // 11. Reporte coordinado cuando falla la subida a Storage (storageWarning)
  it('11. Reporta storageWarning claramente si la subida a Storage falla tras procesar el documento', async () => {
    mockUploadError = true;
    const order = buildBaseOrder();
    const storageFailFile = new File(['STORAGE-FAIL-DATA-123'], 'storage_fail.pdf', { type: 'application/pdf' });

    const analysis: PipelineAnalysis = {
      file: storageFailFile,
      docType: 'factura_cfdi',
      confidence: 'alta',
      folio: '7788',
      uuid: 'UUID-STORAGE-FAIL',
      matchedOrder: order,
      isDuplicate: false,
      kilos: 500,
      subtotal: 21500,
      total: 24940,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const result = await applyDocumentFast(analysis, order);
    expect(result.success).toBe(true);
    expect(result.storageWarning).toBe(true);
    expect(result.message).toContain('ocurrió un error al respaldar el archivo en Storage');
  });

  // 12. Registro de auditoría en importación manual forzada con logMandatoryAction
  it('12. Registra auditoría obligatoria cuando se provee manualDecisionAudit', async () => {
    const order = buildBaseOrder();
    const auditFile = new File(['AUDIT-TEST-DATA-999'], 'audited_import.pdf', { type: 'application/pdf' });

    const analysis: PipelineAnalysis = {
      file: auditFile,
      docType: 'factura_cfdi',
      confidence: 'alta',
      folio: '7999',
      uuid: 'UUID-AUDIT-TEST',
      matchedOrder: order,
      isDuplicate: false,
      kilos: 500,
      subtotal: 21500,
      total: 24940,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
      manualDecisionAudit: {
        user: 'supervisor@ruenisco.com',
        date: '2026-10-09T10:00:00Z',
        reason: 'Resolución de discrepancia de folio autorizada',
      },
    };

    const auditParams = {
      manualDecisionAudit: {
        userEmail: 'supervisor@ruenisco.com',
        reason: 'Resolución de discrepancia de folio autorizada',
        selectedOrderId: order.id,
      },
    };

    const result = await applyDocumentFast(analysis, order, undefined, auditParams);
    expect(result.success).toBe(true);
    expect(mockLogMandatoryAction).toHaveBeenCalledWith(
      'supervisor@ruenisco.com',
      'FORCED_DOCUMENT_IMPORT',
      expect.objectContaining({
        orderId: order.id,
        folio: '7999',
      })
    );
  });

  // 13. Dos pagos distintos de la misma orden no se bloquean como duplicados
  it('13. Dos pagos distintos de la misma orden con referencias bancarias diferentes no se confunden ni se bloquean', () => {
    const order = buildBaseOrder();
    order.invoices![0].collection!.paymentsHistory = [
      {
        receiptId: 'SPEI-PAGO-01',
        amount: 25000,
        reference: 'SPEI-PAGO-01',
        date: '2026-10-09',
      } as any,
    ];

    // Pago 2 con diferente referencia bancaria y monto idéntico
    const resultDup = findExistingPayment([order], {
      trackingKey: 'SPEI-PAGO-02',
      bankReference: 'REF-BANCARIA-02',
      amount: 25000,
      date: '2026-10-09',
    });

    expect(resultDup.isDuplicate).toBe(false);
  });

  // 14. Idempotencia intersesión: comprobante con la misma referencia bancaria se detecta como duplicado
  it('14. Comprobante con la misma referencia bancaria se detecta de inmediato como duplicado', () => {
    const order = buildBaseOrder();
    order.invoices![0].collection!.paymentsHistory = [
      {
        receiptId: 'SPEI-YA-APLICADO-777',
        amount: 50000,
        reference: 'SPEI-YA-APLICADO-777',
        date: '2026-10-09',
      } as any,
    ];

    const resultDup = findExistingPayment([order], {
      trackingKey: 'SPEI-YA-APLICADO-777',
      amount: 50000,
      date: '2026-10-09',
    });

    expect(resultDup.isDuplicate).toBe(true);
    expect(resultDup.reason).toContain('SPEI-YA-APLICADO-777');
  });

  // 15. Fallo de auditoría obligatoria no deja la operación forzada sin trazabilidad
  it('15. Falla de bitácora obligatoria aborta la operación forzada y no crea registros', async () => {
    mockLogMandatoryAction.mockRejectedValueOnce(new Error('Network audit log failed'));
    const order = buildBaseOrder();
    const auditFile = new File(['AUDIT-FAIL-DATA'], 'audited_fail.pdf', { type: 'application/pdf' });

    const analysis: PipelineAnalysis = {
      file: auditFile,
      docType: 'factura_cfdi',
      confidence: 'alta',
      folio: '7998',
      matchedOrder: order,
      isDuplicate: false,
      kilos: 500,
      subtotal: 21500,
      total: 24940,
      docDate: '2026-10-09',
      detectedOcNumber: '12026439784',
      autoAssignedLabel: '',
      needsClarification: false,
      forceApply: true,
      manualDecisionAudit: {
        user: 'admin@ruenisco.com',
        date: '2026-10-09T10:00:00Z',
        reason: 'Forzada',
      },
    };

    const result = await applyDocumentFast(analysis, order);
    expect(result.success).toBe(false);
    expect(result.message).toContain('falló el registro obligatorio en la bitácora de auditoría');
  });

  // 16. Rechazo de contrarrecibo si excede el límite de 500 operaciones atómicas
  it('16. Rechaza contrarrecibo antes de escribir si ampara más de 500 órdenes distintas', async () => {
    const hugeOrdersList: PurchaseOrder[] = [];
    const foliosToAmparar: string[] = [];

    for (let i = 0; i < 505; i++) {
      const o = buildBaseOrder(`ord-bulk-${i}`, `FOLIO-${i}`);
      o.invoices![0].id = `inv-bulk-${i}`;
      o.invoices![0].folio = `FAC-${i}`;
      hugeOrdersList.push(o);
      foliosToAmparar.push(`FAC-${i}`);
    }

    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'alta',
      folio: 'CR-OVERSIZED-500',
      contrareciboNumber: 'CR-OVERSIZED-500',
      facturaFolios: foliosToAmparar,
      matchedOrder: hugeOrdersList[0],
      isDuplicate: false,
      kilos: 0,
      subtotal: 5000000,
      total: 5000000,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const result = await applyDocumentFast(analysis, hugeOrdersList[0], hugeOrdersList);
    expect(result.success).toBe(false);
    expect(result.reviewReason).toContain('límite atómico de 500 órdenes');
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  // 17. Atomicidad estricta en batch.commit: si falla, no se ejecuta ningún fallback secuencial
  it('17. Si writeBatch.commit falla, retorna error atómico y no realiza escrituras parciales', async () => {
    mockBatchCommit.mockRejectedValueOnce(new Error('Simulated writeBatch.commit atomic failure'));
    const { safeUpdateDoc } = await import('../safeFirestore');
    vi.mocked(safeUpdateDoc).mockClear();

    const order1 = buildBaseOrder('ord-1', '43/9784');
    const order2 = buildBaseOrder('ord-2', '71/14302');
    order2.invoices![0].id = 'inv-202';
    order2.invoices![0].folio = '6354';

    const analysis: PipelineAnalysis = {
      file: mockFile,
      docType: 'contrarecibo',
      confidence: 'alta',
      folio: 'CR-ATOMIC-FAIL',
      contrareciboNumber: 'CR-ATOMIC-FAIL',
      facturaFolios: ['6353', '6354'],
      matchedOrder: order1,
      isDuplicate: false,
      kilos: 0,
      subtotal: 100000,
      total: 100000,
      docDate: '2026-10-09',
      detectedOcNumber: '',
      autoAssignedLabel: '',
      needsClarification: false,
    };

    const result = await applyDocumentFast(analysis, order1, [order1, order2]);
    expect(result.success).toBe(false);
    expect(result.message).toContain('El lote fue cancelado por completo y ninguna orden fue alterada');
    // Verificar que NO hubo llamadas al fallback secuencial safeUpdateDoc
    expect(safeUpdateDoc).not.toHaveBeenCalled();
  });
});

