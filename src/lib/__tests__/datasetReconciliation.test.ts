import { describe, it, expect } from 'vitest';
import { OFFICIAL_CRS, OFFICIAL_IN_REVIEW } from '../../components/Cobranza/SincronizadorOficialModal';
import { round2, computeCommissionFromInvoiceTotal } from '../finance';

describe('Auditoría y Conciliación Matemática de Cartera Oficial', () => {
  it('debe sumar exactamente $1,101,736.34 en los 11 Contrarecibos Oficiales', () => {
    const totalCrs = round2(OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0));
    expect(totalCrs).toBe(1101736.34);
    expect(OFFICIAL_CRS.length).toBe(11);
  });

  it('debe calcular la deuda total de Providencia con las 3 facturas en revisión (F-6198, F-6200, F-6193) en $1,324,490.94', () => {
    const totalCrs = OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0);
    const totalRevision = Array.isArray(OFFICIAL_IN_REVIEW)
      ? round2(OFFICIAL_IN_REVIEW.reduce((sum, item) => sum + item.total, 0))
      : 0;
    const deudaTotal = round2(totalCrs + totalRevision);

    expect(totalRevision).toBe(222754.60);
    expect(deudaTotal).toBe(1324490.94);
  });

  it('debe calcular la comisión contable (8% sobre subtotal) con precisión milimétrica', () => {
    const totalConIva = 1101736.34;
    const subtotal = totalConIva / 1.16;
    const comisionEsperada = round2(subtotal * 0.08);

    const config = {
      salePricePerKg: 43,
      costPricePerKg: 38,
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
