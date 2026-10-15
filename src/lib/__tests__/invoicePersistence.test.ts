import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DEFAULT_CONFIG, type Invoice, type PurchaseOrder } from '../types';
import { computeFinancials } from '../finance';

const state = vi.hoisted(() => ({ order: {} as PurchaseOrder, toast: vi.fn(), mirrors: new Map<string, Invoice>(), updates: [] as Record<string, unknown>[] }));
vi.mock('../firebase', () => ({ db: {}, PATHS: { orders: 'orders', invoices: 'invoices' } }));
vi.mock('../../hooks/useOrders', () => ({ useOrders: () => ({ orders: [state.order] }) }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ user: { email: 'test@example.com' } }) }));
vi.mock('../../context/ToastContext', () => ({ useToast: () => state.toast }));
vi.mock('../logger', () => ({ logAction: vi.fn() }));
vi.mock('../confirmDialog', () => ({ confirmDialog: vi.fn(async () => true) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  doc: (_db: unknown, path: string, id: string) => ({ path, id }),
  runTransaction: async (_db: unknown, action: (tx: unknown) => Promise<void>) => {
    const pending: (() => void)[] = [];
    const tx = {
      get: async () => ({ exists: () => true, data: () => structuredClone(state.order) }),
      update: (_ref: unknown, payload: Record<string, unknown>) => pending.push(() => {
        state.updates.push(payload); state.order = { ...state.order, ...payload };
      }),
      set: (ref: { id: string }, invoice: Invoice) => pending.push(() => state.mirrors.set(ref.id, invoice)),
      delete: (ref: { id: string }) => pending.push(() => state.mirrors.delete(ref.id)),
    };
    await action(tx);
    pending.forEach(write => write());
  },
}));

import { useInvoiceActions } from '../../components/OrderModal/useInvoiceActions';

function actions() {
  let result!: ReturnType<typeof useInvoiceActions>;
  function Probe() { result = useInvoiceActions(); return null; }
  renderToStaticMarkup(createElement(Probe));
  return result;
}
function invoice(id: string, kilos: number): Invoice {
  return { id, orderId: 'o1', folio: id, kilos, financials: computeFinancials(kilos, DEFAULT_CONFIG), creditCycle: { status: 'pending' }, collection: { paidAmount: 0 } };
}

beforeEach(() => {
  state.order = { id: 'o1', oc: 'OC1', client: 'Cliente', department: 'TH', totalKilograms: 1000, customCostPrice: 38,
    creditCycle: { status: 'pedido' }, deliveries: [{ id: 'd1', date: null, kilos: 1000 }], invoices: [] };
  state.toast.mockClear(); state.mirrors.clear(); state.updates = [];
});

describe('Persistencia real de facturas con transacción simulada', () => {
  it('conserva la primera factura y rechaza sobreconsumo de una captura desactualizada', async () => {
    const stale = structuredClone(state.order);
    const handler = actions();
    await handler.saveInvoice(stale, invoice('A', 500), DEFAULT_CONFIG);
    await expect(handler.saveInvoice(stale, invoice('B', 600), DEFAULT_CONFIG)).rejects.toThrow('saldo disponible');
    expect(state.order.invoices?.map(inv => inv.id)).toEqual(['A']);
    expect(state.mirrors.has('A')).toBe(true);
    expect(state.mirrors.has('B')).toBe(false);
  });
  it('editar solo el folio conserva la asignación parcial sin consumir más kilos', async () => {
    const handler = actions();
    await handler.saveInvoice(state.order, invoice('A', 400), DEFAULT_CONFIG);
    const before = structuredClone(state.order.deliveries);
    await handler.saveInvoice(state.order, { ...state.order.invoices![0], folio: 'F-EDITADO' }, DEFAULT_CONFIG);
    expect(state.order.deliveries).toEqual(before);
    expect(state.mirrors.get('A')?.folio).toBe('F-EDITADO');
  });
  it('recalcula comisión y utilidad con los importes reales de conceptos de distinto precio', async () => {
    const inv = invoice('A', 100);
    inv.financials!.saleTotal = 5000;
    inv.financials!.invoiceTotal = 5800;
    await actions().saveInvoice(state.order, inv, DEFAULT_CONFIG);
    expect(state.mirrors.get('A')?.financials?.commission).toBe(400);
    expect(state.mirrors.get('A')?.financials?.tradeMargin).toBe(1200);
    expect(state.mirrors.get('A')?.financials?.netCashFlow).toBe(800);
  });
  it('eliminar la última factura conserva la OC y libera sus entregas', async () => {
    const handler = actions();
    await handler.saveInvoice(state.order, invoice('A', 1000), DEFAULT_CONFIG);
    await handler.deleteInvoice(state.order, 'A');
    expect(state.order.isDeleted).not.toBe(true);
    expect(state.order.invoices).toEqual([]);
    expect(state.order.deliveries?.[0].invoicedKilos).toBe(0);
    expect(state.mirrors.has('A')).toBe(false);
  });
  it('bloquea eliminar una factura con abonos sin modificar la caja ni la OC', async () => {
    const handler = actions();
    const inv = invoice('A', 100);
    inv.collection!.paidAmount = 500;
    state.order.invoices = [inv];
    await expect(handler.deleteInvoice(state.order, 'A')).rejects.toThrow('Revierte primero');
    expect(state.order.invoices).toEqual([inv]);
    expect(state.updates).toEqual([]);
  });
  it('una edición desactualizada no borra un pago registrado por otra persona', async () => {
    const handler = actions();
    await handler.saveInvoice(state.order, invoice('A', 400), DEFAULT_CONFIG);
    const stale = structuredClone(state.order);
    state.order.invoices![0].collection!.paidAmount = 1000;
    await expect(handler.saveInvoice(stale, { ...stale.invoices![0], folio: 'F-EDITADO' }, DEFAULT_CONFIG)).rejects.toThrow('cambió');
    expect(state.order.invoices![0].collection?.paidAmount).toBe(1000);
  });
});
