import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { buildOperationalTasks } from '../operationalTasks';
import { DEFAULT_CONFIG, type Invoice, type PurchaseOrder } from '../types';
import { computeFinancials } from '../finance';

const now = new Date(2026, 9, 14, 12);
const inv = (overrides: Partial<Invoice> = {}): Invoice => ({ id: 'i1', orderId: 'o1', folio: 'F-10', kilos: 400,
  financials: computeFinancials(400, DEFAULT_CONFIG), creditCycle: { status: 'pending', dueDate: Timestamp.fromDate(new Date(2026, 9, 10, 12)) },
  collection: { paidAmount: 1000 }, ...overrides });
const order = (overrides: Partial<PurchaseOrder> = {}): PurchaseOrder => ({ id: 'o1', client: 'Cliente', department: 'TH', oc: 'OC-1',
  totalKilograms: 1000, creditCycle: { status: 'pedido' }, deliveries: [{ id: 'd1', date: null, kilos: 1000 }], invoices: [inv()], ...overrides });

describe('Próxima acción operativa', () => {
  it('muestra facturación y cobranza incluso al cerrar la producción', () => {
    const tasks = buildOperationalTasks([order({ isClosedShort: true })], now);
    expect(tasks.map(task => task.category)).toEqual(['receipt', 'invoice']);
    expect(tasks.find(task => task.category === 'invoice')?.kilos).toBe(600);
  });
  it('presenta una sola acción por factura y el saldo tras pagos parciales', () => {
    const tasks = buildOperationalTasks([order({ invoices: [inv({ collection: { contrareciboNumber: 'TH-1', paidAmount: 1000 } })] })], now);
    const invoiceTasks = tasks.filter(task => task.invoiceId === 'i1');
    expect(invoiceTasks).toHaveLength(1);
    expect(invoiceTasks[0].category).toBe('collection');
    expect(invoiceTasks[0].amount).toBe(18952);
    expect(invoiceTasks[0].urgent).toBe(true);
  });
  it('un pago confirmado solicita ingreso a caja y una factura liquidada desaparece', () => {
    expect(buildOperationalTasks([order({ invoices: [inv({ creditCycle: { status: 'paid' } })] })], now).find(task => task.invoiceId)?.category).toBe('cash');
    expect(buildOperationalTasks([order({ invoices: [inv({ creditCycle: { status: 'collected' } })] })], now).filter(task => task.invoiceId)).toEqual([]);
  });
  it('no hereda un contrarrecibo ajeno desde la cabecera de la orden', () => {
    const tasks = buildOperationalTasks([order({ collection: { contrareciboNumber: 'TH-AJENO' } })], now);
    expect(tasks.find(task => task.invoiceId)?.category).toBe('receipt');
  });
  it('suma partidas de báscula y no crea entregas físicas a partir de facturas', () => {
    const tasks = buildOperationalTasks([order({ deliveries: [{ id: 'd1', date: null, kilos: 0, items: [{ itemId: 'p1', quantity: 700 }] }] })], now);
    expect(tasks.find(task => task.category === 'invoice')?.kilos).toBe(300);
    expect(tasks.find(task => task.category === 'delivery')?.kilos).toBe(300);
    expect(buildOperationalTasks([order({ deliveries: [] })], now).some(task => task.category === 'invoice')).toBe(false);
  });
  it('excluye papelera y distingue fechas vencidas de entregas futuras', () => {
    expect(buildOperationalTasks([order({ isDeleted: true })], now)).toEqual([]);
    const tasks = buildOperationalTasks([order({ invoices: [], deliveries: [], estimatedDeliveryDate: Timestamp.fromDate(new Date(2026, 9, 20, 12)) })], now);
    expect(tasks[0].category).toBe('delivery');
    expect(tasks[0].urgent).toBe(false);
  });
});
