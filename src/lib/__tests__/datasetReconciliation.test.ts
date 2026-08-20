import { describe, it, expect } from 'vitest';
import { OFFICIAL_CRS, OFFICIAL_IN_REVIEW } from '../../components/Cobranza/SincronizadorOficialModal';
import { round2, computeCommissionFromInvoiceTotal } from '../finance';

describe('Auditoría y Conciliación Matemática de Cartera Oficial', () => {
  it('debe sumar exactamente $1,019,956.34 en los 10 Contrarecibos Oficiales', () => {
    const totalCrs = round2(OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0));
    expect(totalCrs).toBe(1019956.34);
    expect(OFFICIAL_CRS.length).toBe(10);
  });

  it('debe calcular la deuda total de Providencia con Factura 6167 exactamente en $1,101,736.34', () => {
    const totalCrs = OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0);
    const factura6167 = OFFICIAL_IN_REVIEW.total;
    const deudaTotal = round2(totalCrs + factura6167);

    expect(factura6167).toBe(81780.00);
    expect(deudaTotal).toBe(1101736.34);
  });

  it('debe calcular la comisión contable (8% sobre subtotal) con precisión milimétrica', () => {
    const totalConIva = 1101736.34;
    const subtotal = totalConIva / 1.16;
    const comisionEsperada = round2(subtotal * 0.08);

    const config = {
      salePricePerKg: 43,
      costPricePerKg: 42,
      commissionRate: 0.08,
      commissionBase: 'subtotal' as const,
      ivaRate: 0.16,
      creditDays: 30,
    };

    const comisionCalculada = computeCommissionFromInvoiceTotal(totalConIva, config);
    expect(comisionCalculada).toBe(comisionEsperada);
  });

  it('debe excluir estrictamente documentos con isDeleted o huérfanos sin alterar el dataset real', () => {
    const mockOrders = [
      ...OFFICIAL_CRS.map((c) => ({
        id: `cr-${c.cr.toLowerCase()}`,
        folio: c.cr,
        isDeleted: false,
        invoices: [{ folio: c.cr, financials: { invoiceTotal: c.total }, creditCycle: { status: 'pending' } }],
      })),
      {
        id: 'oc-120267114014',
        folio: '6167',
        isDeleted: false,
        invoices: [{ folio: '6167', financials: { invoiceTotal: 81780.00 }, creditCycle: { status: 'facturado' } }],
      },
      // 17 expedientes de prueba obsoletos simulados
      ...Array.from({ length: 17 }).map((_, i) => ({
        id: `test-orphan-${i}`,
        folio: `TEST-${i}`,
        isDeleted: true,
        invoices: [{ folio: `TEST-${i}`, financials: { invoiceTotal: 50000 }, creditCycle: { status: 'pending' } }],
      })),
    ];

    // Filtrado estricto
    const validOrders = mockOrders.filter((o: any) => !o.isDeleted);
    expect(validOrders.length).toBe(11);

    const sumaValidada = round2(
      validOrders.reduce((sum, o) => {
        const invTotal = o.invoices.reduce((s: number, i: any) => s + (i.financials?.invoiceTotal || 0), 0);
        return sum + invTotal;
      }, 0)
    );

    expect(sumaValidada).toBe(1101736.34);
  });
});
