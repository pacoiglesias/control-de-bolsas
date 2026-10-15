import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { buildReceivables } from '../receivables';
import { DEFAULT_CONFIG, type Invoice, type PurchaseOrder } from '../types';
import { computeFinancials } from '../finance';
const inv = (id: string, changes: Partial<Invoice> = {}): Invoice => ({ id, orderId: 'o', kilos: 100, financials: computeFinancials(100, DEFAULT_CONFIG), creditCycle: { status: 'pending' }, ...changes });
const order = (invoices: Invoice[], changes: Partial<PurchaseOrder> = {}): PurchaseOrder => ({ id: 'o', totalKilograms: 1000, invoices, ...changes });
describe('Cartera compartida', () => {
  it('suma todas las facturas de un CR y descuenta abonos', () => {
    const result = buildReceivables([order([inv('1', { collection: { contrareciboNumber: 'TH-1', paidAmount: 1000 } }), inv('2', { collection: { contrareciboNumber: 'TH-1' } })])]);
    expect(result.total).toBe(8976); expect(result.withCR).toBe(8976); expect(result.crCount).toBe(1); expect(result.rows).toHaveLength(2);
  });
  it('incluye facturas en revisión y excluye deuda liquidada sin perder el historial', () => {
    const result = buildReceivables([order([inv('1', { creditCycle: { status: 'manual_review' } }), inv('2', { creditCycle: { status: 'paid' } }), inv('3', { creditCycle: { status: 'collected' } })])]);
    expect(result.total).toBe(4988); expect(result.paid).toBe(9976); expect(result.rows).toHaveLength(3);
  });
  it('no fabrica deuda desde pedidos sin factura ni hereda CR de la orden', () => {
    expect(buildReceivables([order([])]).total).toBe(0);
    expect(buildReceivables([order([inv('1')], { collection: { contrareciboNumber: 'TH-AJENO' } })]).withoutCR).toBe(4988);
  });
  it('deduplica UUID fiscal sin confundir folios entre órdenes', () => {
    expect(buildReceivables([order([inv('1', { uuid: 'abc' })]), order([inv('2', { uuid: 'ABC' })], { id: 'o2' })]).total).toBe(4988);
    expect(buildReceivables([order([inv('1')]), order([inv('1')], { id: 'o2' })]).total).toBe(9976);
  });
  it('respeta cero, limita abonos y excluye papelera', () => {
    expect(buildReceivables([order([inv('1', { financials: computeFinancials(0, DEFAULT_CONFIG) })])]).total).toBe(0);
    expect(buildReceivables([order([inv('1', { collection: { paidAmount: 9000 } })])]).total).toBe(0);
    expect(buildReceivables([order([inv('1')], { isDeleted: true })]).rows).toHaveLength(0);
  });
  it('vence al día siguiente de la fecha límite y conserva el saldo parcial', () => {
    const invoices = [inv('1', { creditCycle: { status: 'pending', dueDate: Timestamp.fromDate(new Date(2026, 9, 15)) }, collection: { paidAmount: 1000 } })];
    expect(buildReceivables([order(invoices)], DEFAULT_CONFIG, new Date(2026, 9, 15, 12)).overdue).toBe(0);
    expect(buildReceivables([order(invoices)], DEFAULT_CONFIG, new Date(2026, 9, 16, 12)).overdue).toBe(3988);
  });
});
