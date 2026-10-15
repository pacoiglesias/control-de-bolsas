import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { assertDeliveryFitsOrder, buildInvoiceFromDelivery, computeItemInvoiceBreakdown, getDeliveryBilling, linkDeliveriesToInvoice, removeDeliveryAt, unmarkDeliveriesByInvoiceId } from '../deliveries';
import { DEFAULT_CONFIG, type Delivery, type PurchaseOrder } from '../types';
import { validateOrderWeightGuardrail, validateInvoiceWeightGuardrail } from '../finance';

const delivery = (kilos = 1000): Delivery => ({ id: 'd1', date: null, kilos, invoiced: false });
const order = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: 'o1', client: 'Cliente', department: 'TH', totalKilograms: 1000,
  creditCycle: { status: 'pedido' }, deliveries: [], invoices: [], ...overrides,
});

describe('Ciclo real de facturación parcial y control de entregas', () => {
  it('facturar, editar, completar y eliminar conserva los kilos de cada factura', () => {
    const source = [delivery()];
    const first = linkDeliveriesToInvoice(source, 'A', 400);
    expect(getDeliveryBilling(first[0])).toEqual({ kilos: 1000, invoicedKilos: 400, pendingKilos: 600 });
    expect(linkDeliveriesToInvoice(first, 'A', 400)).toEqual(first);
    const complete = linkDeliveriesToInvoice(first, 'B', 600);
    expect(complete[0].invoiced).toBe(true);
    expect(complete[0].invoiceId).toBe('A, B');
    const withoutA = unmarkDeliveriesByInvoiceId(complete, 'A');
    expect(getDeliveryBilling(withoutA[0]).pendingKilos).toBe(400);
    expect(withoutA[0].invoiceId).toBe('B');
    const clear = unmarkDeliveriesByInvoiceId(withoutA, 'B');
    expect(getDeliveryBilling(clear[0]).pendingKilos).toBe(1000);
    expect(clear[0].invoiceId).toBeUndefined();
    expect(source[0]).toEqual(delivery());
  });
  it('reduce y aumenta una factura sin consumir dos veces otras entregas', () => {
    const source = [delivery(), { ...delivery(500), id: 'd2' }];
    const first = linkDeliveriesToInvoice(source, 'A', 1200);
    const reduced = linkDeliveriesToInvoice(first, 'A', 700);
    expect(reduced.map(d => getDeliveryBilling(d).invoicedKilos)).toEqual([700, 0]);
    const increased = linkDeliveriesToInvoice(reduced, 'A', 1500);
    expect(increased.map(d => getDeliveryBilling(d).invoicedKilos)).toEqual([1000, 500]);
  });
  it('la eliminación protege también entregas parcialmente facturadas', () => {
    const partial = linkDeliveriesToInvoice([delivery()], 'A', 1);
    expect(removeDeliveryAt(partial, 0)).toHaveProperty('error');
  });
  it('factura exclusivamente los kilos pendientes de una entrega parcial', () => {
    const partial = linkDeliveriesToInvoice([delivery()], 'A', 400)[0];
    const result = buildInvoiceFromDelivery(partial, DEFAULT_CONFIG, 'o1');
    expect(result).toHaveProperty('kilos', 600);
    if ('invoice' in result) {
      expect(result.updatedDelivery.invoiceAllocations).toHaveLength(2);
      expect(result.invoice.financials?.saleTotal).toBe(25800);
    }
  });
  it('libera una factura histórica única sin conservar kilos facturados fantasma', () => {
    const legacy = { ...delivery(), invoiced: true, invoicedKilos: 1000, invoiceId: 'A' };
    const result = unmarkDeliveriesByInvoiceId([legacy], 'A');
    expect(getDeliveryBilling(result[0]).invoicedKilos).toBe(0);
    expect(getDeliveryBilling(linkDeliveriesToInvoice(result, 'B', 1000)[0]).pendingKilos).toBe(0);
  });
  it('no inventa un reparto para entregas históricas con vínculos ambiguos', () => {
    expect(() => unmarkDeliveriesByInvoiceId([{ ...delivery(), invoiced: true, invoiceId: 'A, B' }], 'A')).toThrow('histórica');
  });
  it('valida capacidad con el estado actual tras la entrega de otro operador', () => {
    const current = order({ deliveries: [delivery(700)] });
    expect(() => assertDeliveryFitsOrder(current, 500)).toThrow('300');
    expect(() => assertDeliveryFitsOrder(current, 300)).not.toThrow();
    expect(() => assertDeliveryFitsOrder(current, Infinity)).toThrow('válidos');
  });
  it('exige que las partidas coincidan con el total y usa su peso real', () => {
    const current = order({ deliveries: [{ ...delivery(0), items: [{ itemId: 'p1', quantity: 700 }] }] });
    expect(() => assertDeliveryFitsOrder(current, 300, [{ itemId: 'p1', quantity: 250 }])).toThrow('suma');
    expect(validateOrderWeightGuardrail(current, 400).isOverLimit).toBe(true);
    expect(() => assertDeliveryFitsOrder(order({ isClosedShort: true }), 100)).toThrow('cerrada');
  });
  it('el límite de facturación respeta las partidas cuando falta el total de cabecera', () => {
    const current = order({ totalKilograms: 0, items: [{ id: 'p1', code: 'P1', description: 'Bolsa', quantity: 500, unitPrice: 43, amount: 21500, unit: 'KGM' }] });
    expect(validateInvoiceWeightGuardrail(current, 600).isOverOrdered).toBe(true);
  });
  it('no duplica kilos cuando el código normalizado coincide con el identificador de partida', () => {
    const current = order({ items: [{ id: 'bolsa', code: 'BOLSA', description: 'Bolsa', quantity: 1000, unitPrice: 43, amount: 43000, unit: 'KGM' }],
      deliveries: [{ ...delivery(100), date: Timestamp.now(), items: [{ itemId: 'BOLSA', quantity: 100 }] }] });
    expect(computeItemInvoiceBreakdown(current)[0].alreadyDelivered).toBe(100);
  });
});
