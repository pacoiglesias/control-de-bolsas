import { describe, it, expect } from 'vitest';
import { evaluateDocumentOperation } from '../autoDocumentProcessor';
import type { PurchaseOrder, FinancialConfig } from '../types';
import type { ExtractedDocumentData } from '../../components/Recepcion/SmartDocumentDropzone';

describe('Motor Autónomo de Procesamiento y Detección de Dudas (autoDocumentProcessor)', () => {
  const dummyConfig: FinancialConfig = {
    salePricePerKg: 43,
    costPricePerKg: 38,
    commissionRate: 0.08,
    creditDays: 30,
    ivaRate: 0.16,
    commissionBase: 'subtotal',
  };

  const existingOrder9753: PurchaseOrder = {
    id: 'oc-12026439753',
    oc: '12026439753',
    folio: '43/9753',
    client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
    department: 'GT',
    totalKilograms: 4500,
    creditCycle: { status: 'facturado' },
    invoices: [
      {
        id: 'inv-6275',
        orderId: 'oc-12026439753',
        folio: '6275',
        uuid: '87880E51-F888-444A-8431-98E7DB28B2B7',
        kilos: 1234,
        creditCycle: { status: 'pending' },
      },
    ],
  };

  it('detecta y crea automáticamente una nueva OC cuando no existe en el ERP', () => {
    const newOcDoc: ExtractedDocumentData = {
      type: 'orden_compra',
      oc: '12026439774',
      ocFolio: '12026439774',
      folio: '43/9774',
      kilos: 298,
      client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: 'GT',
      confidence: 1.0,
      items: [
        {
          code: 'EGBO000017-SC',
          description: 'BOLSA POLIETILENO 1.20 M X 1.60 M',
          quantity: 298,
          unitPrice: 43,
          amount: 12814,
        },
      ],
    };

    const decision = evaluateDocumentOperation(newOcDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('auto_create_oc');
    if (decision.type === 'auto_create_oc') {
      expect(decision.ocNumber).toBe('12026439774');
      expect(decision.kilos).toBe(298);
      expect(decision.department).toBe('GT');
    }
  });

  it('pregunta (DUDA) si se intenta cargar una OC que ya existe previamente', () => {
    const duplicateOcDoc: ExtractedDocumentData = {
      type: 'orden_compra',
      oc: '12026439753',
      folio: '43/9753',
      kilos: 4500,
      confidence: 1.0,
    };

    const decision = evaluateDocumentOperation(duplicateOcDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('oc_already_exists');
      expect(decision.suggestedActions.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('vincula automáticamente una Factura cuando la OC coincide y no hay duplicados', () => {
    const invoiceDoc: ExtractedDocumentData = {
      type: 'pdf_document',
      folio: '6284',
      uuid: '7CCA53C2-863F-4244-96CE-B0B61E2C26FC',
      oc: '12026439753',
      kilos: 1241,
      total: 61901.08,
      confidence: 0.95,
    };

    const decision = evaluateDocumentOperation(invoiceDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('auto_assign_invoice');
    if (decision.type === 'auto_assign_invoice') {
      expect(decision.invoiceFolio).toBe('6284');
      expect(decision.targetOrder.id).toBe('oc-12026439753');
    }
  });

  it('pregunta (DUDA) si la factura es duplicada (mismo folio o UUID ya en la OC)', () => {
    const duplicateInvoice: ExtractedDocumentData = {
      type: 'pdf_document',
      folio: '6275',
      uuid: '87880E51-F888-444A-8431-98E7DB28B2B7',
      oc: '12026439753',
      kilos: 1234,
      total: 61551.92,
      confidence: 0.95,
    };

    const decision = evaluateDocumentOperation(duplicateInvoice, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('duplicate_invoice');
      expect(decision.suggestedActions.some((a) => a.actionType === 'replace_invoice')).toBe(true);
    }
  });

  it('pregunta (DUDA) cuando la Factura no trae OC y no hay match exacto', () => {
    const orphanInvoice: ExtractedDocumentData = {
      type: 'pdf_document',
      folio: '9999',
      uuid: 'FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF',
      kilos: 800,
      total: 39904,
      confidence: 0.95,
    };

    const decision = evaluateDocumentOperation(orphanInvoice, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('no_matching_oc');
      expect(decision.suggestedActions.some((a) => a.actionType === 'create_new_oc')).toBe(true);
    }
  });

  it('vincula automáticamente un Contrarecibo cuando las facturas amparadas existen en una orden activa', () => {
    const crDoc: ExtractedDocumentData = {
      type: 'contrarecibo',
      contrarecibo: 'GT-904',
      folio: '6275',
      facturaFolios: ['6275'],
      total: 61551.92,
      dueDate: '25/09/2026',
      confidence: 1.0,
    };

    const decision = evaluateDocumentOperation(crDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('auto_assign_contrarecibo');
    if (decision.type === 'auto_assign_contrarecibo') {
      expect(decision.crNumber).toBe('GT-904');
      expect(decision.facturaFolios).toContain('6275');
      expect(decision.targetOrders.length).toBe(1);
      expect(decision.targetOrders[0].id).toBe('oc-12026439753');
    }
  });

  it('pregunta (DUDA) si el Contrarecibo ampara una factura inexistente en el ERP', () => {
    const unknownCrDoc: ExtractedDocumentData = {
      type: 'contrarecibo',
      contrarecibo: 'TH-9999',
      folio: '8888',
      facturaFolios: ['8888'],
      total: 50000,
      confidence: 1.0,
    };

    const decision = evaluateDocumentOperation(unknownCrDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('no_matching_oc');
      expect(decision.question).toContain('TH-9999');
      expect(decision.suggestedActions.some((a) => a.actionType === 'assign_to_order')).toBe(true);
    }
  });

  it('genera duda cuando una factura ya existe en el expediente (duplicate_invoice)', () => {
    const dupInvoiceDoc: ExtractedDocumentData = {
      type: 'xml_factura',
      folio: '6275',
      oc: '12026439753',
      kilos: 500,
      total: 25000,
      confidence: 1.0,
    };

    const decision = evaluateDocumentOperation(dupInvoiceDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('duplicate_invoice');
      expect(decision.suggestedActions.some((a) => a.id === 'replace_invoice')).toBe(true);
    }
  });

  it('genera duda cuando los kilos exceden el remanente de la OC (kilos_exceeded)', () => {
    const overKgInvoiceDoc: ExtractedDocumentData = {
      type: 'xml_factura',
      folio: '7000',
      oc: '12026439753',
      kilos: 8000, // Meta 4500, restan 3266
      total: 400000,
      confidence: 1.0,
    };

    const decision = evaluateDocumentOperation(overKgInvoiceDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('kilos_exceeded');
    }
  });

  it('genera duda cuando el tipo de documento es desconocido', () => {
    const unknownDoc: ExtractedDocumentData = {
      type: 'desconocido' as any,
      fileName: 'archivo_raro.pdf',
      confidence: 0.1,
    };

    const decision = evaluateDocumentOperation(unknownDoc, [existingOrder9753], dummyConfig);
    expect(decision.type).toBe('doubt');
    if (decision.type === 'doubt') {
      expect(decision.doubtType).toBe('unknown_document');
    }
  });
});


