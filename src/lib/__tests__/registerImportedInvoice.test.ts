import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Invoice, PurchaseOrder } from '../types';
const state = vi.hoisted(() => ({ order: {} as PurchaseOrder & {isSuperseded?: boolean}, mirrors: new Map<string, Invoice>() }));
vi.mock('../firebase', () => ({ db: {}, PATHS: { orders: 'orders', invoices: 'invoices' } }));
vi.mock('firebase/firestore', async importOriginal => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  runTransaction: async (_db: unknown, action: (transaction: unknown) => Promise<void>) => {
    const pending: (() => void)[] = [];
    await action({
      get: async (ref: {path: string; id: string}) => ({
        exists: () => ref.path === 'orders' || state.mirrors.has(ref.id),
        data: () => structuredClone(ref.path === 'orders' ? state.order : state.mirrors.get(ref.id)),
      }),
      update: (_ref: unknown, data: Partial<PurchaseOrder>) => pending.push(() => { state.order = {...state.order, ...data}; }),
      set: (ref: {id: string}, data: Invoice) => pending.push(() => state.mirrors.set(ref.id, data)),
    });
    pending.forEach(write => write());
  },
}));
import { registerImportedInvoice } from '../registerImportedInvoice';
const invoice = (id: string): Invoice => ({id, orderId: 'o1', folio: id, kilos: 100, creditCycle: {status: 'pending'}});
beforeEach(() => {
  state.order = {id: 'o1', oc: 'OC1', client: 'Cliente', department: 'TH', totalKilograms: 1000,
    creditCycle: {status: 'pedido'}, deliveries: [], invoices: []};
  state.mirrors.clear();
});
describe('Carga fiscal sin inventar entregas', () => {
  it('conserva facturas y abonos concurrentes, publica el espejo y mantiene cero entregado', async () => {
    state.order.invoices = [{...invoice('A'), collection: {paidAmount: 50}}];
    await registerImportedInvoice('o1', invoice('B'));
    expect(state.order.invoices?.map(i => i.folio)).toEqual(['A', 'B']);
    expect(state.order.invoices?.[0].collection?.paidAmount).toBe(50);
    expect(state.order.deliveries).toEqual([]);
    expect(state.mirrors.get('B')).toMatchObject({orderId: 'o1', oc: 'OC1'});
  });
  it('rechaza el reintento con otro identificador y el mismo UUID sin crear otro espejo', async () => {
    const uuid = 'AAAAAAAA-1111-2222-3333-AAAAAAAAAAAA';
    await registerImportedInvoice('o1', {...invoice('A'), uuid});
    await expect(registerImportedInvoice('o1', {...invoice('B'), uuid: uuid.toLowerCase()})).rejects.toThrow('ya está registrada');
    expect(state.mirrors.size).toBe(1);
    expect(state.order.invoices).toHaveLength(1);
  });
  it('conserva la remisión física existente sin duplicarla ni marcarla entregada de nuevo', async () => {
    state.order.deliveries = [{id: 'd1', date: null, kilos: 75, invoiced: false}];
    const before = structuredClone(state.order.deliveries);
    await registerImportedInvoice('o1', invoice('A'));
    expect(state.order.deliveries).toEqual(before);
  });
  it('rechaza documentos de una orden retirada sin escribir', async () => {
    state.order.isSuperseded = true;
    await expect(registerImportedInvoice('o1', invoice('A'))).rejects.toThrow('retirada');
    expect(state.order.invoices).toEqual([]);
    expect(state.mirrors.size).toBe(0);
  });
  it('identifica los importes del documento para que el servidor preserve precios históricos', async () => {
    const financials = {salePricePerKg: 47, costPricePerKg: 42, saleTotal: 4700, invoiceTotal: 5452,
      costTotal: 4200, commission: 376, tradeMargin: 500, netCashFlow: 876};
    await registerImportedInvoice('o1', {...invoice('A'), financials});
    expect(state.mirrors.get('A')).toMatchObject({reconciliation: {version: 1, source: 'invoice_document'},
      financials: {...financials, isEstimatedCost: false}});
  });
});
