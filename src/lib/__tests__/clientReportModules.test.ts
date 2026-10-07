import { describe, it, expect } from 'vitest';
import { computeClientReportMetrics, pct } from '../clientReportTypes';
import { buildClientReportWhatsappMsg } from '../clientReportWhatsApp';
import type { PurchaseOrder } from '../types';

describe('Client Report Modular Architecture Tests', () => {
  const mockOrder: PurchaseOrder = {
    id: 'test-oc-1',
    folio: '43/9784',
    oc: '12026439784',
    client: 'Grupo Textil Providencia',
    totalKilograms: 5100,
    estimatedDeliveryDate: '2026-10-15' as any,
    financials: {
      salePricePerKg: 43,
      costPricePerKg: 38,
      commissionRate: 0.08,
      netCashFlow: 25500,
    } as any,
    invoices: [
      { id: 'inv1', folio: '6353', kilos: 1350 } as any,
    ],
    deliveries: [
      { id: 'd1', kilos: 1350, invoiced: true, docFolio: '6353', date: '2026-10-01' } as any,
      { id: 'd2', kilos: 2000, invoiced: false, docFolio: '6439784', date: '2026-10-05' } as any,
    ],
    items: [
      { id: 'i1', description: 'Bolsa 60x90', quantity: 3000, deliveredQuantity: 2000, unit: 'kg', unitPrice: 43, amount: 129000 } as any,
      { id: 'i2', description: 'Bolsa 90x120', quantity: 2100, deliveredQuantity: 1350, unit: 'kg', unitPrice: 43, amount: 90300 } as any,
    ],
  } as unknown as PurchaseOrder;

  it('computes metrics accurately with canonical financial rounding', () => {
    const metrics = computeClientReportMetrics(mockOrder);

    expect(metrics.totalKg).toBe(5100);
    expect(metrics.deliveredKg).toBe(3350); // 1350 + 2000
    expect(metrics.invoicedKg).toBe(1350);
    expect(metrics.pendingInvoiceKg).toBe(2000); // 3350 - 1350
    expect(metrics.remainingKg).toBe(1750); // 5100 - 3350
    expect(metrics.fulfillPct).toBe(65.7); // (3350 / 5100) * 100

    // Delivered amount: 3350 * 43 * 1.16 = 167,098
    expect(metrics.deliveredAmountIva).toBeCloseTo(3350 * 43 * 1.16, 2);
    // Pending amount: 1750 * 43 * 1.16 = 87,290
    expect(metrics.pendingAmount).toBeCloseTo(1750 * 43 * 1.16, 2);
  });

  it('pct function correctly limits and protects against division by zero', () => {
    expect(pct(0, 0)).toBe(0);
    expect(pct(500, 1000)).toBe(50);
    expect(pct(1500, 1000)).toBe(100);
    expect(pct(335, 510)).toBe(65.7);
  });

  it('generates a clean, comprehensive WhatsApp message', () => {
    const metrics = computeClientReportMetrics(mockOrder);
    const msg = buildClientReportWhatsappMsg({
      order: mockOrder,
      metrics,
      companyName: 'Elemental Denim Bolsas',
    });

    expect(msg).toContain('REPORTE DE AVANCE — OC 43/9784');
    expect(msg).toContain('Grupo Textil Providencia');
    expect(msg).toContain('Total Pedido: *5,100 kg*');
    expect(msg).toContain('Entregado a la fecha: *3,350 kg* (65.7%)');
    expect(msg).toContain('Pendiente de Entrega: *1,750 kg*');
    expect(msg).toContain('HISTORIAL DE ENTREGAS');
    expect(msg).toContain('DETALLE POR PARTIDA');
  });
});
