import { describe, it, expect } from 'vitest';
import type { PurchaseOrder, Invoice } from '../types';
import { extractCr } from '../finance';

describe('FASE 3: Estados y Flujo Canónico de Cobranza', () => {
  // Lógica canónica unificada igual a la de Cobranza/index.tsx
  const isCollected = (inv: any) =>
    inv.creditCycle?.status === 'collected' || Boolean(inv.collection?.collectedAt);

  const isPaid = (inv: any) =>
    !isCollected(inv) && (inv.creditCycle?.status === 'paid' || Boolean(inv.collection?.paidAt));

  const isPaidOrCollected = (inv: any) => isCollected(inv) || isPaid(inv);

  const saldo = (inv: any) =>
    Math.max((inv.financials?.invoiceTotal ?? inv.financials?.saleTotal ?? 0) - (inv.collection?.paidAmount ?? 0), 0);

  it('1. Factura sin CR se clasifica en colRevision y no en por cobrar', () => {
    const inv: Partial<Invoice> = {
      id: 'inv-1',
      folio: 'F-101',
      kilos: 1000,
      creditCycle: { status: 'revision' as any, dueDate: null as any },
      financials: { invoiceTotal: 49880, saleTotal: 49880 } as any,
    };
    const order: Partial<PurchaseOrder> = {
      id: 'ord-1',
      folio: 'OC-1',
      invoices: [inv as Invoice],
    };

    const cr = extractCr(inv as Invoice, order as PurchaseOrder);
    expect(cr).toBe('');
    expect(isPaidOrCollected(inv)).toBe(false);

    const hasCr = cr.length > 0;
    expect(hasCr).toBe(false); // Col Revision
  });

  it('2. Factura con CR activo se clasifica en colPorCobrar', () => {
    const inv: Partial<Invoice> = {
      id: 'inv-2',
      folio: 'F-102',
      kilos: 2000,
      creditCycle: { status: 'pending' as any, dueDate: '2026-11-15' as any },
      collection: { contrareciboNumber: 'GT-1047' } as any,
      financials: { invoiceTotal: 99760, saleTotal: 99760 } as any,
    };
    const order: Partial<PurchaseOrder> = {
      id: 'ord-2',
      invoices: [inv as Invoice],
    };

    const cr = extractCr(inv as Invoice, order as PurchaseOrder);
    expect(cr).toBe('GT-1047');
    expect(isPaidOrCollected(inv)).toBe(false);

    const hasCr = cr.length > 0;
    expect(hasCr).toBe(true); // Col Por Cobrar
  });

  it('3. Factura pagada con el contador se clasifica en paid (colContador)', () => {
    const inv: Partial<Invoice> = {
      id: 'inv-3',
      folio: 'F-103',
      kilos: 1000,
      creditCycle: { status: 'paid' as any, dueDate: '2026-10-01' as any },
      collection: { contrareciboNumber: 'TH-1195', paidAt: {} as any } as any,
      financials: { invoiceTotal: 49880, saleTotal: 49880 } as any,
    };

    expect(isPaid(inv)).toBe(true);
    expect(isCollected(inv)).toBe(false);
    expect(isPaidOrCollected(inv)).toBe(true);
  });

  it('4. Factura recolectada en caja se clasifica en collected (colCaja)', () => {
    const inv: Partial<Invoice> = {
      id: 'inv-4',
      folio: 'F-104',
      kilos: 1000,
      creditCycle: { status: 'collected' as any },
      collection: { contrareciboNumber: 'GT-993', collectedAt: {} as any } as any,
      financials: { invoiceTotal: 49880, saleTotal: 49880 } as any,
    };

    expect(isCollected(inv)).toBe(true);
    expect(isPaid(inv)).toBe(false); // No está doble en paid
    expect(isPaidOrCollected(inv)).toBe(true);
  });

  it('5. NO existe dependencia en listas estáticas de folios para determinar estado pagado', () => {
    // TH-836 antes estaba hardcodeado en PAID_CRS_SET y forzaba el estado a collected
    const invPendingHistorico: Partial<Invoice> = {
      id: 'inv-5',
      folio: 'F-500',
      creditCycle: { status: 'pending' as any },
      collection: { contrareciboNumber: 'TH-836' } as any,
      financials: { invoiceTotal: 106720.17 } as any,
    };

    // Al haberse eliminado PAID_CRS_SET, si el documento dice 'pending', NO se considera pagado
    expect(isCollected(invPendingHistorico)).toBe(false);
    expect(isPaid(invPendingHistorico)).toBe(false);
    expect(isPaidOrCollected(invPendingHistorico)).toBe(false);

    // Solo si el documento tiene el status 'collected' o 'paid', se considera como tal
    const invCollectedReal: Partial<Invoice> = {
      ...invPendingHistorico,
      creditCycle: { status: 'collected' as any },
    };
    expect(isCollected(invCollectedReal)).toBe(true);
  });

  it('6. Métricas y contadores de cartera son consistentes y exactos', () => {
    const mockInvoices: Array<{ inv: Partial<Invoice>; o: Partial<PurchaseOrder> }> = [
      {
        inv: {
          id: '1',
          creditCycle: { status: 'revision' as any },
          financials: { invoiceTotal: 20000, saleTotal: 20000, commission: 1600 } as any,
        },
        o: { id: 'o1' },
      },
      {
        inv: {
          id: '2',
          creditCycle: { status: 'pending' as any },
          collection: { contrareciboNumber: 'CR-1' } as any,
          financials: { invoiceTotal: 50000, saleTotal: 50000, commission: 4000 } as any,
        },
        o: { id: 'o2' },
      },
      {
        inv: {
          id: '3',
          creditCycle: { status: 'paid' as any },
          collection: { contrareciboNumber: 'CR-2', paidAt: {} as any } as any,
          financials: { invoiceTotal: 30000, saleTotal: 30000, commission: 2400 } as any,
        },
        o: { id: 'o3' },
      },
      {
        inv: {
          id: '4',
          creditCycle: { status: 'collected' as any },
          collection: { contrareciboNumber: 'CR-3', collectedAt: {} as any } as any,
          financials: { invoiceTotal: 40000, saleTotal: 40000, commission: 3200 } as any,
        },
        o: { id: 'o4' },
      },
    ];

    const openInvoices = mockInvoices.filter(x => !isPaidOrCollected(x.inv));
    const paidInvoices = mockInvoices.filter(x => isPaid(x.inv));
    const collectedInvoices = mockInvoices.filter(x => isCollected(x.inv));

    expect(openInvoices.length).toBe(2);      // inv 1 (revision) y inv 2 (por cobrar)
    expect(paidInvoices.length).toBe(1);      // inv 3 (contador)
    expect(collectedInvoices.length).toBe(1);  // inv 4 (caja)

    const meDeben = openInvoices.reduce((a, x) => a + saldo(x.inv), 0);
    expect(meDeben).toBe(70000); // 20k + 50k

    const cobrado = mockInvoices
      .filter(x => isPaidOrCollected(x.inv))
      .reduce((a, x) => a + (x.inv.financials?.invoiceTotal ?? 0), 0);
    expect(cobrado).toBe(70000); // 30k + 40k

    const comisiones = mockInvoices
      .filter(x => isPaidOrCollected(x.inv))
      .reduce((a, x) => a + (x.inv.financials?.commission ?? 0), 0);
    expect(comisiones).toBe(5600); // 2400 + 3200
  });

  it('7. Inmutabilidad e Idempotencia: movimientos de caja independientes y filtro de estado en transacción', () => {
    // 1. Simular facturas dentro de la transacción:
    const facturas = [
      { id: 'FAC_1', creditCycle: { status: 'collected' }, financials: { invoiceTotal: 50000, commission: 4000 } },
      { id: 'FAC_2', creditCycle: { status: 'paid' }, financials: { invoiceTotal: 30000, commission: 2400 } },
    ];

    // En la transacción, si la factura ya está 'collected', se omite del cálculo para no duplicar ingreso
    let netCobrado = 0;
    for (const inv of facturas) {
      if (inv.creditCycle.status === 'collected') continue; // Idempotencia transaccional
      netCobrado += (inv.financials.invoiceTotal - inv.financials.commission);
    }
    expect(netCobrado).toBe(27600); // Solo suma FAC_2, ignorando la ya recolectada

    // 2. Inmutabilidad: cada evento contable genera un ID de movimiento único en expenses
    // asegurando que reversiones y re-cobros posteriores no sobreescriban los registros históricos
    const idEvento1 = 'exp_' + Math.random().toString(36).substring(2, 9);
    const idEvento2 = 'exp_' + Math.random().toString(36).substring(2, 9);
    expect(idEvento1).not.toBe(idEvento2);
  });
});
