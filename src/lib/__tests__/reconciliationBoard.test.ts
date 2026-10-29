import { describe, it, expect } from 'vitest';
import {
  buildReconciliationDiscrepancies,
  deliveredKilos,
} from '../reconciliationBoard';
import { DEFAULT_CONFIG, type PurchaseOrder } from '../types';

function order(over: Partial<PurchaseOrder>): PurchaseOrder {
  return { id: 'o1', ...over } as PurchaseOrder;
}

function invoice(over: any) {
  return {
    id: 'inv-1',
    orderId: 'o1',
    folio: 'F1',
    kilos: 0,
    creditCycle: { status: 'pending' },
    ...over,
  };
}

describe('deliveredKilos', () => {
  it('suma items de entrega y excluye las inferidas de factura', () => {
    const o = order({
      deliveries: [
        { id: 'd1', kilos: 500, items: [{ itemId: 'i1', quantity: 300 }] },
        { id: 'd2', kilos: 999, inferredFromInvoice: true },
      ] as any,
    });
    expect(deliveredKilos(o)).toBe(300);
  });
});

describe('buildReconciliationDiscrepancies', () => {
  it('detecta entregado sin facturar con su monto', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc1',
          oc: '120267114400',
          deliveries: [{ id: 'd1', kilos: 1000 } as any],
          invoices: [],
        }),
      ],
      DEFAULT_CONFIG
    );
    const d = out.find((x) => x.kind === 'delivered_not_invoiced');
    expect(d).toBeDefined();
    expect(d!.kilos).toBe(1000);
    // 1000 kg × $43 × 1.16 IVA
    expect(d!.amount).toBe(49880);
  });

  it('detecta facturas sin OC en expedientes huérfanos', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'exp1',
          folio: '6438',
          invoices: [invoice({ kilos: 1325 })],
          items: [],
          deliveries: [],
        }),
      ],
      DEFAULT_CONFIG
    );
    expect(out.some((x) => x.kind === 'invoice_without_oc')).toBe(true);
  });

  it('no marca sin OC a una OC con partidas aunque le falte el campo oc', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc2',
          items: [{ id: 'i1', quantity: 100, unitPrice: 43 } as any],
          invoices: [invoice({ kilos: 100 })],
          deliveries: [],
        }),
      ],
      DEFAULT_CONFIG
    );
    expect(out.some((x) => x.kind === 'invoice_without_oc')).toBe(false);
  });

  it('detecta precio distinto al de la OC', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc3',
          oc: '120267114400',
          financials: { salePricePerKg: 43 } as any,
          invoices: [
            invoice({ kilos: 100, financials: { saleTotal: 4400 } }),
          ],
        }),
      ],
      DEFAULT_CONFIG
    );
    expect(out.some((x) => x.kind === 'invoice_price_mismatch')).toBe(true);
  });

  it('detecta facturado por encima de lo entregado', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc4',
          oc: '120267114400',
          deliveries: [{ id: 'd1', kilos: 500 } as any],
          invoices: [invoice({ kilos: 800 })],
        }),
      ],
      DEFAULT_CONFIG
    );
    const d = out.find((x) => x.kind === 'invoice_over_delivered');
    expect(d).toBeDefined();
    expect(d!.kilos).toBe(300);
  });

  it('detecta pagos parciales con su saldo', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc5',
          oc: '120267114400',
          invoices: [
            invoice({
              kilos: 100,
              financials: { invoiceTotal: 4988 },
              collection: { paidAmount: 2000 },
            }),
          ],
        }),
      ],
      DEFAULT_CONFIG
    );
    const d = out.find((x) => x.kind === 'partial_payment');
    expect(d).toBeDefined();
    expect(d!.amount).toBe(2988);
  });

  it('una orden cuadrada y pagada no genera diferencias', () => {
    const out = buildReconciliationDiscrepancies(
      [
        order({
          id: 'oc6',
          oc: '120267114400',
          financials: { salePricePerKg: 43 } as any,
          deliveries: [{ id: 'd1', kilos: 1000 } as any],
          invoices: [
            invoice({
              kilos: 1000,
              financials: { invoiceTotal: 49880, saleTotal: 43000, salePricePerKg: 43 },
              creditCycle: { status: 'paid' },
              collection: { paidAmount: 49880 },
            }),
          ],
        }),
      ],
      DEFAULT_CONFIG
    );
    expect(out).toEqual([]);
  });
});
