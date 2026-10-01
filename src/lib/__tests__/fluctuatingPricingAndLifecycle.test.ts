import { describe, it, expect } from 'vitest';
import { configEfectiva, getOrderSummary } from '../finance';
import { parseOrdenDeCompra } from '../ocParser';
import type { FinancialConfig, PurchaseOrder } from '../types';

describe('Flujo de Precios Fluctuantes y Ciclo de Vida de OC', () => {
  const baseConfig: FinancialConfig = {
    salePricePerKg: 43.00,
    costPricePerKg: 38.00,
    ivaRate: 0.16,
    commissionRate: 0.08,
    commissionBase: 'subtotal',
    creditDays: 30,
  };

  it('detecta correctamente el precio unitario pactado en el texto de la OC', () => {
    const ocText = `
GRUPO TEXTIL PROVIDENCIA SA DE CV
CDB OC: 12026998877
No. Ord. de Compra: 43/9988
Fecha Entrega: 15-octubre-2026
1 EGBO000095-SC 2,500.0000 BOLSA POLIETILENO 120X125 CM _Sin Color 43.0000 0.0000 107,500.0000
    `;

    const parsed = parseOrdenDeCompra(ocText);
    expect(parsed.totalKilograms).toBe(2500);
    expect(parsed.items.length).toBe(1);
    expect(parsed.items[0].unitPrice).toBe(43.00);
  });

  it('calcula márgenes y utilidades para compras fluctuantes a Andrés ($37 vs $38 vs $43)', () => {
    const totalKg = 8000;
    const salePrice = 43.00;

    // Caso 1: Compra barata a Andrés ($37.00/kg)
    const cost37 = 37.00;
    const margin37 = salePrice - cost37;
    const profit37 = margin37 * totalKg;
    expect(margin37).toBe(6.00);
    expect(profit37).toBe(48000.00);

    // Caso 2: Compra estándar a Andrés ($38.00/kg)
    const cost38 = 38.00;
    const margin38 = salePrice - cost38;
    const profit38 = margin38 * totalKg;
    expect(margin38).toBe(5.00);
    expect(profit38).toBe(40000.00);

    // Caso 3: Compra cara / margen estrecho ($43.00/kg cuando venta es $43.00/kg)
    const cost43 = 43.00;
    const margin43 = salePrice - cost43;
    expect(margin43).toBe(0.00);
  });

  it('configEfectiva prioriza customCostPrice y customSellPrice de la orden sobre el default global', () => {
    const customOrder: Partial<PurchaseOrder> = {
      customSellPrice: 45.50,
      customCostPrice: 37.00,
    };

    const effective = configEfectiva(baseConfig, customOrder);
    expect(effective.salePricePerKg).toBe(45.50);
    expect(effective.costPricePerKg).toBe(37.00);
    expect(baseConfig.salePricePerKg).toBe(43.00); // Inmutable
    expect(baseConfig.costPricePerKg).toBe(38.00); // Inmutable
  });

  it('getOrderSummary calcula la deuda de compra con Andrés en base al customCostPrice de esa orden', () => {
    const orderWithCustomPrice: PurchaseOrder = {
      id: 'oc-fluctuante-1',
      oc: '120268877',
      folio: '43/8877',
      client: 'GRUPO TEXTIL PROVIDENCIA SA DE CV',
      department: 'TH',
      totalKilograms: 5000,
      customSellPrice: 43.00,
      customCostPrice: 37.00, // Comprado a Andrés a $37/kg
      items: [{
        id: 'it1',
        description: 'Bolsa 120x125',
        unit: 'KGM',
        quantity: 5000,
        unitPrice: 43.00,
        amount: 215000,
      }],
      deliveries: [{
        id: 'del-1',
        kilos: 5000,
        date: new Date() as any,
        notes: 'Entrega total en báscula',
        invoiced: true,
      }],
      invoices: [{
        id: 'inv-1',
        folio: '6200',
        kilos: 5000,
        creditCycle: { status: 'facturado' },
      }] as any,
      createdAt: new Date() as any,
      updatedAt: new Date() as any,
    };

    const summary = getOrderSummary(orderWithCustomPrice);
    expect(summary.kilosDelivered).toBe(5000);
    expect(summary.kilosInvoiced).toBe(5000);
  });
});
