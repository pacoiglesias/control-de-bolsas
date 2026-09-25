import { describe, it, expect } from 'vitest';
import { OFFICIAL_CRS, OFFICIAL_IN_REVIEW } from '../../components/Cobranza/SincronizadorOficialModal';
import { round2, computeCommissionFromInvoiceTotal } from '../finance';
import {
  CARTERA_OFICIAL,
  TOTAL_CARTERA_OFICIAL,
  CARTERA_PAGADA_OFICIAL,
  TOTAL_CARTERA_PAGADA,
  SALDO_CAJA_ACTUAL,
  TOTAL_VENCIDOS_OFICIAL,
  TOTAL_FACTURAS_REVISION_OFICIAL,
  DEUDA_TOTAL_PROVIDENCIA_OFICIAL,
} from '../constants';

describe('Auditoría y Conciliación Matemática de Cartera Oficial', () => {
  it('debe sumar exactamente $805,190.14 en los 10 Contrarecibos Oficiales Vigentes', () => {
    const totalCrs = round2(OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0));
    expect(totalCrs).toBe(805190.14);
    expect(OFFICIAL_CRS.length).toBe(10);
  });

  it('debe calcular la deuda total de Providencia con las 2 facturas en revisión (F-6302 y F-6307) en $919,116.06', () => {
    const totalCrs = round2(OFFICIAL_CRS.reduce((sum, item) => sum + item.total, 0));
    const totalRevision = Array.isArray(OFFICIAL_IN_REVIEW)
      ? round2(OFFICIAL_IN_REVIEW.reduce((sum, item) => sum + item.total, 0))
      : 0;
    const deudaTotal = round2(totalCrs + totalRevision);

    expect(totalRevision).toBe(113925.92);
    expect(deudaTotal).toBe(919116.06);
    expect(TOTAL_FACTURAS_REVISION_OFICIAL).toBe(113925.92);
    expect(DEUDA_TOTAL_PROVIDENCIA_OFICIAL).toBe(919116.06);
  });

  it('debe validar el importe exacto de vencidos en $81,780.00 correspondiente a CR TH-946', () => {
    expect(TOTAL_VENCIDOS_OFICIAL).toBe(81780.00);
    const crVencido = OFFICIAL_CRS.find(c => c.status === 'VENCIDO' || c.cr === 'TH-946');
    expect(crVencido?.total).toBe(81780.00);
  });

  it('debe calcular la comisión contable (8% sobre subtotal) con precisión milimétrica', () => {
    const totalConIva = 805190.14;
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
    expect(validOrders.length).toBe(10);

    const sumaValidada = round2(
      validOrders.reduce((sum, o) => {
        const invTotal = o.invoices.reduce((s: number, i: any) => s + (i.financials?.invoiceTotal || 0), 0);
        return sum + invTotal;
      }, 0)
    );

    expect(sumaValidada).toBe(805190.14);
  });

  it('debe validar la Cartera Oficial Activa Vigente en $805,190.14 con los 10 CRs del portal', () => {
    const totalActivo = round2(CARTERA_OFICIAL.reduce((sum, item) => sum + item.monto, 0));
    expect(totalActivo).toBe(805190.14);
    expect(CARTERA_OFICIAL.length).toBe(10);
    expect(TOTAL_CARTERA_OFICIAL).toBe(805190.14);
  });

  it('debe validar la Cartera Pagada Oficial en $1,032,087.04 y el Saldo en Efectivo de Caja en $844,526.90', () => {
    const totalPagado = round2(CARTERA_PAGADA_OFICIAL.reduce((sum, item) => sum + item.monto, 0));
    expect(totalPagado).toBe(1032087.04);
    expect(CARTERA_PAGADA_OFICIAL.length).toBe(10);
    expect(TOTAL_CARTERA_PAGADA).toBe(1032087.04);
    expect(SALDO_CAJA_ACTUAL).toBe(844526.90);
  });
});

