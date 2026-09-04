import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildMasterExcelWorkbook } from '../masterExcelExporter';
import { generateExecutiveOnePagerPdf } from '../executiveOnePagerPdf';
import type { PurchaseOrder, Purchase, Expense, FinancialConfig } from '../types';

describe('Master Excel Exporter & Executive One-Pager PDF Tests', () => {
  const mockConfig: FinancialConfig = {
    salePricePerKg: 43,
    costPricePerKg: 38,
    ivaRate: 0.16,
    commissionRate: 0.08,
    creditDays: 30,
    commissionBase: 'subtotal',
  };

  const mockOrders: PurchaseOrder[] = [
    {
      id: 'ord-th-1',
      oc: '120267114114',
      folio: 'TH-1024',
      client: 'TEXTIL HOGAR (TH - NAVA)',
      department: 'TH',
      totalKilograms: 1000,
      deliveries: [
        { id: 'del-1', date: new Date('2026-08-17') as any, kilos: 990.16, invoiced: true }
      ],
      invoices: [
        {
          id: 'inv-1',
          orderId: 'ord-th-1',
          folio: '6198',
          kilos: 990.16,
          financials: {
            salePricePerKg: 43,
            costPricePerKg: 38,
            saleTotal: 42576.88,
            invoiceTotal: 49389.18,
            costTotal: 37626.08,
            commission: 3406.15,
            netCashFlow: 8356.95,
            tradeMargin: 4950.80,
          },
          collection: { contrareciboNumber: 'TH-1024' },
          creditCycle: { status: 'pending', issueDate: new Date('2026-08-17') as any }
        }
      ],
      items: [
        { id: 'it-1', code: 'EGBO000001-SC', description: 'BULTO POLIETILENO 48 x 17 + 17 x 140 CM', quantity: 1000, unitPrice: 43 } as any
      ]
    },
    {
      id: 'ord-gt-1',
      oc: '12026439713',
      folio: 'GT-570',
      client: 'GRUPO TEXTIL PROVIDENCIA (GT - EVELIA / P4)',
      department: 'GT',
      totalKilograms: 2000,
      deliveries: [
        { id: 'del-2', date: new Date('2026-08-25') as any, kilos: 500, invoiced: false }
      ],
      invoices: [],
      items: [
        { id: 'it-2', code: 'EGBO000009-SC', description: 'BOLSA POLIETILENO 120X 125 CM', quantity: 2000, unitPrice: 43 } as any
      ]
    }
  ];

  const mockPurchases: Purchase[] = [
    {
      id: 'pur-1',
      provider: 'Andres',
      expectedKilos: 1000,
      receivedKilos: 990.16,
      pricePerKg: 38,
      totalAmount: 37626.08,
      status: 'recibido',
      date: new Date('2026-08-17') as any,
    } as any
  ];

  const mockExpenses: Expense[] = [
    {
      id: 'exp-1',
      date: new Date('2026-08-18') as any,
      type: 'ingreso',
      amount: 50000,
      concept: 'Cobro de Factura Providencia',
      provider: 'Banco',
      createdAt: Date.now() as any,
    },
    {
      id: 'exp-2',
      date: new Date('2026-08-19') as any,
      type: 'egreso',
      amount: 15000,
      concept: 'Pago anticipo material a Andrés',
      provider: 'Andrés',
      createdAt: Date.now() as any,
    }
  ];

  it('buildMasterExcelWorkbook genera las 5 hojas oficiales con datos íntegros', () => {
    const wb = buildMasterExcelWorkbook({
      orders: mockOrders,
      purchases: mockPurchases,
      expenses: mockExpenses,
      config: mockConfig,
      settings: { providerName: 'Andrés' },
    });

    expect(wb.SheetNames).toEqual([
      '📊 Resumen & P&L',
      '📦 Expedientes',
      '🧾 Facturación & CR',
      '⚖️ Cuenta Andrés',
      '💵 Caja Chica',
    ]);

    // Verificar Hoja 1
    const ws1 = wb.Sheets['📊 Resumen & P&L'];
    const json1: any[][] = XLSX.utils.sheet_to_json(ws1, { header: 1 });
    expect(json1.length).toBeGreaterThan(10);

    // Verificar Hoja 2 (Expedientes)
    const ws2 = wb.Sheets['📦 Expedientes'];
    const json2: any[] = XLSX.utils.sheet_to_json(ws2);
    expect(json2.length).toBe(2);
    expect(json2[0]['Folio_OC']).toBe('120267114114');
    expect(json2[1]['Folio_OC']).toBe('12026439713');

    // Verificar Hoja 3 (Facturación)
    const ws3 = wb.Sheets['🧾 Facturación & CR'];
    const json3: any[] = XLSX.utils.sheet_to_json(ws3);
    expect(json3.length).toBe(1);
    expect(json3[0]['Folio_Factura']).toBe('6198');
    expect(json3[0]['Contrarecibo_CR']).toBe('TH-1024');

    // Verificar Hoja 4 (Compras)
    const ws4 = wb.Sheets['⚖️ Cuenta Andrés'];
    const json4: any[] = XLSX.utils.sheet_to_json(ws4);
    expect(json4.length).toBe(1);
    expect(json4[0]['Kilos_Recibidos']).toBe(990.16);

    // Verificar Hoja 5 (Caja Chica)
    const ws5 = wb.Sheets['💵 Caja Chica'];
    const json5: any[] = XLSX.utils.sheet_to_json(ws5);
    expect(json5.length).toBe(2);
  });

  it('generateExecutiveOnePagerPdf construye un documento PDF de 1 página formal', () => {
    const pdf = generateExecutiveOnePagerPdf({
      orders: mockOrders,
      expenses: mockExpenses,
      config: mockConfig,
      settings: { providerName: 'Andrés' },
      saldoCaja: 35000,
      saldoAndres: 227628.94,
    });

    expect(pdf).toBeDefined();
    expect(pdf.getNumberOfPages()).toBe(1);
  });
});
