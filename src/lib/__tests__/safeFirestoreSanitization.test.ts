import { describe, it, expect } from 'vitest';
import { cleanUndefined } from '../cleanUndefined';
import { Timestamp, deleteField, serverTimestamp } from 'firebase/firestore';

describe('Sanitización Total de Escrituras en Firestore (cleanUndefined & safeFirestore)', () => {
  it('elimina campos undefined en objetos simples de primer nivel', () => {
    const input = {
      folio: '6363',
      uuid: undefined,
      kilos: 500,
      notes: undefined,
    };

    const cleaned = cleanUndefined(input);
    expect(cleaned).toEqual({
      folio: '6363',
      kilos: 500,
    });
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'uuid')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'notes')).toBe(false);
  });

  it('elimina recursivamente campos undefined en objetos anidados', () => {
    const input = {
      orderId: 'oc-120267114302',
      collection: {
        contrareciboNumber: 'TH-990',
        transferRef: undefined,
        paidAmount: 50000,
        nested: {
          deepUndefined: undefined,
          deepValue: 'ok',
        },
      },
      creditCycle: {
        status: 'pending',
        dueDate: undefined,
      },
    };

    const cleaned = cleanUndefined(input);
    expect(cleaned).toEqual({
      orderId: 'oc-120267114302',
      collection: {
        contrareciboNumber: 'TH-990',
        paidAmount: 50000,
        nested: {
          deepValue: 'ok',
        },
      },
      creditCycle: {
        status: 'pending',
      },
    });
  });

  it('ELIMINA campos undefined dentro de objetos en arrays (Caso exacto del error en factura_cfdi)', () => {
    // Simula exactamente el caso donde se metió una factura PDF sin UUID:
    // uuid: extractedUuid || undefined
    const extractedUuid = '';
    const newInvoice = {
      id: 'inv-12345',
      folio: '6363',
      uuid: extractedUuid || undefined,
      kilos: 1000,
      financials: {
        salePricePerKg: 43,
        saleTotal: 43000,
      },
    };

    const existingInvoices = [
      { id: 'inv-prev', folio: '6198', kilos: 2000 },
    ];

    const payload = {
      invoices: [...existingInvoices, newInvoice],
      updatedAt: Timestamp.now(),
    };

    const cleaned = cleanUndefined(payload);

    // Verificar que en el array no hay ningún campo con valor undefined
    expect(cleaned.invoices.length).toBe(2);
    expect(cleaned.invoices[1].folio).toBe('6363');
    expect(Object.prototype.hasOwnProperty.call(cleaned.invoices[1], 'uuid')).toBe(false);
    expect((cleaned.invoices[1] as any).uuid).toBeUndefined();

    // Comprobar serialización / verificación estricta de Firestore
    const stringified = JSON.stringify(cleaned);
    expect(stringified).not.toContain('"uuid"');
  });

  it('filtra elementos undefined dentro de arrays primitivos y limpia objetos mixtos', () => {
    const input = {
      list: ['item1', undefined, 'item2', null],
      subList: [
        { id: 1, missing: undefined, keep: 'yes' },
        undefined,
        { id: 2, other: 123 },
      ],
    };

    const cleaned = cleanUndefined(input);
    expect(cleaned.list).toEqual(['item1', 'item2', null]);
    expect(cleaned.subList).toEqual([
      { id: 1, keep: 'yes' },
      { id: 2, other: 123 },
    ]);
  });

  it('preserva intactos Date, Timestamp y FieldValues de Firestore (serverTimestamp, deleteField)', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    const ts = Timestamp.fromDate(now);
    const delField = deleteField();
    const sTs = serverTimestamp();

    const input = {
      date: now,
      timestamp: ts,
      deletedAudit: delField,
      serverTime: sTs,
      normalProp: 'valido',
      badProp: undefined,
    };

    const cleaned = cleanUndefined(input);
    expect(cleaned.date).toBe(now);
    expect(cleaned.timestamp).toBe(ts);
    expect(cleaned.deletedAudit).toBe(delField);
    expect(cleaned.serverTime).toBe(sTs);
    expect(cleaned.normalProp).toBe('valido');
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'badProp')).toBe(false);
  });

  it('maneja de forma segura valores primitivos, null, y strings vacíos', () => {
    expect(cleanUndefined(null)).toBe(null);
    expect(cleanUndefined(undefined)).toBe(null);
    expect(cleanUndefined(0)).toBe(0);
    expect(cleanUndefined(false)).toBe(false);
    expect(cleanUndefined('')).toBe('');
    expect(cleanUndefined('texto')).toBe('texto');
    expect(cleanUndefined({})).toEqual({});
    expect(cleanUndefined([])).toEqual([]);
  });

  it('soporta claves de actualización por dot-notation en Firestore (ej. collection.paidAmount)', () => {
    const input = {
      'collection.paidAmount': 98054.60,
      'collection.transferRef': undefined,
      'creditCycle.status': 'collected',
      'creditCycle.dueDate': undefined,
    };

    const cleaned = cleanUndefined(input);
    expect(cleaned).toEqual({
      'collection.paidAmount': 98054.60,
      'creditCycle.status': 'collected',
    });
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'collection.transferRef')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'creditCycle.dueDate')).toBe(false);
  });
});
