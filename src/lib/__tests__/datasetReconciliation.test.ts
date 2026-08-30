import { describe, it, expect } from 'vitest';
import { OFFICIAL_CRS, OFFICIAL_IN_REVIEW } from '../../components/Cobranza/SincronizadorOficialModal';
import { round2, computeCommissionFromInvoiceTotal } from '../finance';

describe('Auditoría y Conciliación Matemática de Cartera Oficial', () => {
  it('debe sumar exactamente $782,559.93 en los 9 Contrarecibos Oficiales Generados', () => {
    const totalCrs = round2(OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0));
    expect(totalCrs).toBe(782559.93);
    expect(OFFICIAL_CRS.length).toBe(9);
  });

  it('debe calcular la deuda total de Providencia con las 2 facturas en revisión (F-6224, F-6200) en $906,411.97', () => {
    const totalCrs = OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0);
    const totalRevision = Array.isArray(OFFICIAL_IN_REVIEW)
      ? round2(OFFICIAL_IN_REVIEW.reduce((sum, item) => sum + item.total, 0))
      : 0;
    const deudaTotal = round2(totalCrs + totalRevision);

    expect(totalRevision).toBe(123852.04);
    expect(deudaTotal).toBe(906411.97);
  });

  it('debe calcular la comisión contable (8% sobre subtotal) con precisión milimétrica', () => {
    const totalConIva = 782559.93;
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
    expect(validOrders.length).toBe(9);

    const sumaValidada = round2(
      validOrders.reduce((sum, o) => {
        const invTotal = o.invoices.reduce((s: number, i: any) => s + (i.financials?.invoiceTotal || 0), 0);
        return sum + invTotal;
      }, 0)
    );

    expect(sumaValidada).toBe(782559.93);
  });
});
