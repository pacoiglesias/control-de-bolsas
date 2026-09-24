import { describe, it, expect } from 'vitest';
import { camposInvoices, aplicarPorId } from '../invoiceOps';
import type { Invoice } from '../types';

describe('invoiceOps', () => {
  const baseInvoice: Invoice = {
    id: 'inv-1',
    orderId: 'order-1',
    folio: 'F-100',
    kilos: 500,
    creditCycle: {
      status: 'pending',
    },
  };

  it('camposInvoices genera el objeto con status desnormalizados y updatedAt', () => {
    const invoices: Invoice[] = [
      baseInvoice,
      {
        id: 'inv-2',
        orderId: 'order-1',
        folio: 'F-101',
        kilos: 300,
        creditCycle: {
          status: 'paid',
        },
      },
      {
        id: 'inv-3',
        orderId: 'order-1',
        folio: 'F-102',
        kilos: 200,
        creditCycle: {
          // sin status — debe usarse el fallback 'pending'
        } as any,
      },
    ];

    const result = camposInvoices(invoices);
    expect(result.invoices).toBe(invoices);
    expect(result.invoiceStatuses).toEqual(['pending', 'paid', 'pending']);
    expect(result.updatedAt).toBeDefined();
  });

  it('aplicarPorId modifica la factura correspondiente sin mutar el arreglo original', () => {
    const invoices: Invoice[] = [
      { ...baseInvoice, id: 'inv-1', kilos: 500 },
      { ...baseInvoice, id: 'inv-2', kilos: 300 },
    ];

    const updated = aplicarPorId(invoices, 'inv-2', (inv) => ({
      ...inv,
      kilos: 400,
      creditCycle: { status: 'paid' },
    }));

    expect(updated).not.toBeNull();
    expect(updated).not.toBe(invoices);
    expect(updated![1].kilos).toBe(400);
    expect(updated![1].creditCycle?.status).toBe('paid');
    // La primera factura queda inalterada
    expect(updated![0].kilos).toBe(500);
    // El arreglo original no fue modificado
    expect(invoices[1].kilos).toBe(300);
  });

  it('aplicarPorId retorna null si no encuentra el ID de la factura', () => {
    const invoices: Invoice[] = [baseInvoice];
    const updated = aplicarPorId(invoices, 'inv-inexistente', (inv) => inv);
    expect(updated).toBeNull();
  });
});
